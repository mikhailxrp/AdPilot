// Чтение для /dashboard: кампании активного прогона и последние решения агента. Скрытые параметры не выбираются.

import { db } from '@/lib/db';
import type { AgentEngineName, DecisionAction, DecisionVerdict } from '@/lib/agent/types';
import { getActiveRunView, type RunView } from '@/lib/simulator/queries';

export const DASHBOARD_RECENT_DECISIONS = 10;

export interface RecentDecision {
	id: string;
	tick: number;
	campaignId: string;
	campaignName: string;
	engine: AgentEngineName;
	action: DecisionAction;
	before: number | null;
	after: number | null;
	reason: string;
	verdict: DecisionVerdict;
	dryRun: boolean;
}

export interface DashboardView {
	run: RunView;
	recentDecisions: RecentDecision[];
}

/** Нет активного прогона → `null`. */
export async function getDashboardView(): Promise<DashboardView | null> {
	const run = await getActiveRunView();
	if (!run) return null;

	const decisions = await db.decision.findMany({
		where: { runId: run.id },
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		take: DASHBOARD_RECENT_DECISIONS,
		select: {
			id: true,
			tick: true,
			engine: true,
			action: true,
			before: true,
			after: true,
			reason: true,
			verdict: true,
			dryRun: true,
			campaign: { select: { id: true, name: true } },
		},
	});

	return {
		run,
		recentDecisions: decisions.map(({ campaign, ...decision }) => ({
			...decision,
			campaignId: campaign.id,
			campaignName: campaign.name,
		})),
	};
}
