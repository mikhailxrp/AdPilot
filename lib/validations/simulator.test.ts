import { describe, expect, it } from 'vitest';
import { resetSchema, SEED_MAX } from '@/lib/validations/simulator';

describe('resetSchema', () => {
	it('принимает число и числовую строку', () => {
		expect(resetSchema.safeParse({ seed: 42 })).toMatchObject({ success: true, data: { seed: 42 } });
		expect(resetSchema.safeParse({ seed: '42' })).toMatchObject({ success: true, data: { seed: 42 } });
	});

	it('принимает границы 0 и SEED_MAX', () => {
		expect(resetSchema.safeParse({ seed: 0 }).success).toBe(true);
		expect(resetSchema.safeParse({ seed: String(SEED_MAX) }).success).toBe(true);
	});

	it.each([-1, 1.5, 'abc', '', '  ', SEED_MAX + 1, '1.5', '-3'])('отклоняет %j', (seed) => {
		expect(resetSchema.safeParse({ seed }).success).toBe(false);
	});

	it('отклоняет отсутствующий seed', () => {
		expect(resetSchema.safeParse({}).success).toBe(false);
	});
});
