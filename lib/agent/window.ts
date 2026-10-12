// Агрегация статистики кампании за окно тиков. Чистые функции.

import type { AdsCampaign, AdsReportRow } from '@/lib/ads/types';
import { computeMetrics, type MetricsInput } from '@/lib/metrics/metrics';
import { TICKS_PER_DAY } from '@/lib/simulator/model';
import { sumTickStats } from '@/lib/simulator/stats';
import type { CampaignSnapshot } from '@/lib/agent/types';

/** Сумма строк одной кампании с тиком в `(currentTick − ticks, currentTick]`. */
export function aggregateWindow(rows: readonly AdsReportRow[], currentTick: number, ticks: number): MetricsInput {
	const fromTick = currentTick - ticks;
	return sumTickStats(rows.filter((row) => row.tick > fromTick && row.tick <= currentTick));
}

/** Снимок кампании для движка: окно, метрики по нему и расход за сутки. */
export function buildSnapshot(
	campaign: AdsCampaign,
	rows: readonly AdsReportRow[],
	currentTick: number,
	windowTicks: number,
): CampaignSnapshot {
	const window = aggregateWindow(rows, currentTick, windowTicks);
	return {
		campaign,
		currentTick,
		window,
		metrics: computeMetrics(window),
		daySpend: aggregateWindow(rows, currentTick, TICKS_PER_DAY).cost,
	};
}
