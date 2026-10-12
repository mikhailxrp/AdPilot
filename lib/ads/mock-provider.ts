// MockProvider — HTTP-клиент мока Директа (app/api/mock/direct). Ходит по сети с Bearer-токеном,
// как будущий DirectSandboxProvider. Копейки ↔ микроединицы переводятся здесь.

import { z } from 'zod';
import {
	AdsProviderError,
	type AdsCampaign,
	type AdsErrorCode,
	type AdsProvider,
	type AdsReport,
	type ReportQuery,
} from '@/lib/ads/types';
import {
	bidsSetResponseSchema,
	campaignIdResponseSchema,
	campaignsGetResponseSchema,
	errorResponseSchema,
	reportsGetResponseSchema,
} from '@/lib/ads/mock-responses';
import { MICRO } from '@/lib/validations/mock';

export const REQUEST_TIMEOUT_MS = 10_000;
const API_PATH = '/json/v5';
const SERVER_ERROR_STATUS = 500;
const TIMEOUT_ERROR_NAME = 'TimeoutError';

const STATUS_CODES: Partial<Record<number, AdsErrorCode>> = {
	400: 'bad_request',
	401: 'unauthorized',
	404: 'not_found',
	409: 'conflict',
};

type Service = 'campaigns' | 'bids' | 'reports';

export interface MockProviderOptions {
	/** Корень мока, например `http://localhost:3000/api/mock/direct`. */
	baseUrl: string;
	token: string;
	fetch?: typeof fetch;
	timeoutMs?: number;
}

const envSchema = z.object({
	MOCK_API_URL: z.url('MOCK_API_URL должен быть адресом мока, например http://localhost:3000/api/mock/direct'),
	MOCK_API_TOKEN: z.string('Не задан MOCK_API_TOKEN').min(1, 'Не задан MOCK_API_TOKEN'),
});

function kopecksToMicro(kopecks: number): number {
	return kopecks * MICRO;
}

function describeIssue(error: z.ZodError): string {
	const issue = error.issues[0];
	if (!issue) return 'Ответ мока не соответствует схеме';
	const path = issue.path.join('.');
	return `Ответ мока не соответствует схеме: ${path ? `${path}: ` : ''}${issue.message}`;
}

async function readJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return undefined;
	}
}

function errorCodeFor(status: number): AdsErrorCode {
	const code = STATUS_CODES[status];
	if (code) return code;
	return status >= SERVER_ERROR_STATUS ? 'unavailable' : 'bad_request';
}

export class MockProvider implements AdsProvider {
	private readonly baseUrl: string;
	private readonly token: string;
	private readonly fetchFn: typeof fetch;
	private readonly timeoutMs: number;

	constructor({ baseUrl, token, fetch: fetchFn = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS }: MockProviderOptions) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.token = token;
		this.fetchFn = fetchFn;
		this.timeoutMs = timeoutMs;
	}

	async listCampaigns(): Promise<AdsCampaign[]> {
		const { result } = await this.call('campaigns', 'get', undefined, campaignsGetResponseSchema);
		return result.Campaigns;
	}

	async getReport(query: ReportQuery = {}): Promise<AdsReport> {
		const params = {
			...(query.campaignIds ? { CampaignIds: query.campaignIds } : {}),
			...(query.fromTick !== undefined ? { FromTick: query.fromTick } : {}),
			...(query.toTick !== undefined ? { ToTick: query.toTick } : {}),
		};
		const hasParams = Object.keys(params).length > 0;
		const { result } = await this.call('reports', 'get', hasParams ? params : undefined, reportsGetResponseSchema);
		return result;
	}

	async setBid(campaignId: string, bid: number): Promise<void> {
		await this.call('bids', 'set', { CampaignId: campaignId, Bid: kopecksToMicro(bid) }, bidsSetResponseSchema);
	}

	async setDailyBudget(campaignId: string, dailyBudget: number): Promise<void> {
		await this.call(
			'campaigns',
			'update',
			{ CampaignId: campaignId, DailyBudget: kopecksToMicro(dailyBudget) },
			campaignIdResponseSchema,
		);
	}

	async suspend(campaignId: string): Promise<void> {
		await this.call('campaigns', 'suspend', { CampaignId: campaignId }, campaignIdResponseSchema);
	}

	async resume(campaignId: string): Promise<void> {
		await this.call('campaigns', 'resume', { CampaignId: campaignId }, campaignIdResponseSchema);
	}

	private async call<S extends z.ZodType>(
		service: Service,
		method: string,
		params: Record<string, unknown> | undefined,
		schema: S,
	): Promise<z.output<S>> {
		const response = await this.send(service, { method, ...(params ? { params } : {}) });
		const body = await readJson(response);

		if (!response.ok) {
			const parsedError = errorResponseSchema.safeParse(body);
			const message = parsedError.success ? parsedError.data.error.error_string : `HTTP ${response.status}`;
			throw new AdsProviderError(errorCodeFor(response.status), message);
		}

		const parsed = schema.safeParse(body);
		if (!parsed.success) throw new AdsProviderError('invalid_response', describeIssue(parsed.error));
		return parsed.data;
	}

	private async send(service: Service, body: unknown): Promise<Response> {
		try {
			return await this.fetchFn(`${this.baseUrl}${API_PATH}/${service}`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.timeoutMs),
			});
		} catch (error) {
			const timedOut = error instanceof Error && error.name === TIMEOUT_ERROR_NAME;
			const message = timedOut ? `Мок не ответил за ${this.timeoutMs} мс` : 'Мок недоступен';
			throw new AdsProviderError('unavailable', message, { cause: error });
		}
	}
}

/** Провайдер из `MOCK_API_URL` и `MOCK_API_TOKEN`; без них — ошибка конфигурации сразу. */
export function createMockProviderFromEnv(env: Record<string, string | undefined> = process.env): MockProvider {
	const parsed = envSchema.safeParse(env);
	if (!parsed.success) {
		throw new Error(`Конфигурация MockProvider: ${parsed.error.issues.map(({ message }) => message).join('; ')}`);
	}
	return new MockProvider({ baseUrl: parsed.data.MOCK_API_URL, token: parsed.data.MOCK_API_TOKEN });
}
