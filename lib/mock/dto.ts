// Ответы мока Директа. Собираются только из явно перечисленных полей — скрытые параметры
// (CampaignTruth) сюда не попадают. Деньги в БД — копейки, в ответах — микроединицы.

import { MICRO } from '@/lib/validations/mock';

export type DirectState = 'ON' | 'SUSPENDED';

export interface CampaignSource {
	id: string;
	name: string;
	state: DirectState;
	bid: number;
	dailyBudget: number;
	targetCpo: number;
}

export interface TickStatsSource {
	campaignId: string;
	tick: number;
	impressions: number;
	clicks: number;
	orders: number;
	cost: number;
	bid: number;
}

export interface DirectCampaign {
	Id: string;
	Name: string;
	State: DirectState;
	Bid: number;
	DailyBudget: number;
	TargetCpo: number;
}

export interface DirectReportRow {
	CampaignId: string;
	Tick: number;
	Impressions: number;
	Clicks: number;
	Conversions: number;
	Cost: number;
	Bid: number;
}

export function kopecksToMicro(kopecks: number): number {
	return kopecks * MICRO;
}

export function toDirectCampaign(campaign: CampaignSource): DirectCampaign {
	return {
		Id: campaign.id,
		Name: campaign.name,
		State: campaign.state,
		Bid: kopecksToMicro(campaign.bid),
		DailyBudget: kopecksToMicro(campaign.dailyBudget),
		TargetCpo: kopecksToMicro(campaign.targetCpo),
	};
}

export function toDirectReportRow(row: TickStatsSource): DirectReportRow {
	return {
		CampaignId: row.campaignId,
		Tick: row.tick,
		Impressions: row.impressions,
		Clicks: row.clicks,
		Conversions: row.orders,
		Cost: kopecksToMicro(row.cost),
		Bid: kopecksToMicro(row.bid),
	};
}

export function directResult(result: unknown): Response {
	return Response.json({ result });
}

/** Формат ошибки как в Директе; `error_code` совпадает с HTTP-статусом. */
export function directError(status: number, message: string): Response {
	return Response.json({ error: { error_code: status, error_string: message } }, { status });
}
