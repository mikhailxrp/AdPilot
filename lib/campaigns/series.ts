// Ряды кампании по тикам для страницы /campaigns/[id] и графиков. Чистые функции.
// CPO — по скользящему окну, тем же кодом, что и у агента: за один тик заказов 0–2, поштучный CPO бессмыслен.

import { aggregateWindow, type WindowRow } from '@/lib/agent/window';
import { cpo } from '@/lib/metrics/metrics';

export type SeriesRow = WindowRow & { bid: number };

export interface SeriesPoint {
	tick: number;
	/** Ставка на момент тика, копейки; тика нет в данных → `null`. */
	bid: number | null;
	/** Расход за тик, копейки; тика нет в данных → `null`. */
	cost: number | null;
	/** CPO по окну `(tick − windowTicks, tick]`, копейки; в окне нет заказов → `null`. */
	windowCpo: number | null;
}

/** Точка на каждый тик `1..throughTick`; строки за пределами диапазона не учитываются. */
export function buildCampaignSeries(
	rows: readonly SeriesRow[],
	windowTicks: number,
	throughTick: number,
): SeriesPoint[] {
	const byTick = new Map(rows.map((row) => [row.tick, row]));

	return Array.from({ length: Math.max(0, throughTick) }, (_, index) => {
		const tick = index + 1;
		const row = byTick.get(tick);
		return {
			tick,
			bid: row?.bid ?? null,
			cost: row?.cost ?? null,
			windowCpo: cpo(aggregateWindow(rows, tick, windowTicks)),
		};
	});
}
