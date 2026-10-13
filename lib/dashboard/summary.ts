// Сводка /dashboard по кампаниям активного прогона. Чистые функции.
// Сравнения с целью — в целых числах (копейки × проценты), как в движке rules: статус и решения агента не разойдутся.

import { allowedCpo } from '@/lib/agent/engines/rules';
import { computeMetrics } from '@/lib/metrics/metrics';
import type { CampaignRow } from '@/lib/simulator/queries';
import { sumTickStats } from '@/lib/simulator/stats';

const PERCENT = 100;

export type CpoStatus = 'WITHIN_TARGET' | 'WITHIN_TOLERANCE' | 'OVER_TOLERANCE' | 'NO_DATA';

export interface DashboardTotals {
	cost: number;
	orders: number;
	/** Общий расход / общие заказы; заказов нет → `null`. */
	cpo: number | null;
}

export interface CampaignCpoRow {
	id: string;
	name: string;
	targetCpo: number;
	allowedCpo: number;
	cpo: number | null;
	status: CpoStatus;
}

export interface DashboardSummary {
	totals: DashboardTotals;
	campaigns: CampaignCpoRow[];
}

type CampaignInput = Pick<CampaignRow, 'id' | 'name' | 'targetCpo' | 'totals'>;

export function cpoStatus(cost: number, orders: number, targetCpo: number, tolerancePct: number): CpoStatus {
	if (orders === 0) return 'NO_DATA';
	if (cost <= orders * targetCpo) return 'WITHIN_TARGET';
	if (cost * PERCENT <= orders * targetCpo * (PERCENT + tolerancePct)) return 'WITHIN_TOLERANCE';
	return 'OVER_TOLERANCE';
}

export function buildDashboardSummary(campaigns: readonly CampaignInput[], cpoTolerancePct: number): DashboardSummary {
	const { cost, orders } = sumTickStats(campaigns.map(({ totals }) => totals));

	return {
		totals: { cost, orders, cpo: computeMetrics({ impressions: 0, clicks: 0, cost, orders }).cpo },
		campaigns: campaigns.map(({ id, name, targetCpo, totals }) => ({
			id,
			name,
			targetCpo,
			allowedCpo: allowedCpo(targetCpo, cpoTolerancePct),
			cpo: computeMetrics(totals).cpo,
			status: cpoStatus(totals.cost, totals.orders, targetCpo, cpoTolerancePct),
		})),
	};
}
