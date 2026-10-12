import { describe, expect, it } from 'vitest';
import { kopecksToRub, rubToKopecks } from '@/lib/metrics/money';

describe('kopecksToRub', () => {
	it('копейки → рубли', () => {
		expect(kopecksToRub(123_450)).toBe(1234.5);
		expect(kopecksToRub(1)).toBe(0.01);
	});
});

describe('rubToKopecks', () => {
	it('рубли → копейки', () => {
		expect(rubToKopecks(1234.5)).toBe(123_450);
		expect(rubToKopecks(16)).toBe(1_600);
	});

	it('дробные копейки округляются до целых', () => {
		expect(rubToKopecks(12.345)).toBe(1_235);
		expect(rubToKopecks(0.1 + 0.2)).toBe(30);
		expect(Number.isInteger(rubToKopecks(19.99))).toBe(true);
	});
});
