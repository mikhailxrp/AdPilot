import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth';

describe('loginSchema', () => {
	it('принимает валидные данные', () => {
		const result = loginSchema.safeParse({ email: 'admin@example.com', password: 'password123' });
		expect(result.success).toBe(true);
	});

	it('отклоняет пустой email', () => {
		const result = loginSchema.safeParse({ email: '', password: 'password123' });
		expect(result.success).toBe(false);
	});

	it('отклоняет невалидный email', () => {
		const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
		expect(result.success).toBe(false);
	});

	it('отклоняет пароль короче 8 символов', () => {
		const result = loginSchema.safeParse({ email: 'admin@example.com', password: 'short' });
		expect(result.success).toBe(false);
	});
});
