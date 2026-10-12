// Сервис симулятора: прогоны и тики в БД. Модель тика — чистая, см. model.ts.

import { db } from '@/lib/db';
import { Prisma, RunStatus } from '@/generated/prisma/client';
import { CAMPAIGN_PRESETS } from '@/lib/simulator/presets';
import { dayStartTick, simulateTick } from '@/lib/simulator/model';
import { spentToday } from '@/lib/simulator/stats';

const PRESET_KEY_BY_NAME = new Map<string, string>(CAMPAIGN_PRESETS.map((preset) => [preset.name, preset.key]));

/** Ошибка, текст которой безопасно показать пользователю. */
export class SimulatorError extends Error {}

const NO_ACTIVE_RUN_MESSAGE = 'Прогона нет — сначала сбросьте симулятор с seed';
const TICK_CONFLICT_MESSAGE = 'Тик уже выполнен, обновите страницу';

async function createRunIn(tx: Prisma.TransactionClient, seed: number): Promise<{ id: string }> {
	const run = await tx.simulationRun.create({ data: { seed }, select: { id: true } });

	// По очереди, чтобы порядок кампаний на странице совпадал с порядком пресетов
	for (const preset of CAMPAIGN_PRESETS) {
		await tx.campaign.create({
			data: {
				runId: run.id,
				name: preset.name,
				bid: preset.bid,
				dailyBudget: preset.dailyBudget,
				targetCpo: preset.targetCpo,
				truth: { create: preset.truth },
			},
		});
	}

	return run;
}

export async function createRun(seed: number): Promise<{ id: string }> {
	return db.$transaction((tx) => createRunIn(tx, seed));
}

/** Архивирует активный прогон и создаёт новый — журнал решений Phase 2 только дополняется. */
export async function resetRun(seed: number): Promise<{ id: string }> {
	return db.$transaction(
		async (tx) => {
			await tx.simulationRun.updateMany({
				where: { status: RunStatus.ACTIVE },
				data: { status: RunStatus.ARCHIVED },
			});
			return createRunIn(tx, seed);
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);
}

export async function runTick(): Promise<{ tick: number }> {
	return db.$transaction(async (tx) => {
		const run = await tx.simulationRun.findFirst({
			where: { status: RunStatus.ACTIVE },
			orderBy: { createdAt: 'desc' },
		});
		if (!run) throw new SimulatorError(NO_ACTIVE_RUN_MESSAGE);

		const tick = run.currentTick + 1;

		// Занимаем тик: второй параллельный вызов не найдёт прежний currentTick
		const claimed = await tx.simulationRun.updateMany({
			where: { id: run.id, currentTick: run.currentTick },
			data: { currentTick: tick },
		});
		if (claimed.count === 0) throw new SimulatorError(TICK_CONFLICT_MESSAGE);

		const campaigns = await tx.campaign.findMany({
			where: { runId: run.id },
			include: {
				truth: true,
				tickStats: {
					where: { tick: { gte: dayStartTick(tick), lt: tick } },
					select: { tick: true, cost: true },
				},
			},
		});

		const rows = campaigns.flatMap((campaign) => {
			const { truth } = campaign;
			if (!truth) {
				throw new Error(`У кампании ${campaign.id} нет скрытых параметров`);
			}

			const result = simulateTick({
				runSeed: run.seed,
				tick,
				campaignKey: PRESET_KEY_BY_NAME.get(campaign.name) ?? campaign.name,
				state: campaign.state,
				bid: campaign.bid,
				dailyBudget: campaign.dailyBudget,
				spentToday: spentToday(campaign.tickStats, tick),
				truth,
			});

			return [{ campaignId: campaign.id, tick, ...result }];
		});

		await tx.tickStats.createMany({ data: rows });

		return { tick };
	});
}
