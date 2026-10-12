// YandexLLMClient — вызов модели Yandex AI Studio через OpenAI-совместимый Chat Completions API.
// Обычный fetch без SDK: один POST, подменяемый в тестах. Повторов нет — упавший запрос повторит следующий тик.

import { z } from 'zod';
import { LLMClientError, type LLMClient, type LLMErrorCode, type LLMRequest, type LLMResponse } from '@/lib/llm/types';

export const YANDEX_LLM_BASE_URL = 'https://llm.api.cloud.yandex.net/v1';
export const LLM_TEMPERATURE = 0.2;
export const LLM_MAX_TOKENS = 500;
export const LLM_TIMEOUT_MS = 30_000;
const COMPLETIONS_PATH = '/chat/completions';
const SERVER_ERROR_STATUS = 500;
const TIMEOUT_ERROR_NAME = 'TimeoutError';

const STATUS_CODES: Partial<Record<number, LLMErrorCode>> = {
	401: 'unauthorized',
	403: 'unauthorized',
	429: 'rate_limited',
};

/** Как просить структурированный вывод: JSON Schema, «любой JSON» или обычный текст. */
export type LLMResponseFormat = 'json_schema' | 'json_object' | 'text';

export interface YandexLLMClientOptions {
	apiKey: string;
	folderId: string;
	/** URI модели, например `gpt://<folder_ID>/yandexgpt/latest`. */
	modelUri: string;
	responseFormat?: LLMResponseFormat;
	baseUrl?: string;
	fetch?: typeof fetch;
	timeoutMs?: number;
}

const completionSchema = z.object({
	choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

const errorBodySchema = z.object({ error: z.object({ message: z.string() }) });

function errorCodeFor(status: number): LLMErrorCode {
	const code = STATUS_CODES[status];
	if (code) return code;
	return status >= SERVER_ERROR_STATUS ? 'unavailable' : 'bad_request';
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

export class YandexLLMClient implements LLMClient {
	private readonly apiKey: string;
	private readonly folderId: string;
	private readonly modelUri: string;
	private readonly responseFormat: LLMResponseFormat;
	private readonly baseUrl: string;
	private readonly fetchFn: typeof fetch;
	private readonly timeoutMs: number;

	constructor({
		apiKey,
		folderId,
		modelUri,
		responseFormat = 'json_schema',
		baseUrl = YANDEX_LLM_BASE_URL,
		fetch: fetchFn = globalThis.fetch,
		timeoutMs = LLM_TIMEOUT_MS,
	}: YandexLLMClientOptions) {
		this.apiKey = apiKey;
		this.folderId = folderId;
		this.modelUri = modelUri;
		this.responseFormat = responseFormat;
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.fetchFn = fetchFn;
		this.timeoutMs = timeoutMs;
	}

	async complete(request: LLMRequest): Promise<LLMResponse> {
		const response = await this.send(this.buildBody(request));
		const raw = await response.text();
		const body = parseJson(raw);

		if (!response.ok) {
			const parsedError = errorBodySchema.safeParse(body);
			const message = parsedError.success ? parsedError.data.error.message : `HTTP ${response.status}`;
			throw new LLMClientError(errorCodeFor(response.status), message);
		}

		if (body === undefined) throw new LLMClientError('invalid_response', 'Ответ модели — не JSON');
		const parsed = completionSchema.safeParse(body);
		if (!parsed.success) throw new LLMClientError('invalid_response', 'В ответе модели нет choices[0].message.content');

		const [choice] = parsed.data.choices;
		if (!choice) throw new LLMClientError('invalid_response', 'В ответе модели нет choices[0].message.content');
		return { content: choice.message.content, raw };
	}

	private buildBody({ system, user, jsonSchema }: LLMRequest): Record<string, unknown> {
		const body: Record<string, unknown> = {
			model: this.modelUri,
			temperature: LLM_TEMPERATURE,
			max_tokens: LLM_MAX_TOKENS,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user },
			],
		};
		if (!jsonSchema || this.responseFormat === 'text') return body;
		if (this.responseFormat === 'json_object') return { ...body, response_format: { type: 'json_object' } };
		return {
			...body,
			response_format: { type: 'json_schema', json_schema: { name: jsonSchema.name, schema: jsonSchema.schema, strict: true } },
		};
	}

	private async send(body: Record<string, unknown>): Promise<Response> {
		try {
			return await this.fetchFn(`${this.baseUrl}${COMPLETIONS_PATH}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'OpenAI-Project': this.folderId,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.timeoutMs),
			});
		} catch (error) {
			const timedOut = error instanceof Error && error.name === TIMEOUT_ERROR_NAME;
			const message = timedOut ? `Модель не ответила за ${this.timeoutMs} мс` : 'Модель недоступна';
			throw new LLMClientError('unavailable', message, { cause: error });
		}
	}
}
