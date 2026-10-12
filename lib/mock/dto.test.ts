import { describe, expect, it } from 'vitest';
import {
	directError,
	directResult,
	kopecksToMicro,
	toDirectCampaign,
	toDirectReportRow,
	type CampaignSource,
	type TickStatsSource,
} from '@/lib/mock/dto';

const HIDDEN_KEYS = ['ctr', 'cr', 'bidSensitivity', 'baseImpressions', 'referenceBid', 'degradeFromTick', 'degradedCr', 'truth'];

// В реальных данных рядом с кампанией могут оказаться скрытые поля — маппер обязан их отбросить
const campaign = {
	id: 'c1',
	name: 'Хорошая',
	state: 'ON',
	bid: 2_000,
	dailyBudget: 300_000,
	targetCpo: 100_000,
	truth: { ctr: 0.05, cr: 0.08, bidSensitivity: 0.8, baseImpressions: 200 },
	ctr: 0.05,
	cr: 0.08,
	bidSensitivity: 0.8,
} satisfies CampaignSource & Record<string, unknown>;

const stats = {
	campaignId: 'c1',
	tick: 3,
	impressions: 200,
	clicks: 10,
	orders: 1,
	cost: 20_000,
	bid: 2_000,
	ctr: 0.05,
	cr: 0.08,
} satisfies TickStatsSource & Record<string, unknown>;

describe('kopecksToMicro', () => {
	it('копейки × 10 000', () => {
		expect(kopecksToMicro(0)).toBe(0);
		expect(kopecksToMicro(2_000)).toBe(20_000_000);
	});
});

describe('toDirectCampaign', () => {
	it('переводит деньги в микроединицы и переименовывает поля', () => {
		expect(toDirectCampaign(campaign)).toEqual({
			Id: 'c1',
			Name: 'Хорошая',
			State: 'ON',
			Bid: 20_000_000,
			DailyBudget: 3_000_000_000,
			TargetCpo: 1_000_000_000,
		});
	});

	it('не отдаёт скрытые параметры', () => {
		const keys = Object.keys(toDirectCampaign(campaign));

		for (const hidden of HIDDEN_KEYS) expect(keys).not.toContain(hidden);
		expect(keys).toEqual(['Id', 'Name', 'State', 'Bid', 'DailyBudget', 'TargetCpo']);
	});

	it('сохраняет состояние SUSPENDED', () => {
		expect(toDirectCampaign({ ...campaign, state: 'SUSPENDED' }).State).toBe('SUSPENDED');
	});
});

describe('toDirectReportRow', () => {
	it('orders → Conversions, cost и bid в микроединицах', () => {
		expect(toDirectReportRow(stats)).toEqual({
			CampaignId: 'c1',
			Tick: 3,
			Impressions: 200,
			Clicks: 10,
			Conversions: 1,
			Cost: 200_000_000,
			Bid: 20_000_000,
		});
	});

	it('не отдаёт скрытые параметры', () => {
		const keys = Object.keys(toDirectReportRow(stats));

		for (const hidden of HIDDEN_KEYS) expect(keys).not.toContain(hidden);
	});
});

describe('directResult / directError', () => {
	it('успех: { result }, статус 200', async () => {
		const response = directResult({ Id: 'c1' });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ result: { Id: 'c1' } });
	});

	it('ошибка: { error: { error_code, error_string } } и статус', async () => {
		const response = directError(404, 'Кампания не найдена');

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: { error_code: 404, error_string: 'Кампания не найдена' } });
	});
});
