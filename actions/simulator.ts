'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/access';
import { runAgentTick } from '@/lib/agent/tick';
import { TickError } from '@/lib/agent/tick-core';
import { db } from '@/lib/db';
import { resetRun, SimulatorError } from '@/lib/simulator/service';
import { AGENT_CONFIG_ID, timerToggleSchema } from '@/lib/validations/agent-config';
import { resetSchema } from '@/lib/validations/simulator';

export type ActionResult<T = void> = {
	success: boolean;
	error?: string;
	data?: T;
};

export interface TickSummary {
	tick: number;
	decisions: number;
	failures: number;
	/** Тик мира прошёл, а цикл агента упал. */
	cycleError: string | null;
}

const SIMULATOR_PATH = '/simulator';
const UNEXPECTED_ERROR_MESSAGE = 'Не удалось выполнить операцию. Попробуйте ещё раз';
const TICK_BUSY_MESSAGE = 'Тик уже выполняется';

function toErrorMessage(error: unknown): string {
	if (error instanceof SimulatorError || error instanceof TickError) return error.message;
	console.error('simulator action failed:', error);
	return UNEXPECTED_ERROR_MESSAGE;
}

export async function tickAction(): Promise<ActionResult<TickSummary>> {
	await requireAdmin();

	try {
		const outcome = await runAgentTick();
		if (outcome.status === 'busy') return { success: false, error: TICK_BUSY_MESSAGE };

		revalidatePath(SIMULATOR_PATH);
		return {
			success: true,
			data: {
				tick: outcome.tick,
				decisions: outcome.cycle?.decisions.length ?? 0,
				failures: outcome.cycle?.failures.length ?? 0,
				cycleError: outcome.cycleError,
			},
		};
	} catch (error) {
		return { success: false, error: toErrorMessage(error) };
	}
}

export async function setTimerAction(input: unknown): Promise<ActionResult<{ timerEnabled: boolean }>> {
	const parsed = timerToggleSchema.safeParse(input);
	if (!parsed.success) {
		return { success: false, error: parsed.error.issues[0]?.message ?? UNEXPECTED_ERROR_MESSAGE };
	}

	await requireAdmin();

	try {
		await db.agentConfig.update({
			where: { id: AGENT_CONFIG_ID },
			data: { timerEnabled: parsed.data.timerEnabled },
		});
		revalidatePath(SIMULATOR_PATH);
		return { success: true, data: { timerEnabled: parsed.data.timerEnabled } };
	} catch (error) {
		return { success: false, error: toErrorMessage(error) };
	}
}

export async function resetAction(input: unknown): Promise<ActionResult<{ seed: number }>> {
	const parsed = resetSchema.safeParse(input);
	if (!parsed.success) {
		return { success: false, error: parsed.error.issues[0]?.message ?? UNEXPECTED_ERROR_MESSAGE };
	}

	await requireAdmin();

	try {
		await resetRun(parsed.data.seed);
		revalidatePath(SIMULATOR_PATH);
		return { success: true, data: { seed: parsed.data.seed } };
	} catch (error) {
		return { success: false, error: toErrorMessage(error) };
	}
}
