// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { LLMClientError, type LLMRequest } from '@/lib/llm/types';
import {
	LLM_MAX_TOKENS,
	LLM_TEMPERATURE,
	YANDEX_LLM_BASE_URL,
	YandexLLMClient,
	type LLMResponseFormat,
} from '@/lib/llm/yandex-client';

const API_KEY = 'secret-key';
const FOLDER_ID = 'b1gfolder';
const MODEL_URI = `gpt://${FOLDER_ID}/yandexgpt/latest`;

const request: LLMRequest = {
	system: 'Ты агент',
	user: 'Метрики кампании',
	jsonSchema: { name: 'decision', schema: { type: 'object', properties: { action: { type: 'string' } } } },
};

function completion(content: string): Response {
	return Response.json({ choices: [{ message: { role: 'assistant', content } }], usage: { total_tokens: 42 } });
}

function setup(response: Response | (() => Promise<Response>), responseFormat?: LLMResponseFormat) {
	const fetchMock = vi.fn<typeof fetch>(typeof response === 'function' ? response : async () => response);
	const client = new YandexLLMClient({ apiKey: API_KEY, folderId: FOLDER_ID, modelUri: MODEL_URI, responseFormat, fetch: fetchMock });
	return { client, fetchMock };
}

function sentRequest(fetchMock: ReturnType<typeof setup>['fetchMock']) {
	const [url, init] = fetchMock.mock.calls[0] ?? [];
	const headers = new Headers(init?.headers);
	const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
	return { url, method: init?.method, headers, body };
}

async function expectLLMError(promise: Promise<unknown>, code: string, message?: string): Promise<void> {
	const error = await promise.catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(LLMClientError);
	expect(error).toMatchObject({ code, ...(message ? { message } : {}) });
}

describe('YandexLLMClient — запрос', () => {
	it('POST на /chat/completions с ключом, каталогом, моделью и JSON Schema', async () => {
		const { client, fetchMock } = setup(completion('{}'));
		await client.complete(request);

		const sent = sentRequest(fetchMock);
		expect(sent.url).toBe(`${YANDEX_LLM_BASE_URL}/chat/completions`);
		expect(sent.method).toBe('POST');
		expect(sent.headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
		expect(sent.headers.get('openai-project')).toBe(FOLDER_ID);
		expect(sent.body).toEqual({
			model: MODEL_URI,
			temperature: LLM_TEMPERATURE,
			max_tokens: LLM_MAX_TOKENS,
			messages: [
				{ role: 'system', content: 'Ты агент' },
				{ role: 'user', content: 'Метрики кампании' },
			],
			response_format: {
				type: 'json_schema',
				json_schema: { name: 'decision', schema: request.jsonSchema?.schema, strict: true },
			},
		});
	});

	it('режим json_object — response_format без схемы', async () => {
		const { client, fetchMock } = setup(completion('{}'), 'json_object');
		await client.complete(request);
		expect(sentRequest(fetchMock).body).toMatchObject({ response_format: { type: 'json_object' } });
	});

	it('режим text и запрос без схемы — без response_format', async () => {
		const textMode = setup(completion('{}'), 'text');
		await textMode.client.complete(request);
		expect(sentRequest(textMode.fetchMock).body).not.toHaveProperty('response_format');

		const noSchema = setup(completion('{}'));
		await noSchema.client.complete({ system: 's', user: 'u' });
		expect(sentRequest(noSchema.fetchMock).body).not.toHaveProperty('response_format');
	});
});

describe('YandexLLMClient — ответ', () => {
	it('возвращает текст модели и тело ответа целиком', async () => {
		const { client } = setup(completion('{"action":"HOLD"}'));
		const result = await client.complete(request);

		expect(result.content).toBe('{"action":"HOLD"}');
		expect(JSON.parse(result.raw)).toMatchObject({ usage: { total_tokens: 42 } });
	});

	it('401 → unauthorized с текстом сервиса', async () => {
		const { client } = setup(Response.json({ error: { message: 'Unknown api key' } }, { status: 401 }));
		await expectLLMError(client.complete(request), 'unauthorized', 'Unknown api key');
	});

	it('429 → rate_limited', async () => {
		const { client } = setup(new Response('Too many requests', { status: 429 }));
		await expectLLMError(client.complete(request), 'rate_limited', 'HTTP 429');
	});

	it('400 → bad_request', async () => {
		const { client } = setup(Response.json({ error: { message: 'bad schema' } }, { status: 400 }));
		await expectLLMError(client.complete(request), 'bad_request', 'bad schema');
	});

	it('5xx → unavailable', async () => {
		const { client } = setup(new Response('oops', { status: 503 }));
		await expectLLMError(client.complete(request), 'unavailable', 'HTTP 503');
	});

	it('сетевая ошибка → unavailable', async () => {
		const { client } = setup(async () => {
			throw new TypeError('fetch failed');
		});
		await expectLLMError(client.complete(request), 'unavailable', 'Модель недоступна');
	});

	it('таймаут → unavailable', async () => {
		const fetchMock = vi.fn<typeof fetch>(
			(_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
				}),
		);
		const client = new YandexLLMClient({ apiKey: API_KEY, folderId: FOLDER_ID, modelUri: MODEL_URI, fetch: fetchMock, timeoutMs: 10 });
		await expectLLMError(client.complete(request), 'unavailable', 'Модель не ответила за 10 мс');
	});

	it('тело не JSON → invalid_response', async () => {
		const { client } = setup(new Response('<html>gateway</html>', { status: 200 }));
		await expectLLMError(client.complete(request), 'invalid_response', 'Ответ модели — не JSON');
	});

	it('JSON без choices → invalid_response', async () => {
		const { client } = setup(Response.json({ result: 'ok' }));
		await expectLLMError(client.complete(request), 'invalid_response');
	});

	it('пустой choices → invalid_response', async () => {
		const { client } = setup(Response.json({ choices: [] }));
		await expectLLMError(client.complete(request), 'invalid_response');
	});
});
