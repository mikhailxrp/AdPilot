// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MemoryProvider } from '@/lib/ads/memory-provider';
import { AdsProviderError, type AdsCampaign, type AdsReportRow } from '@/lib/ads/types';

const CAMPAIGNS: AdsCampaign[] = [
	{ id: 'c1', name: 'Первая', state: 'ON', bid: 2_000, dailyBudget: 300_000, targetCpo: 100_000 },
	{ id: 'c2', name: 'Вторая', state: 'ON', bid: 1_000, dailyBudget: 200_000, targetCpo: 80_000 },
];

function row(campaignId: string, tick: number): AdsReportRow {
	return { campaignId, tick, impressions: 100, clicks: 10, orders: 1, cost: 5_000, bid: 2_000 };
}

function setup() {
	return new MemoryProvider({
		campaigns: CAMPAIGNS,
		rows: [row('c1', 1), row('c1', 2), row('c1', 3), row('c2', 2)],
		currentTick: 3,
	});
}

describe('MemoryProvider', () => {
	it('изменения видны в listCampaigns, исходные данные не мутируются', async () => {
		const provider = setup();
		await provider.setBid('c1', 1_600);
		await provider.setDailyBudget('c1', 360_000);
		await provider.suspend('c2');

		const campaigns = await provider.listCampaigns();
		expect(campaigns[0]).toMatchObject({ bid: 1_600, dailyBudget: 360_000, state: 'ON' });
		expect(campaigns[1]).toMatchObject({ state: 'SUSPENDED' });
		expect(CAMPAIGNS[0]?.bid).toBe(2_000);

		await provider.resume('c2');
		expect((await provider.listCampaigns())[1]?.state).toBe('ON');
	});

	it('getReport фильтрует по кампаниям и тикам включительно', async () => {
		const provider = setup();
		const report = await provider.getReport({ campaignIds: ['c1'], fromTick: 2, toTick: 3 });
		expect(report.currentTick).toBe(3);
		expect(report.rows.map((item) => [item.campaignId, item.tick])).toEqual([
			['c1', 2],
			['c1', 3],
		]);
	});

	it('без запроса getReport отдаёт все строки', async () => {
		expect((await setup().getReport()).rows).toHaveLength(4);
	});

	it('addRows сдвигает currentTick', async () => {
		const provider = setup();
		provider.addRows([row('c1', 4)]);
		expect((await provider.getReport()).currentTick).toBe(4);
	});

	it('неизвестная кампания → not_found', async () => {
		const error = await setup()
			.setBid('nope', 1)
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(AdsProviderError);
		expect(error).toMatchObject({ code: 'not_found' });
	});

	it('failures: метод бросает заданную ошибку, остальные работают', async () => {
		const provider = setup();
		provider.failures.suspend = new AdsProviderError('unavailable', 'Кабинет недоступен');

		await expect(provider.suspend('c1')).rejects.toMatchObject({ code: 'unavailable' });
		await expect(provider.listCampaigns()).resolves.toHaveLength(2);
	});
});
