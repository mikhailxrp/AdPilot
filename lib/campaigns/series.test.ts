import { describe, expect, it } from 'vitest';
import { buildCampaignSeries, type SeriesRow } from '@/lib/campaigns/series';

const BID = 2_000;

/** Строка тика: расход = 1 000, заказ на каждом чётном тике. */
function row(tick: number): SeriesRow {
	return { tick, impressions: 100, clicks: 10, orders: tick % 2 === 0 ? 1 : 0, cost: 1_000, bid: BID };
}

function rows(count: number): SeriesRow[] {
	return Array.from({ length: count }, (_, i) => row(i + 1));
}

describe('buildCampaignSeries', () => {
	it('0 тиков → пустой массив', () => {
		expect(buildCampaignSeries([], 4, 0)).toEqual([]);
	});

	it('точка на каждый тик со ставкой и расходом', () => {
		const series = buildCampaignSeries(rows(3), 4, 3);

		expect(series.map((point) => point.tick)).toEqual([1, 2, 3]);
		expect(series.every((point) => point.bid === BID && point.cost === 1_000)).toBe(true);
	});

	it('CPO по окну считается только по тикам внутри окна', () => {
		// окно 2 на тике 4: тики 3–4 → расход 2 000, заказ 1
		const series = buildCampaignSeries(rows(4), 2, 4);

		expect(series[3].windowCpo).toBe(2_000);
		// окно 2 на тике 2: тики 1–2 → расход 2 000, заказ 1
		expect(series[1].windowCpo).toBe(2_000);
	});

	it('в окне нет заказов → CPO = null', () => {
		// окно 1 на нечётном тике: заказов нет
		const series = buildCampaignSeries(rows(3), 1, 3);

		expect(series[0].windowCpo).toBeNull();
		expect(series[2].windowCpo).toBeNull();
		expect(series[1].windowCpo).toBe(1_000);
	});

	it('пропущенный тик → ставка и расход null, окно — по имеющимся строкам', () => {
		const withGap = rows(4).filter((r) => r.tick !== 3);
		const series = buildCampaignSeries(withGap, 2, 4);

		expect(series[2]).toMatchObject({ tick: 3, bid: null, cost: null });
		// окно на тике 4: только тик 4 → расход 1 000, заказ 1
		expect(series[3].windowCpo).toBe(1_000);
	});

	it('окно больше числа тиков → берутся все тики', () => {
		// тики 1–4: расход 4 000, заказов 2
		const series = buildCampaignSeries(rows(4), 100, 4);

		expect(series[3].windowCpo).toBe(2_000);
	});
});
