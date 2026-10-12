// AdsProvider в памяти для тестов цикла агента и сквозного сценария (Phase 2, таск 7).

import {
	AdsProviderError,
	type AdsCampaign,
	type AdsProvider,
	type AdsReport,
	type AdsReportRow,
	type ReportQuery,
} from '@/lib/ads/types';

export interface MemoryProviderOptions {
	campaigns: readonly AdsCampaign[];
	rows?: readonly AdsReportRow[];
	currentTick?: number;
}

export class MemoryProvider implements AdsProvider {
	/** Ошибка по имени метода: метод бросает её при вызове — имитация сбоя кабинета. */
	readonly failures: Partial<Record<keyof AdsProvider, AdsProviderError>> = {};
	private readonly campaigns: AdsCampaign[];
	private readonly rows: AdsReportRow[];
	private currentTick: number;

	constructor({ campaigns, rows = [], currentTick = 0 }: MemoryProviderOptions) {
		this.campaigns = campaigns.map((campaign) => ({ ...campaign }));
		this.rows = rows.map((row) => ({ ...row }));
		this.currentTick = currentTick;
	}

	/** Добавляет строки отчёта и сдвигает `currentTick` на максимальный тик строк. */
	addRows(rows: readonly AdsReportRow[]): void {
		this.rows.push(...rows.map((row) => ({ ...row })));
		for (const row of rows) this.currentTick = Math.max(this.currentTick, row.tick);
	}

	setTick(tick: number): void {
		this.currentTick = tick;
	}

	async listCampaigns(): Promise<AdsCampaign[]> {
		this.throwIfFailing('listCampaigns');
		return this.campaigns.map((campaign) => ({ ...campaign }));
	}

	async getReport(query: ReportQuery = {}): Promise<AdsReport> {
		this.throwIfFailing('getReport');
		const { campaignIds, fromTick, toTick } = query;
		const rows = this.rows.filter(
			(row) =>
				(campaignIds === undefined || campaignIds.includes(row.campaignId)) &&
				(fromTick === undefined || row.tick >= fromTick) &&
				(toTick === undefined || row.tick <= toTick),
		);
		return { currentTick: this.currentTick, rows: rows.map((row) => ({ ...row })) };
	}

	async setBid(campaignId: string, bid: number): Promise<void> {
		this.throwIfFailing('setBid');
		this.find(campaignId).bid = bid;
	}

	async setDailyBudget(campaignId: string, dailyBudget: number): Promise<void> {
		this.throwIfFailing('setDailyBudget');
		this.find(campaignId).dailyBudget = dailyBudget;
	}

	async suspend(campaignId: string): Promise<void> {
		this.throwIfFailing('suspend');
		this.find(campaignId).state = 'SUSPENDED';
	}

	async resume(campaignId: string): Promise<void> {
		this.throwIfFailing('resume');
		this.find(campaignId).state = 'ON';
	}

	private throwIfFailing(method: keyof AdsProvider): void {
		const failure = this.failures[method];
		if (failure) throw failure;
	}

	private find(campaignId: string): AdsCampaign {
		const campaign = this.campaigns.find((candidate) => candidate.id === campaignId);
		if (!campaign) throw new AdsProviderError('not_found', `Кампании ${campaignId} нет`);
		return campaign;
	}
}
