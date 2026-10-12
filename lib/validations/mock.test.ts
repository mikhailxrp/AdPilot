import { describe, expect, it } from 'vitest';
import {
	bidsRequestSchema,
	campaignsRequestSchema,
	MICRO,
	reportsRequestSchema,
} from '@/lib/validations/mock';

const rub = (value: number): number => value * 100 * MICRO;

describe('campaignsRequestSchema', () => {
	it('add: переводит микроединицы в копейки', () => {
		const result = campaignsRequestSchema.safeParse({
			method: 'add',
			params: { Name: ' Тест ', Bid: rub(20), DailyBudget: rub(3000), TargetCpo: rub(1000) },
		});

		expect(result.success).toBe(true);
		if (result.success && result.data.method === 'add') {
			expect(result.data.params).toEqual({ Name: 'Тест', Bid: 2_000, DailyBudget: 300_000, TargetCpo: 100_000 });
		}
	});

	it('get: params можно не передавать', () => {
		expect(campaignsRequestSchema.safeParse({ method: 'get' }).success).toBe(true);
		expect(campaignsRequestSchema.safeParse({ method: 'get', params: {} }).success).toBe(true);
	});

	it('update: бюджет в копейках', () => {
		const result = campaignsRequestSchema.safeParse({
			method: 'update',
			params: { CampaignId: 'c1', DailyBudget: rub(500) },
		});

		expect(result.success).toBe(true);
		if (result.success && result.data.method === 'update') {
			expect(result.data.params.DailyBudget).toBe(50_000);
		}
	});

	it('suspend и resume принимают CampaignId', () => {
		expect(campaignsRequestSchema.safeParse({ method: 'suspend', params: { CampaignId: 'c1' } }).success).toBe(true);
		expect(campaignsRequestSchema.safeParse({ method: 'resume', params: { CampaignId: 'c1' } }).success).toBe(true);
	});

	it.each([
		['неизвестный method', { method: 'delete', params: { CampaignId: 'c1' } }],
		['пустое тело', {}],
		['не объект', 'text'],
		['null', null],
		['нет CampaignId', { method: 'suspend', params: {} }],
		['пустой CampaignId', { method: 'suspend', params: { CampaignId: '  ' } }],
		['отрицательный бюджет', { method: 'update', params: { CampaignId: 'c1', DailyBudget: -MICRO } }],
		['нулевой бюджет', { method: 'update', params: { CampaignId: 'c1', DailyBudget: 0 } }],
		['дробная сумма', { method: 'update', params: { CampaignId: 'c1', DailyBudget: 1.5 } }],
		['сумма не кратна MICRO', { method: 'update', params: { CampaignId: 'c1', DailyBudget: MICRO + 1 } }],
		['сумма строкой', { method: 'update', params: { CampaignId: 'c1', DailyBudget: '10000' } }],
		['слишком большая сумма', { method: 'update', params: { CampaignId: 'c1', DailyBudget: 2_147_483_648 * MICRO } }],
		['add без названия', { method: 'add', params: { Name: '', Bid: rub(1), DailyBudget: rub(1), TargetCpo: rub(1) } }],
	])('отклоняет: %s', (_name, body) => {
		expect(campaignsRequestSchema.safeParse(body).success).toBe(false);
	});
});

describe('bidsRequestSchema', () => {
	it('set: ставка в копейках', () => {
		const result = bidsRequestSchema.safeParse({ method: 'set', params: { CampaignId: 'c1', Bid: rub(25) } });

		expect(result.success).toBe(true);
		if (result.success) expect(result.data.params.Bid).toBe(2_500);
	});

	it('отклоняет нулевую ставку и чужой method', () => {
		expect(bidsRequestSchema.safeParse({ method: 'set', params: { CampaignId: 'c1', Bid: 0 } }).success).toBe(false);
		expect(bidsRequestSchema.safeParse({ method: 'get', params: { CampaignId: 'c1' } }).success).toBe(false);
	});
});

describe('reportsRequestSchema', () => {
	it('get: params не обязательны, фильтры валидны', () => {
		expect(reportsRequestSchema.safeParse({ method: 'get' }).success).toBe(true);
		expect(
			reportsRequestSchema.safeParse({
				method: 'get',
				params: { CampaignIds: ['c1'], FromTick: 1, ToTick: 5 },
			}).success,
		).toBe(true);
	});

	it.each([
		['FromTick > ToTick', { FromTick: 6, ToTick: 5 }],
		['пустой CampaignIds', { CampaignIds: [] }],
		['пустой идентификатор', { CampaignIds: [''] }],
		['тик меньше 1', { FromTick: 0 }],
		['дробный тик', { ToTick: 1.5 }],
	])('отклоняет: %s', (_name, params) => {
		expect(reportsRequestSchema.safeParse({ method: 'get', params }).success).toBe(false);
	});
});
