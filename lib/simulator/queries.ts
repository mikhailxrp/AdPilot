// Чтение для страницы /simulator. Скрытые параметры (CampaignTruth) здесь не выбираются.

import { db } from '@/lib/db';
import { RunStatus, type CampaignState } from '@/generated/prisma/client';
import { computeMetrics, type Metrics, type MetricsInput } from '@/lib/metrics/metrics';
import { sumTickStats } from '@/lib/simulator/stats';

export interface CampaignRow {
	id: string;
	name: string;
	state: CampaignState;
	bid: number;
	dailyBudget: number;
	targetCpo: number;
	totals: MetricsInput;
	metrics: Metrics;
}

export interface RunView {
	id: string;
	seed: number;
	currentTick: number;
	campaigns: CampaignRow[];
}

export async function getActiveRunView(): Promise<RunView | null> {
	const run = await db.simulationRun.findFirst({
		where: { status: RunStatus.ACTIVE },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			seed: true,
			currentTick: true,
			campaigns: {
				orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
				select: {
					id: true,
					name: true,
					state: true,
					bid: true,
					dailyBudget: true,
					targetCpo: true,
					tickStats: { select: { impressions: true, clicks: true, orders: true, cost: true } },
				},
			},
		},
	});
	if (!run) return null;

	return {
		id: run.id,
		seed: run.seed,
		currentTick: run.currentTick,
		campaigns: run.campaigns.map(({ tickStats, ...campaign }) => {
			const totals = sumTickStats(tickStats);
			return { ...campaign, totals, metrics: computeMetrics(totals) };
		}),
	};
}
