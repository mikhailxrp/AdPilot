import { describe, expect, it } from 'vitest';
import { createRng, deriveTickSeed } from '@/lib/simulator/rng';

const SAMPLE_SIZE = 1000;

function take(seed: number, count: number): number[] {
	const rng = createRng(seed);
	return Array.from({ length: count }, () => rng());
}

describe('createRng', () => {
	it('тот же seed даёт ту же последовательность', () => {
		expect(take(42, 20)).toEqual(take(42, 20));
	});

	it('разные seed дают разные последовательности', () => {
		expect(take(42, 20)).not.toEqual(take(43, 20));
	});

	it('значения в [0, 1)', () => {
		for (const value of take(7, SAMPLE_SIZE)) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe('deriveTickSeed', () => {
	it('стабилен для одного входа', () => {
		expect(deriveTickSeed(42, 1, 'good')).toBe(deriveTickSeed(42, 1, 'good'));
	});

	it('меняется при смене любого аргумента', () => {
		const base = deriveTickSeed(42, 1, 'good');
		expect(deriveTickSeed(43, 1, 'good')).not.toBe(base);
		expect(deriveTickSeed(42, 2, 'good')).not.toBe(base);
		expect(deriveTickSeed(42, 1, 'bad')).not.toBe(base);
	});

	it('возвращает целое 32-битное без знака', () => {
		const seed = deriveTickSeed(42, 1, 'good');
		expect(Number.isInteger(seed)).toBe(true);
		expect(seed).toBeGreaterThanOrEqual(0);
		expect(seed).toBeLessThan(2 ** 32);
	});
});
