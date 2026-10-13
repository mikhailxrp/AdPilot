// Ядро тика: замок → конфиг → тик мира → цикл агента. Зависимости приходят параметром —
// ядро тестируется без БД и сети. Реальные зависимости подставляет tick.ts.

import type { CycleConfig, CycleResult } from '@/lib/agent/cycle';
import type { AgentEngine, AgentEngineName } from '@/lib/agent/types';
import type { AgentConfigInput } from '@/lib/validations/agent-config';

/** Ошибка, текст которой безопасно показать пользователю. */
export class TickError extends Error {}

export const NO_ACTIVE_RUN_MESSAGE = 'Прогона нет — сначала сбросьте симулятор с seed';

export type TickLockResult<T> = { acquired: true; value: T } | { acquired: false };

export interface TickDeps {
	withLock<T>(fn: () => Promise<T>): Promise<TickLockResult<T>>;
	getConfig(): Promise<AgentConfigInput>;
	getActiveRunId(): Promise<string | null>;
	runWorldTick(): Promise<{ tick: number }>;
	/** Бросает, если движок не настроен (например, нет ключа LLM). */
	createEngine(config: AgentConfigInput): AgentEngine;
	runCycle(params: { config: CycleConfig; runId: string; engine: AgentEngine }): Promise<CycleResult>;
}

export type TickOutcome =
	| { status: 'busy' }
	| { status: 'done'; tick: number; cycle: CycleResult | null; cycleError: string | null };

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Текст ошибки «движок не настроен», например нет `YANDEX_API_KEY` для `LLM`. */
export function engineSetupMessage(engine: AgentEngineName, error: unknown): string {
	return `Движок ${engine} не настроен: ${errorMessage(error)}`;
}

export async function runTickWith(deps: TickDeps): Promise<TickOutcome> {
	const locked = await deps.withLock(async () => {
		const config = await deps.getConfig();
		// Проверки до тика мира: время не должно идти, если агент заведомо не отработает
		const runId = await deps.getActiveRunId();
		if (!runId) throw new TickError(NO_ACTIVE_RUN_MESSAGE);
		let engine: AgentEngine;
		try {
			engine = deps.createEngine(config);
		} catch (error) {
			throw new TickError(engineSetupMessage(config.engine, error), { cause: error });
		}

		const { tick } = await deps.runWorldTick();

		// Тик мира уже закоммичен — сбой агента его не откатывает
		try {
			const cycle = await deps.runCycle({ config, runId, engine });
			return { tick, cycle, cycleError: null };
		} catch (error) {
			console.error('Цикл агента упал:', error);
			return { tick, cycle: null, cycleError: errorMessage(error) };
		}
	});

	if (!locked.acquired) return { status: 'busy' };
	return { status: 'done', ...locked.value };
}
