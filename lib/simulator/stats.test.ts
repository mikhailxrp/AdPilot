import { describe, expect, it } from 'vitest';
import { spentToday, sumTickStats } from '@/lib/simulator/stats';

describe('sumTickStats', () => {
	it('пустой массив даёт нули', () => {
		expect(sumTickStats([])).toEqual({ impressions: 0, clicks: 0, orders: 0, cost: 0 });
	});

	it('складывает все поля по тикам', () => {
		const rows = [
			{ impressions: 200, clicks: 10, orders: 1, cost: 20_000 },
			{ impressions: 180, clicks: 8, orders: 0, cost: 16_000 },
		];
		expect(sumTickStats(rows)).toEqual({ impressions: 380, clicks: 18, orders: 1, cost: 36_000 });
	});
});

describe('spentToday', () => {
	const rows = [
		{ tick: 1, cost: 100 },
		{ tick: 2, cost: 200 },
		{ tick: 24, cost: 400 },
		{ tick: 25, cost: 800 },
	];

	it('на первом тике суток расход равен нулю', () => {
		expect(spentToday(rows, 1)).toBe(0);
	});

	it('суммирует тики текущих суток до заданного', () => {
		expect(spentToday(rows, 3)).toBe(300);
	});

	it('новые сутки обнуляют остаток: тики 1–24 не учитываются', () => {
		expect(spentToday(rows, 25)).toBe(0);
	});

	it('на тике 26 учитывается только тик 25', () => {
		expect(spentToday(rows, 26)).toBe(800);
	});
});
