'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/access';
import { resetRun, runTick, SimulatorError } from '@/lib/simulator/service';
import { resetSchema } from '@/lib/validations/simulator';

export type ActionResult<T = void> = {
	success: boolean;
	error?: string;
	data?: T;
};

const SIMULATOR_PATH = '/simulator';
const UNEXPECTED_ERROR_MESSAGE = 'Не удалось выполнить операцию. Попробуйте ещё раз';

function toErrorMessage(error: unknown): string {
	if (error instanceof SimulatorError) return error.message;
	console.error('simulator action failed:', error);
	return UNEXPECTED_ERROR_MESSAGE;
}

export async function tickAction(): Promise<ActionResult<{ tick: number }>> {
	await requireAdmin();

	try {
		const data = await runTick();
		revalidatePath(SIMULATOR_PATH);
		return { success: true, data };
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
