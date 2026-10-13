import { describe, expect, it } from 'vitest';
import type { AdsCampaign } from '@/lib/ads/types';
import { allowedCpo, decideByRules } from '@/lib/agent/engines/rules';
import type { CampaignSnapshot, RulesConfig } from '@/lib/agent/types';
import { formatRub } from '@/lib/metrics/format';
import { computeMetrics, type MetricsInput } from '@/lib/metrics/metrics';

const CONFIG: RulesConfig = {
	minClicks: 30,
	maxStepPct: 20,
	maxDailyBudget: 1_000_000,
	cooldownTicks: 3,
	cpoTolerancePct: 20,
	windowTicks: 6,
};

const CAMPAIGN: AdsCampaign = {
	id: 'c1',
	name: 'Кампания',
	state: 'ON',
	bid: 2_000,
	dailyBudget: 300_000,
	targetCpo: 100_000, // допустимый CPO при допуске 20% — 120 000
};

interface SnapshotOverrides {
	campaign?: Partial<AdsCampaign>;
	window?: Partial<MetricsInput>;
	daySpend?: number;
}

function snapshot({ campaign, window, daySpend = 0 }: SnapshotOverrides = {}): CampaignSnapshot {
	const stats: MetricsInput = { impressions: 1_000, clicks: 50, orders: 1, cost: 50_000, ...window };
	return {
		campaign: { ...CAMPAIGN, ...campaign },
		currentTick: 10,
		window: stats,
		metrics: computeMetrics(stats),
		daySpend,
	};
}

describe('decideByRules', () => {
	it('кампания на паузе → HOLD', () => {
		const result = decideByRules(snapshot({ campaign: { state: 'SUSPENDED' } }), CONFIG);
		expect(result).toMatchObject({ action: 'HOLD', after: null });
		expect(result.reason).toContain('на паузе');
	});

	it('кликов меньше minClicks → WAIT_DATA', () => {
		const result = decideByRules(snapshot({ window: { clicks: 29 } }), CONFIG);
		expect(result).toMatchObject({ action: 'WAIT_DATA', after: null });
		expect(result.reason).toContain('29');
		expect(result.reason).toContain('30');
	});

	it('ровно minClicks — данных достаточно', () => {
		expect(decideByRules(snapshot({ window: { clicks: 30 } }), CONFIG).action).not.toBe('WAIT_DATA');
	});

	it('нет заказов, расход ≥ допустимого CPO → PAUSE', () => {
		const result = decideByRules(snapshot({ window: { orders: 0, cost: 120_000 } }), CONFIG);
		expect(result).toMatchObject({ action: 'PAUSE', after: null });
		expect(result.reason).toContain(formatRub(120_000));
	});

	it('нет заказов, расход меньше допустимого CPO → WAIT_DATA', () => {
		const result = decideByRules(snapshot({ window: { orders: 0, cost: 119_999 } }), CONFIG);
		expect(result).toMatchObject({ action: 'WAIT_DATA', after: null });
		expect(result.reason).toContain(formatRub(119_999));
	});

	it('CPO выше допустимого → LOWER_BID на maxStepPct', () => {
		const result = decideByRules(snapshot({ window: { orders: 1, cost: 150_000 } }), CONFIG);
		expect(result).toMatchObject({ action: 'LOWER_BID', after: 1_600 });
		expect(result.reason).toContain(formatRub(150_000));
		expect(result.reason).toContain(formatRub(1_600));
	});

	it('снижение ставки округляется вверх — шаг не превышает лимит', () => {
		const result = decideByRules(
			snapshot({ campaign: { bid: 1_999 }, window: { orders: 1, cost: 150_000 } }),
			CONFIG,
		);
		// 1 999 × 0,8 = 1 599,2
		expect(result).toMatchObject({ action: 'LOWER_BID', after: 1_600 });
	});

	it('CPO ровно на границе допуска — ставку не снижает', () => {
		const result = decideByRules(snapshot({ window: { orders: 1, cost: 120_000 } }), CONFIG);
		expect(result.action).toBe('HOLD');
	});

	it('ставку снизить некуда → HOLD', () => {
		const result = decideByRules(snapshot({ campaign: { bid: 1 }, window: { orders: 1, cost: 150_000 } }), CONFIG);
		expect(result).toMatchObject({ action: 'HOLD', after: null });
		expect(result.reason).toContain('снизить некуда');
	});

	it('CPO не выше цели и бюджет выбран на 90% → RAISE_BUDGET на maxStepPct', () => {
		const result = decideByRules(snapshot({ window: { orders: 2, cost: 100_000 }, daySpend: 270_000 }), CONFIG);
		expect(result).toMatchObject({ action: 'RAISE_BUDGET', after: 360_000 });
		expect(result.reason).toContain(formatRub(270_000));
		expect(result.reason).toContain(formatRub(360_000));
	});

	it('CPO ровно равен цели — бюджет повышается', () => {
		const result = decideByRules(snapshot({ window: { orders: 1, cost: 100_000 }, daySpend: 300_000 }), CONFIG);
		expect(result.action).toBe('RAISE_BUDGET');
	});

	it('повышение бюджета упирается в потолок → maxDailyBudget', () => {
		const result = decideByRules(
			snapshot({ campaign: { dailyBudget: 900_000 }, window: { orders: 2, cost: 100_000 }, daySpend: 900_000 }),
			CONFIG,
		);
		expect(result).toMatchObject({ action: 'RAISE_BUDGET', after: 1_000_000 });
	});

	it('бюджет уже на потолке → HOLD', () => {
		const result = decideByRules(
			snapshot({ campaign: { dailyBudget: 1_000_000 }, window: { orders: 2, cost: 100_000 }, daySpend: 1_000_000 }),
			CONFIG,
		);
		expect(result).toMatchObject({ action: 'HOLD', after: null });
		expect(result.reason).toContain('потолке');
	});

	it('CPO не выше цели, бюджет не выбран → HOLD', () => {
		const result = decideByRules(snapshot({ window: { orders: 2, cost: 100_000 }, daySpend: 269_999 }), CONFIG);
		expect(result).toMatchObject({ action: 'HOLD', after: null });
		expect(result.reason).toContain(formatRub(50_000));
	});

	it('CPO в допуске, но выше цели — бюджет не повышается', () => {
		const result = decideByRules(snapshot({ window: { orders: 1, cost: 110_000 }, daySpend: 300_000 }), CONFIG);
		expect(result.action).toBe('HOLD');
	});
});

describe('allowedCpo', () => {
	it('цель + допуск: 1000 ₽ + 20% → 1200 ₽', () => {
		expect(allowedCpo(100_000, 20)).toBe(120_000);
	});

	it('допуск 0 → цель', () => {
		expect(allowedCpo(100_000, 0)).toBe(100_000);
	});
});
