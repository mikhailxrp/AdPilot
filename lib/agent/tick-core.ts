// Ядро тика: замок → конфиг → тик мира → цикл агента. Зависимости приходят параметром —
// ядро тестируется без БД и сети. Реальные зависимости подставляет tick.ts.

import type { CycleConfig, CycleResult } from '@/lib/agent/cycle';
import type { AgentConfigInput } from '@/lib/validations/agent-config';

/** Ошибка, текст которой безопасно показать пользователю. */
export class TickError extends Error {}

export const NO_ACTIVE_RUN_MESSAGE = 'Прогона нет — сначала сбросьте симулятор с seed';
export const UNSUPPORTED_ENGINE_MESSAGE = 'LLM-движок появится в Phase 3 — выберите движок rules';

export type TickLockResult<T> = { acquired: true; value: T } | { acquired: false };

export interface TickDeps {
	withLock<T>(fn: () => Promise<T>): Promise<TickLockResult<T>>;
	getConfig(): Promise<AgentConfigInput>;
	getActiveRunId(): Promise<string | null>;
	runWorldTick(): Promise<{ tick: number }>;
	runCycle(params: { config: CycleConfig; runId: string }): Promise<CycleResult>;
}

export type TickOutcome =
	| { status: 'busy' }
	| { status: 'done'; tick: number; cycle: CycleResult | null; cycleError: string | null };

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function runTickWith(deps: TickDeps): Promise<TickOutcome> {
	const locked = await deps.withLock(async () => {
		const config = await deps.getConfig();
		// Проверки до тика мира: время не должно идти, если агент заведомо не отработает
		if (config.engine !== 'RULES') throw new TickError(UNSUPPORTED_ENGINE_MESSAGE);
		const runId = await deps.getActiveRunId();
		if (!runId) throw new TickError(NO_ACTIVE_RUN_MESSAGE);

		const { tick } = await deps.runWorldTick();

		// Тик мира уже закоммичен — сбой агента его не откатывает
		try {
			const cycle = await deps.runCycle({ config, runId });
			return { tick, cycle, cycleError: null };
		} catch (error) {
			console.error('Цикл агента упал:', error);
			return { tick, cycle: null, cycleError: errorMessage(error) };
		}
	});

	if (!locked.acquired) return { status: 'busy' };
	return { status: 'done', ...locked.value };
}
