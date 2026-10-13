// Чтение для страницы /campaigns/[id]: любая кампания, в том числе архивного прогона.
// Скрытые параметры (CampaignTruth) здесь не выбираются.

import { db } from '@/lib/db';
import { RunStatus, type CampaignState } from '@/generated/prisma/client';
import type { SeriesRow } from '@/lib/campaigns/series';
import { computeMetrics, type Metrics, type MetricsInput } from '@/lib/metrics/metrics';
import { sumTickStats } from '@/lib/simulator/stats';

export interface CampaignDetail {
	id: string;
	name: string;
	state: CampaignState;
	bid: number;
	dailyBudget: number;
	targetCpo: number;
	run: {
		id: string;
		seed: number;
		currentTick: number;
		archived: boolean;
	};
	/** Строки по тикам, по возрастанию тика. */
	ticks: SeriesRow[];
	totals: MetricsInput;
	metrics: Metrics;
}

/** Кампания с прогоном и тиками. Нет такой → `null`. */
export async function getCampaignDetail(id: string): Promise<CampaignDetail | null> {
	const campaign = await db.campaign.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			state: true,
			bid: true,
			dailyBudget: true,
			targetCpo: true,
			run: { select: { id: true, seed: true, currentTick: true, status: true } },
			tickStats: {
				orderBy: { tick: 'asc' },
				select: { tick: true, impressions: true, clicks: true, orders: true, cost: true, bid: true },
			},
		},
	});
	if (!campaign) return null;

	const { run, tickStats, ...rest } = campaign;
	const totals = sumTickStats(tickStats);

	return {
		...rest,
		run: {
			id: run.id,
			seed: run.seed,
			currentTick: run.currentTick,
			archived: run.status === RunStatus.ARCHIVED,
		},
		ticks: tickStats,
		totals,
		metrics: computeMetrics(totals),
	};
}
