// Интерфейс доступа агента к рекламному кабинету. Реализации: MockProvider (Phase 2),
// DirectSandboxProvider (Phase 6). Деньги — копейки, независимо от формата кабинета.

export type AdsCampaignState = 'ON' | 'SUSPENDED';

export interface AdsCampaign {
	id: string;
	name: string;
	state: AdsCampaignState;
	bid: number;
	dailyBudget: number;
	targetCpo: number;
}

/** Строка отчёта за один тик; поля совпадают с `MetricsInput` (+ `campaignId`, `tick`, `bid`). */
export interface AdsReportRow {
	campaignId: string;
	tick: number;
	impressions: number;
	clicks: number;
	orders: number;
	cost: number;
	bid: number;
}

export interface AdsReport {
	currentTick: number;
	rows: AdsReportRow[];
}

export interface ReportQuery {
	campaignIds?: string[];
	fromTick?: number;
	toTick?: number;
}

export interface AdsProvider {
	listCampaigns(): Promise<AdsCampaign[]>;
	getReport(query?: ReportQuery): Promise<AdsReport>;
	setBid(campaignId: string, bid: number): Promise<void>;
	setDailyBudget(campaignId: string, dailyBudget: number): Promise<void>;
	suspend(campaignId: string): Promise<void>;
	resume(campaignId: string): Promise<void>;
}

export type AdsErrorCode =
	| 'unauthorized'
	| 'not_found'
	| 'conflict'
	| 'bad_request'
	| 'unavailable'
	| 'invalid_response';

/** Ошибка кабинета; `code` — что случилось, `message` — текст кабинета или описание сбоя. */
export class AdsProviderError extends Error {
	constructor(
		readonly code: AdsErrorCode,
		message: string,
		options?: { cause?: unknown },
	) {
		super(message, options);
		this.name = 'AdsProviderError';
	}
}
