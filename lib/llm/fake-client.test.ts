import { describe, expect, it } from 'vitest';
import { FakeLLMClient } from '@/lib/llm/fake-client';
import { LLMClientError } from '@/lib/llm/types';

describe('FakeLLMClient', () => {
	it('возвращает ответ ответчика как content и raw', async () => {
		const client = new FakeLLMClient(({ user }) => `ответ на ${user}`);
		await expect(client.complete({ system: 's', user: 'вопрос' })).resolves.toEqual({
			content: 'ответ на вопрос',
			raw: 'ответ на вопрос',
		});
	});

	it('выбрасывает заданную ошибку', async () => {
		const client = new FakeLLMClient(() => new LLMClientError('unavailable', 'нет связи'));
		await expect(client.complete({ system: 's', user: 'u' })).rejects.toMatchObject({ code: 'unavailable', message: 'нет связи' });
	});

	it('запоминает запросы по порядку', async () => {
		const client = new FakeLLMClient(() => '{}');
		await client.complete({ system: 's', user: 'первый' });
		await client.complete({ system: 's', user: 'второй' });
		expect(client.requests.map(({ user }) => user)).toEqual(['первый', 'второй']);
	});
});
