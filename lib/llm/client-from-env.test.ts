// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createLLMClientFromEnv, defaultModelUri, FAKE_HOLD_ANSWER, llmClientKindFromEnv } from '@/lib/llm/client-from-env';
import { FakeLLMClient } from '@/lib/llm/fake-client';
import { YandexLLMClient } from '@/lib/llm/yandex-client';

const yandexEnv = { YANDEX_API_KEY: 'key', YANDEX_FOLDER_ID: 'b1gfolder' };

async function sentModel(env: Record<string, string | undefined>): Promise<unknown> {
	const fetchMock = vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(Response.json({ choices: [{ message: { content: '{}' } }] }));
	try {
		await createLLMClientFromEnv(env).complete({ system: 's', user: 'u' });
		const init = fetchMock.mock.calls[0]?.[1];
		const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
		return body && typeof body === 'object' && 'model' in body ? body.model : undefined;
	} finally {
		fetchMock.mockRestore();
	}
}

describe('llmClientKindFromEnv', () => {
	it('пусто → yandex, fake → fake', () => {
		expect(llmClientKindFromEnv({})).toBe('yandex');
		expect(llmClientKindFromEnv({ LLM_CLIENT: '' })).toBe('yandex');
		expect(llmClientKindFromEnv({ LLM_CLIENT: 'fake' })).toBe('fake');
	});

	it('неизвестное значение — ошибка', () => {
		expect(() => llmClientKindFromEnv({ LLM_CLIENT: 'openai' })).toThrow(/LLM_CLIENT должен быть yandex или fake/);
	});
});

describe('createLLMClientFromEnv', () => {
	it('fake создаётся без ключей и отвечает HOLD', async () => {
		const client = createLLMClientFromEnv({ LLM_CLIENT: 'fake' });
		expect(client).toBeInstanceOf(FakeLLMClient);
		await expect(client.complete({ system: 's', user: 'u' })).resolves.toMatchObject({ content: FAKE_HOLD_ANSWER });
	});

	it('по умолчанию — yandex', () => {
		expect(createLLMClientFromEnv(yandexEnv)).toBeInstanceOf(YandexLLMClient);
	});

	it('yandex без YANDEX_API_KEY — понятная ошибка', () => {
		expect(() => createLLMClientFromEnv({ YANDEX_FOLDER_ID: 'b1gfolder' })).toThrow(/Не задан YANDEX_API_KEY/);
	});

	it('неизвестный LLM_CLIENT — ошибка', () => {
		expect(() => createLLMClientFromEnv({ ...yandexEnv, LLM_CLIENT: 'openai' })).toThrow(/LLM_CLIENT должен быть yandex или fake/);
	});

	it('URI модели по умолчанию собирается из каталога, заданный — берётся как есть', async () => {
		await expect(sentModel(yandexEnv)).resolves.toBe(defaultModelUri('b1gfolder'));
		await expect(sentModel({ ...yandexEnv, LLM_MODEL_URI: '' })).resolves.toBe('gpt://b1gfolder/aliceai-llm/latest');
		await expect(sentModel({ ...yandexEnv, LLM_MODEL_URI: 'gpt://b1gfolder/yandexgpt-lite/latest' })).resolves.toBe(
			'gpt://b1gfolder/yandexgpt-lite/latest',
		);
	});
});
