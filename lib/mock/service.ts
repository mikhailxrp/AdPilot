// Сервис мока Директа: работа с кампаниями активного прогона. Деньги — копейки.
// Скрытые параметры (CampaignTruth) читать нельзя; пишутся только при создании кампании.

import { db } from '@/lib/db';
import { CampaignState, RunStatus } from '@/generated/prisma/client';
import { CAMPAIGN_PRESETS } from '@/lib/simulator/presets';
import type { AddCampaignParams, ReportParams } from '@/lib/validations/mock';
import type { CampaignSource, TickStatsSource } from '@/lib/mock/dto';

/** Ошибка с HTTP-статусом, текст которой безопасно отдать клиенту. */
export class MockApiError extends Error {
	constructor(
		readonly status: 400 | 404 | 409,
		message: string,
	) {
		super(message);
	}
}

const NO_ACTIVE_RUN_MESSAGE = 'Активного прогона нет — сбросьте симулятор с seed';
const CAMPAIGN_NOT_FOUND_MESSAGE = 'Кампания не найдена в активном прогоне';
const DUPLICATE_NAME_MESSAGE = 'Кампания с таким названием уже есть в прогоне';

// Скрытые параметры новой кампании задаёт сервер, клиент их не передаёт
const NEW_CAMPAIGN_TRUTH = (() => {
	const preset = CAMPAIGN_PRESETS.find(({ key }) => key === 'new');
	if (!preset) throw new Error('В CAMPAIGN_PRESETS нет пресета «new»');
	return preset.truth;
})();

const CAMPAIGN_SELECT = {
	id: true,
	name: true,
	state: true,
	bid: true,
	dailyBudget: true,
	targetCpo: true,
} as const;

interface ActiveRun {
	id: string;
	currentTick: number;
}

async function getActiveRun(): Promise<ActiveRun> {
	const run = await db.simulationRun.findFirst({
		where: { status: RunStatus.ACTIVE },
		orderBy: { createdAt: 'desc' },
		select: { id: true, currentTick: true },
	});
	if (!run) throw new MockApiError(409, NO_ACTIVE_RUN_MESSAGE);
	return run;
}

/** Обновляет поля кампании активного прогона; чужая или несуществующая → 404. */
async function updateCampaign(
	campaignId: string,
	data: { bid?: number; dailyBudget?: number; state?: CampaignState },
): Promise<{ id: string }> {
	const run = await getActiveRun();
	const { count } = await db.campaign.updateMany({ where: { id: campaignId, runId: run.id }, data });
	if (count === 0) throw new MockApiError(404, CAMPAIGN_NOT_FOUND_MESSAGE);
	return { id: campaignId };
}

export async function addCampaign(params: AddCampaignParams): Promise<{ id: string }> {
	const run = await getActiveRun();

	const duplicate = await db.campaign.findFirst({
		where: { runId: run.id, name: params.Name },
		select: { id: true },
	});
	if (duplicate) throw new MockApiError(400, DUPLICATE_NAME_MESSAGE);

	return db.campaign.create({
		data: {
			runId: run.id,
			name: params.Name,
			bid: params.Bid,
			dailyBudget: params.DailyBudget,
			targetCpo: params.TargetCpo,
			truth: { create: NEW_CAMPAIGN_TRUTH },
		},
		select: { id: true },
	});
}

export async function listCampaigns(): Promise<CampaignSource[]> {
	const run = await getActiveRun();

	return db.campaign.findMany({
		where: { runId: run.id },
		orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
		select: CAMPAIGN_SELECT,
	});
}

export function updateBudget(campaignId: string, dailyBudget: number): Promise<{ id: string }> {
	return updateCampaign(campaignId, { dailyBudget });
}

export function setBid(campaignId: string, bid: number): Promise<{ id: string }> {
	return updateCampaign(campaignId, { bid });
}

export function setState(campaignId: string, state: CampaignState): Promise<{ id: string }> {
	return updateCampaign(campaignId, { state });
}

export async function getReport(
	params: ReportParams | undefined,
): Promise<{ currentTick: number; rows: TickStatsSource[] }> {
	const run = await getActiveRun();
	const campaignIds = params?.CampaignIds ? [...new Set(params.CampaignIds)] : undefined;

	if (campaignIds) {
		const found = await db.campaign.count({ where: { runId: run.id, id: { in: campaignIds } } });
		if (found !== campaignIds.length) throw new MockApiError(404, CAMPAIGN_NOT_FOUND_MESSAGE);
	}

	const rows = await db.tickStats.findMany({
		where: {
			campaign: { runId: run.id },
			...(campaignIds ? { campaignId: { in: campaignIds } } : {}),
			tick: { gte: params?.FromTick, lte: params?.ToTick },
		},
		orderBy: [{ tick: 'asc' }, { campaignId: 'asc' }],
		select: { campaignId: true, tick: true, impressions: true, clicks: true, orders: true, cost: true, bid: true },
	});

	return { currentTick: run.currentTick, rows };
}
