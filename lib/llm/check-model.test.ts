import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkModel } from '@/lib/llm/check-model';
import { FakeLLMClient } from '@/lib/llm/fake-client';
import { LLMClientError } from '@/lib/llm/types';

describe('checkModel', () => {
	afterEach(() => vi.restoreAllMocks());

	it('ответ модели → ok и время', async () => {
		const client = new FakeLLMClient(() => 'ok');

		const result = await checkModel(client);

		expect(result.ok).toBe(true);
		expect(result.ms).toBeGreaterThanOrEqual(0);
		expect(client.requests).toHaveLength(1);
		expect(client.requests[0]?.jsonSchema).toBeUndefined();
	});

	it('LLMClientError → ok: false с его кодом и текстом', async () => {
		const client = new FakeLLMClient(() => new LLMClientError('unauthorized', 'Неверный ключ'));

		expect(await checkModel(client)).toMatchObject({ ok: false, code: 'unauthorized', message: 'Неверный ключ' });
	});

	it('неизвестная ошибка → code unknown, без падения', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const client = {
			complete: async () => {
				throw new TypeError('boom');
			},
		};

		expect(await checkModel(client)).toMatchObject({ ok: false, code: 'unknown' });
	});
});
