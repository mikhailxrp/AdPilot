import { describe, expect, it } from 'vitest';
import { AUTH_SECRET_MIN_LENGTH, productionEnvSchema } from './production-env';

const validEnv = {
	AUTH_SECRET: 'a'.repeat(AUTH_SECRET_MIN_LENGTH),
	ADMIN_PASSWORD: 'strong-admin-password',
	POSTGRES_PASSWORD: 'strong-db-password',
	MOCK_API_TOKEN: 'strong-mock-token',
	AUTH_URL: 'https://adpilot.example.com',
};

function invalidKeys(env: Record<string, unknown>): string[] {
	const result = productionEnvSchema.safeParse(env);
	if (result.success) return [];
	return result.error.issues.map((issue) => String(issue.path[0]));
}

describe('productionEnvSchema', () => {
	it('принимает валидный набор', () => {
		expect(productionEnvSchema.safeParse(validEnv).success).toBe(true);
	});

	it.each(['AUTH_SECRET', 'ADMIN_PASSWORD', 'POSTGRES_PASSWORD', 'MOCK_API_TOKEN'])('отклоняет пустой %s', (key) => {
		expect(invalidKeys({ ...validEnv, [key]: '' })).toContain(key);
	});

	it('отклоняет отсутствующую переменную', () => {
		expect(invalidKeys({ ...validEnv, MOCK_API_TOKEN: undefined })).toContain('MOCK_API_TOKEN');
	});

	it.each(['change-me', 'Change-Me', '  change-me  '])('отклоняет заглушку «%s»', (placeholder) => {
		expect(invalidKeys({ ...validEnv, ADMIN_PASSWORD: placeholder })).toContain('ADMIN_PASSWORD');
		expect(invalidKeys({ ...validEnv, POSTGRES_PASSWORD: placeholder })).toContain('POSTGRES_PASSWORD');
		expect(invalidKeys({ ...validEnv, MOCK_API_TOKEN: placeholder })).toContain('MOCK_API_TOKEN');
	});

	it('отклоняет значение, в котором заглушка — часть строки', () => {
		expect(invalidKeys({ ...validEnv, AUTH_SECRET: 'change-me-change-me-change-me-1234' })).toContain('AUTH_SECRET');
		expect(invalidKeys({ ...validEnv, POSTGRES_PASSWORD: 'change-me1' })).toContain('POSTGRES_PASSWORD');
	});

	it('отклоняет AUTH_SECRET = change-me', () => {
		expect(invalidKeys({ ...validEnv, AUTH_SECRET: 'change-me' })).toContain('AUTH_SECRET');
	});

	it('отклоняет AUTH_SECRET короче 32 символов', () => {
		expect(invalidKeys({ ...validEnv, AUTH_SECRET: 'a'.repeat(AUTH_SECRET_MIN_LENGTH - 1) })).toContain('AUTH_SECRET');
	});

	it('отклоняет AUTH_URL на http://', () => {
		expect(invalidKeys({ ...validEnv, AUTH_URL: 'http://adpilot.example.com' })).toContain('AUTH_URL');
	});

	it('отклоняет AUTH_URL, который не URL', () => {
		expect(invalidKeys({ ...validEnv, AUTH_URL: 'adpilot.example.com' })).toContain('AUTH_URL');
	});

	it('пишет «не задан» для отсутствующих переменных', () => {
		const result = productionEnvSchema.safeParse({ ...validEnv, AUTH_URL: undefined, ADMIN_PASSWORD: undefined });
		const messages = result.error?.issues.map((issue) => issue.message) ?? [];
		expect(messages.filter((message) => message === 'не задан')).toHaveLength(2);
	});

	it('собирает все ошибки сразу', () => {
		const keys = invalidKeys({ ...validEnv, AUTH_SECRET: 'change-me', ADMIN_PASSWORD: '', AUTH_URL: 'http://x.ru' });
		expect(keys).toEqual(expect.arrayContaining(['AUTH_SECRET', 'ADMIN_PASSWORD', 'AUTH_URL']));
	});

	it('не кладёт значения секретов в сообщения', () => {
		const result = productionEnvSchema.safeParse({ ...validEnv, AUTH_SECRET: 'short-secret-value' });
		expect(JSON.stringify(result.error?.issues)).not.toContain('short-secret-value');
	});
});
