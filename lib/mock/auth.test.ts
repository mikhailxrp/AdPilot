import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAuthorized, requireMockToken } from '@/lib/mock/auth';

const TOKEN = 'secret-token-123';

describe('isAuthorized', () => {
	it('верный токен → доступ', () => {
		expect(isAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
	});

	it('схема Bearer не зависит от регистра', () => {
		expect(isAuthorized(`bearer ${TOKEN}`, TOKEN)).toBe(true);
	});

	it.each([
		['нет заголовка', null],
		['пустой заголовок', ''],
		['не Bearer', `Basic ${TOKEN}`],
		['токен без схемы', TOKEN],
		['Bearer без токена', 'Bearer '],
		['неверный токен', 'Bearer wrong-token'],
		['префикс токена', `Bearer ${TOKEN.slice(0, -1)}`],
		['токен с хвостом', `Bearer ${TOKEN}x`],
	])('отказ: %s', (_name, header) => {
		expect(isAuthorized(header, TOKEN)).toBe(false);
	});

	it('токен не задан или пуст → отказ даже при совпадении', () => {
		expect(isAuthorized('Bearer ', '')).toBe(false);
		expect(isAuthorized('Bearer undefined', undefined)).toBe(false);
		expect(isAuthorized(`Bearer ${TOKEN}`, '')).toBe(false);
	});
});

describe('requireMockToken', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('без токена → ответ 401', async () => {
		vi.stubEnv('MOCK_API_TOKEN', TOKEN);

		const response = requireMockToken(new Request('http://localhost/api/mock'));

		expect(response?.status).toBe(401);
		expect((await response?.json()).error.error_code).toBe(401);
	});

	it('верный токен → null', () => {
		vi.stubEnv('MOCK_API_TOKEN', TOKEN);

		const request = new Request('http://localhost/api/mock', { headers: { authorization: `Bearer ${TOKEN}` } });

		expect(requireMockToken(request)).toBeNull();
	});

	it('MOCK_API_TOKEN не задан → 401', () => {
		vi.stubEnv('MOCK_API_TOKEN', '');

		const request = new Request('http://localhost/api/mock', { headers: { authorization: 'Bearer anything' } });

		expect(requireMockToken(request)?.status).toBe(401);
	});
});
