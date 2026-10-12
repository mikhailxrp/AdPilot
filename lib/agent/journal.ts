// Журнал решений на Prisma. Только дополняется; единственное изменение записи — `applyError`.

import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { CHANGE_ACTIONS, type DecisionMetrics, type Journal } from '@/lib/agent/types';

/** Явный объект для JSON-колонки: интерфейсы метрик не совместимы с `InputJsonValue` напрямую. */
function toJson({ windowTicks, window, metrics, daySpend }: DecisionMetrics): Prisma.InputJsonObject {
	return {
		windowTicks,
		window: { ...window },
		metrics: { ...metrics },
		daySpend,
	};
}

export const prismaJournal: Journal = {
	async record(entry) {
		const { id } = await db.decision.create({
			data: { ...entry, metrics: toJson(entry.metrics) },
			select: { id: true },
		});
		return { id };
	},

	async setApplyError(id, message) {
		await db.decision.update({ where: { id }, data: { applyError: message } });
	},

	async lastChangeTicks(runId, campaignIds) {
		const groups = await db.decision.groupBy({
			by: ['campaignId'],
			where: {
				runId,
				campaignId: { in: [...campaignIds] },
				verdict: 'ACCEPTED',
				dryRun: false,
				applyError: null,
				action: { in: [...CHANGE_ACTIONS] },
			},
			_max: { tick: true },
		});
		const ticks = new Map<string, number>();
		for (const group of groups) {
			if (group._max.tick !== null) ticks.set(group.campaignId, group._max.tick);
		}
		return ticks;
	},
};
