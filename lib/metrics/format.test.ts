import { describe, expect, it } from 'vitest';
import { formatPercent, formatRub, NO_DATA } from '@/lib/metrics/format';

// Intl для ru-RU ставит неразрывные пробелы
const NBSP = ' ';

describe('formatRub', () => {
	it('null — «нет данных»', () => {
		expect(formatRub(null)).toBe(NO_DATA);
	});

	it('переводит копейки в рубли с двумя знаками', () => {
		expect(formatRub(12_345)).toBe(`123,45${NBSP}₽`);
		expect(formatRub(123_456)).toBe(`1${NBSP}234,56${NBSP}₽`);
	});

	it('округляет дробные копейки', () => {
		expect(formatRub(10_000 / 3)).toBe(`33,33${NBSP}₽`);
	});

	it('0 — это 0 ₽, а не «нет данных»', () => {
		expect(formatRub(0)).toBe(`0,00${NBSP}₽`);
	});
});

describe('formatPercent', () => {
	it('null — «нет данных»', () => {
		expect(formatPercent(null)).toBe(NO_DATA);
	});

	it('переводит долю в проценты', () => {
		expect(formatPercent(0.034)).toBe(`3,4${NBSP}%`);
		expect(formatPercent(0.05)).toBe(`5${NBSP}%`);
	});

	it('0 — это 0 %, а не «нет данных»', () => {
		expect(formatPercent(0)).toBe(`0${NBSP}%`);
	});
});
