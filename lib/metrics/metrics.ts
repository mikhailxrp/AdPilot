// Формулы метрик (PRD, требование 3). Деньги — копейки, CTR и CR — доля 0..1.
// Без округления; деление на ноль → null («нет данных»).

export const CPM_IMPRESSIONS = 1000;

export interface MetricsInput {
	impressions: number;
	clicks: number;
	orders: number;
	cost: number;
}

export interface Metrics {
	cpc: number | null;
	cpm: number | null;
	ctr: number | null;
	cr: number | null;
	cpo: number | null;
}

function safeDivide(numerator: number, denominator: number): number | null {
	if (denominator === 0) return null;
	return numerator / denominator;
}

export function cpc({ cost, clicks }: Pick<MetricsInput, 'cost' | 'clicks'>): number | null {
	return safeDivide(cost, clicks);
}

export function cpm({ cost, impressions }: Pick<MetricsInput, 'cost' | 'impressions'>): number | null {
	const perImpression = safeDivide(cost, impressions);
	return perImpression === null ? null : perImpression * CPM_IMPRESSIONS;
}

export function ctr({ clicks, impressions }: Pick<MetricsInput, 'clicks' | 'impressions'>): number | null {
	return safeDivide(clicks, impressions);
}

export function cr({ orders, clicks }: Pick<MetricsInput, 'orders' | 'clicks'>): number | null {
	return safeDivide(orders, clicks);
}

export function cpo({ cost, orders }: Pick<MetricsInput, 'cost' | 'orders'>): number | null {
	return safeDivide(cost, orders);
}

export function computeMetrics(stats: MetricsInput): Metrics {
	return {
		cpc: cpc(stats),
		cpm: cpm(stats),
		ctr: ctr(stats),
		cr: cr(stats),
		cpo: cpo(stats),
	};
}
