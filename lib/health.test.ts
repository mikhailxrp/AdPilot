import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkHealth } from './health';

const TEST_TIMEOUT_MS = 20;

describe('checkHealth', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('возвращает ok, если пинг успешен', async () => {
		const result = await checkHealth(() => Promise.resolve(1), TEST_TIMEOUT_MS);
		expect(result).toEqual({ status: 'ok' });
	});

	it('возвращает error и логирует ошибку, если пинг упал', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const failure = new Error('connect ECONNREFUSED postgresql://user:secret@db:5432/adpilot');

		const result = await checkHealth(() => Promise.reject(failure), TEST_TIMEOUT_MS);

		expect(result).toEqual({ status: 'error' });
		expect(consoleError).toHaveBeenCalledWith('health check failed:', failure);
	});

	it('возвращает error, если пинг не отвечает дольше таймаута', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await checkHealth(() => new Promise<never>(() => {}), TEST_TIMEOUT_MS);

		expect(result).toEqual({ status: 'error' });
	});

	it('не отдаёт текст ошибки в результате', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await checkHealth(() => Promise.reject(new Error('secret-connection-string')), TEST_TIMEOUT_MS);

		expect(JSON.stringify(result)).not.toContain('secret-connection-string');
	});
});
