// Суммы по тикам для таблицы и расчёта `spentToday` для модели. Чистые функции.

import { dayStartTick } from '@/lib/simulator/model';
import type { MetricsInput } from '@/lib/metrics/metrics';

export interface CostRow {
	tick: number;
	cost: number;
}

export function sumTickStats(rows: readonly MetricsInput[]): MetricsInput {
	return rows.reduce<MetricsInput>(
		(total, row) => ({
			impressions: total.impressions + row.impressions,
			clicks: total.clicks + row.clicks,
			orders: total.orders + row.orders,
			cost: total.cost + row.cost,
		}),
		{ impressions: 0, clicks: 0, orders: 0, cost: 0 },
	);
}

/** Расход текущих суток до `tick` (сам тик не входит). */
export function spentToday(rows: readonly CostRow[], tick: number): number {
	const from = dayStartTick(tick);
	return rows.reduce((total, row) => (row.tick >= from && row.tick < tick ? total + row.cost : total), 0);
}
