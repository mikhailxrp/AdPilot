import { describe, expect, it } from 'vitest';
import { buildDashboardSummary, cpoStatus } from '@/lib/dashboard/summary';

const TOLERANCE_PCT = 20;
const TARGET_CPO = 100_000; // 1000 ₽

function campaign(id: string, cost: number, orders: number) {
	return {
		id,
		name: `Кампания ${id}`,
		targetCpo: TARGET_CPO,
		totals: { impressions: 1000, clicks: 100, orders, cost },
	};
}

describe('buildDashboardSummary', () => {
	it('складывает расход и заказы по кампаниям', () => {
		const { totals } = buildDashboardSummary([campaign('a', 10_000, 1), campaign('b', 90_000, 9)], TOLERANCE_PCT);

		expect(totals.cost).toBe(100_000);
		expect(totals.orders).toBe(10);
	});

	it('средний CPO взвешенный: общий расход / общие заказы', () => {
		// 100 ₽ / 1 заказ и 900 ₽ / 9 заказов → 1000 ₽ / 10 = 100 ₽ (а не среднее CPO кампаний)
		const { totals } = buildDashboardSummary([campaign('a', 10_000, 1), campaign('b', 90_000, 9)], TOLERANCE_PCT);

		expect(totals.cpo).toBe(10_000);
	});

	it('0 заказов → средний CPO null', () => {
		const { totals } = buildDashboardSummary([campaign('a', 5_000, 0)], TOLERANCE_PCT);

		expect(totals.cpo).toBeNull();
	});

	it('пустой список кампаний → нули и null', () => {
		expect(buildDashboardSummary([], TOLERANCE_PCT)).toEqual({
			totals: { cost: 0, orders: 0, cpo: null },
			campaigns: [],
		});
	});

	it('строка кампании: CPO, цель, допустимый CPO и статус', () => {
		const { campaigns } = buildDashboardSummary([campaign('a', 330_000, 3)], TOLERANCE_PCT);

		expect(campaigns).toEqual([
			{
				id: 'a',
				name: 'Кампания a',
				targetCpo: TARGET_CPO,
				allowedCpo: 120_000,
				cpo: 110_000,
				status: 'WITHIN_TOLERANCE',
			},
		]);
	});
});

describe('cpoStatus', () => {
	it('CPO ровно = цели → в цели', () => {
		expect(cpoStatus(TARGET_CPO * 2, 2, TARGET_CPO, TOLERANCE_PCT)).toBe('WITHIN_TARGET');
	});

	it('CPO ровно = допустимому → в допуске', () => {
		expect(cpoStatus(120_000, 1, TARGET_CPO, TOLERANCE_PCT)).toBe('WITHIN_TOLERANCE');
	});

	it('CPO на копейку выше допустимого → выше допуска', () => {
		expect(cpoStatus(120_001, 1, TARGET_CPO, TOLERANCE_PCT)).toBe('OVER_TOLERANCE');
	});

	it('заказов нет → нет данных', () => {
		expect(cpoStatus(500_000, 0, TARGET_CPO, TOLERANCE_PCT)).toBe('NO_DATA');
	});
});
