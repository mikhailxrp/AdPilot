import { describe, expect, it } from 'vitest';
import type { AdsCampaign, AdsReportRow } from '@/lib/ads/types';
import { aggregateWindow, buildSnapshot } from '@/lib/agent/window';
import { computeMetrics } from '@/lib/metrics/metrics';

const CAMPAIGN: AdsCampaign = {
	id: 'c1',
	name: 'Хорошая',
	state: 'ON',
	bid: 2_000,
	dailyBudget: 300_000,
	targetCpo: 100_000,
};

/** Строка тика: показы = 100, клики = 10, заказ на каждом чётном тике, расход = tick × 1 000. */
function row(tick: number): AdsReportRow {
	return {
		campaignId: CAMPAIGN.id,
		tick,
		impressions: 100,
		clicks: 10,
		orders: tick % 2 === 0 ? 1 : 0,
		cost: tick * 1_000,
		bid: CAMPAIGN.bid,
	};
}

function rows(fromTick: number, toTick: number): AdsReportRow[] {
	return Array.from({ length: toTick - fromTick + 1 }, (_, i) => row(fromTick + i));
}

describe('aggregateWindow', () => {
	it('суммирует только тики окна (currentTick − ticks, currentTick]', () => {
		expect(aggregateWindow(rows(1, 10), 10, 3)).toEqual({
			impressions: 300,
			clicks: 30,
			orders: 2,
			cost: 27_000,
		});
	});

	it('тики после currentTick не попадают', () => {
		expect(aggregateWindow(rows(1, 12), 10, 3).cost).toBe(27_000);
	});

	it('пустой отчёт — нули', () => {
		expect(aggregateWindow([], 10, 6)).toEqual({ impressions: 0, clicks: 0, orders: 0, cost: 0 });
	});

	it('окно длиннее истории — берётся вся история', () => {
		expect(aggregateWindow(rows(1, 4), 4, 100)).toEqual({ impressions: 400, clicks: 40, orders: 2, cost: 10_000 });
	});
});

describe('buildSnapshot', () => {
	it('окно, метрики по окну и расход за последние 24 тика', () => {
		const snapshot = buildSnapshot(CAMPAIGN, rows(1, 30), 30, 6);
		const expectedWindow = aggregateWindow(rows(25, 30), 30, 6);

		expect(snapshot.campaign).toBe(CAMPAIGN);
		expect(snapshot.currentTick).toBe(30);
		expect(snapshot.window).toEqual(expectedWindow);
		expect(snapshot.metrics).toEqual(computeMetrics(expectedWindow));
		// тики 7..30: (7 + 30) × 24 / 2 × 1 000
		expect(snapshot.daySpend).toBe(444_000);
	});
});
