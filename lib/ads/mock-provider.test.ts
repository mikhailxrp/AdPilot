// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createMockProviderFromEnv, MockProvider } from '@/lib/ads/mock-provider';
import { AdsProviderError } from '@/lib/ads/types';

const BASE_URL = 'http://mock.test/api/mock/direct';
const TOKEN = 'secret-token';

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

function setup(response: Response | (() => Promise<Response>)) {
	const fetchMock = vi.fn<typeof fetch>(typeof response === 'function' ? response : async () => response);
	const provider = new MockProvider({ baseUrl: BASE_URL, token: TOKEN, fetch: fetchMock });
	return { provider, fetchMock };
}

function sentRequest(fetchMock: ReturnType<typeof setup>['fetchMock']) {
	const [url, init] = fetchMock.mock.calls[0] ?? [];
	const headers = new Headers(init?.headers);
	const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
	return { url, method: init?.method, authorization: headers.get('authorization'), body };
}

async function expectAdsError(promise: Promise<unknown>, code: string, message?: string): Promise<void> {
	const error = await promise.catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(AdsProviderError);
	expect(error).toMatchObject({ code, ...(message ? { message } : {}) });
}

const directCampaign = {
	Id: 'c1',
	Name: 'Хорошая',
	State: 'ON',
	Bid: 20_000_000,
	DailyBudget: 3_000_000_000,
	TargetCpo: 1_000_000_000,
};

const directRow = {
	CampaignId: 'c1',
	Tick: 3,
	Impressions: 200,
	Clicks: 10,
	Conversions: 1,
	Cost: 200_000_000,
	Bid: 20_000_000,
};

describe('MockProvider — запросы', () => {
	it('POST на /json/v5/{service} с Bearer-токеном и телом { method, params }', async () => {
		const { provider, fetchMock } = setup(jsonResponse({ result: { CampaignId: 'c1' } }));
		await provider.setBid('c1', 1234);

		expect(sentRequest(fetchMock)).toEqual({
			url: `${BASE_URL}/json/v5/bids`,
			method: 'POST',
			authorization: `Bearer ${TOKEN}`,
			body: { method: 'set', params: { CampaignId: 'c1', Bid: 12_340_000 } },
		});
	});

	it('срезает завершающий / у baseUrl', async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ result: { Campaigns: [] } }));
		const provider = new MockProvider({ baseUrl: `${BASE_URL}//`, token: TOKEN, fetch: fetchMock });
		await provider.listCampaigns();

		expect(sentRequest(fetchMock).url).toBe(`${BASE_URL}/json/v5/campaigns`);
	});

	it.each([
		{
			name: 'setDailyBudget',
			run: (provider: MockProvider) => provider.setDailyBudget('c1', 300_000),
			body: { method: 'update', params: { CampaignId: 'c1', DailyBudget: 3_000_000_000 } },
		},
		{
			name: 'suspend',
			run: (provider: MockProvider) => provider.suspend('c1'),
			body: { method: 'suspend', params: { CampaignId: 'c1' } },
		},
		{
			name: 'resume',
			run: (provider: MockProvider) => provider.resume('c1'),
			body: { method: 'resume', params: { CampaignId: 'c1' } },
		},
	])('$name → campaigns', async ({ run, body }) => {
		const { provider, fetchMock } = setup(jsonResponse({ result: { Id: 'c1' } }));
		await run(provider);

		const request = sentRequest(fetchMock);
		expect(request.url).toBe(`${BASE_URL}/json/v5/campaigns`);
		expect(request.body).toEqual(body);
	});

	it('listCampaigns отправляет campaigns.get без params', async () => {
		const { provider, fetchMock } = setup(jsonResponse({ result: { Campaigns: [] } }));
		await provider.listCampaigns();

		expect(sentRequest(fetchMock).body).toEqual({ method: 'get' });
	});

	it('getReport без фильтров не отправляет params', async () => {
		const { provider, fetchMock } = setup(jsonResponse({ result: { CurrentTick: 0, Rows: [] } }));
		await provider.getReport();

		expect(sentRequest(fetchMock)).toMatchObject({ url: `${BASE_URL}/json/v5/reports`, body: { method: 'get' } });
	});

	it('getReport передаёт фильтры в params', async () => {
		const { provider, fetchMock } = setup(jsonResponse({ result: { CurrentTick: 5, Rows: [] } }));
		await provider.getReport({ campaignIds: ['c1', 'c2'], fromTick: 2, toTick: 5 });

		expect(sentRequest(fetchMock).body).toEqual({
			method: 'get',
			params: { CampaignIds: ['c1', 'c2'], FromTick: 2, ToTick: 5 },
		});
	});
});

describe('MockProvider — ответы', () => {
	it('listCampaigns переводит микроединицы в копейки', async () => {
		const { provider } = setup(jsonResponse({ result: { Campaigns: [directCampaign] } }));

		await expect(provider.listCampaigns()).resolves.toEqual([
			{ id: 'c1', name: 'Хорошая', state: 'ON', bid: 2_000, dailyBudget: 300_000, targetCpo: 100_000 },
		]);
	});

	it('getReport переводит деньги в копейки, Conversions → orders', async () => {
		const { provider } = setup(jsonResponse({ result: { CurrentTick: 3, Rows: [directRow] } }));

		await expect(provider.getReport()).resolves.toEqual({
			currentTick: 3,
			rows: [{ campaignId: 'c1', tick: 3, impressions: 200, clicks: 10, orders: 1, cost: 20_000, bid: 2_000 }],
		});
	});

	it('копейки → микроединицы → копейки без потерь', async () => {
		const kopecks = 123_457;
		const { provider, fetchMock } = setup(jsonResponse({ result: { CampaignId: 'c1' } }));
		await provider.setBid('c1', kopecks);
		const { body } = sentRequest(fetchMock);
		const sentBid = (body as { params: { Bid: number } }).params.Bid;

		const echo = setup(jsonResponse({ result: { Campaigns: [{ ...directCampaign, Bid: sentBid }] } }));
		const [campaign] = await echo.provider.listCampaigns();
		expect(campaign?.bid).toBe(kopecks);
	});
});

describe('MockProvider — ошибки', () => {
	it.each([
		{ status: 400, code: 'bad_request' },
		{ status: 401, code: 'unauthorized' },
		{ status: 404, code: 'not_found' },
		{ status: 409, code: 'conflict' },
	])('$status → $code с текстом мока', async ({ status, code }) => {
		const message = `ошибка ${status}`;
		const { provider } = setup(jsonResponse({ error: { error_code: status, error_string: message } }, status));

		await expectAdsError(provider.setBid('c1', 1_000), code, message);
	});

	it('500 → unavailable', async () => {
		const { provider } = setup(jsonResponse({ error: { error_code: 500, error_string: 'Внутренняя ошибка мока' } }, 500));
		await expectAdsError(provider.listCampaigns(), 'unavailable');
	});

	it('ошибка без тела Директа → текст с HTTP-статусом', async () => {
		const { provider } = setup(new Response('Bad Gateway', { status: 502 }));
		await expectAdsError(provider.listCampaigns(), 'unavailable', 'HTTP 502');
	});

	it('сеть упала → unavailable', async () => {
		const { provider } = setup(async () => {
			throw new TypeError('fetch failed');
		});
		await expectAdsError(provider.listCampaigns(), 'unavailable', 'Мок недоступен');
	});

	it('таймаут → unavailable', async () => {
		const fetchMock = vi.fn<typeof fetch>(
			(_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
				}),
		);
		const provider = new MockProvider({ baseUrl: BASE_URL, token: TOKEN, fetch: fetchMock, timeoutMs: 10 });

		await expectAdsError(provider.listCampaigns(), 'unavailable', 'Мок не ответил за 10 мс');
	});

	it.each([
		{ name: 'не JSON', response: () => new Response('<html>', { status: 200 }) },
		{ name: 'нет result', response: () => jsonResponse({ Campaigns: [] }) },
		{ name: 'неизвестный State', response: () => jsonResponse({ result: { Campaigns: [{ ...directCampaign, State: 'ARCHIVED' }] } }) },
		{ name: 'сумма не кратна MICRO', response: () => jsonResponse({ result: { Campaigns: [{ ...directCampaign, Bid: 20_000_001 }] } }) },
	])('$name → invalid_response', async ({ response }) => {
		const { provider } = setup(response());
		await expectAdsError(provider.listCampaigns(), 'invalid_response');
	});
});

describe('createMockProviderFromEnv', () => {
	it('создаёт провайдер из переменных окружения', () => {
		expect(createMockProviderFromEnv({ MOCK_API_URL: BASE_URL, MOCK_API_TOKEN: TOKEN })).toBeInstanceOf(MockProvider);
	});

	it.each([
		{ name: 'без MOCK_API_URL', env: { MOCK_API_TOKEN: TOKEN } },
		{ name: 'без MOCK_API_TOKEN', env: { MOCK_API_URL: BASE_URL } },
		{ name: 'с пустым MOCK_API_TOKEN', env: { MOCK_API_URL: BASE_URL, MOCK_API_TOKEN: '' } },
		{ name: 'с невалидным MOCK_API_URL', env: { MOCK_API_URL: 'not a url', MOCK_API_TOKEN: TOKEN } },
	])('$name → ошибка конфигурации', ({ env }) => {
		expect(() => createMockProviderFromEnv(env)).toThrow(/MockProvider/);
	});
});
