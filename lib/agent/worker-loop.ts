// Цикл worker-а: по таймеру из конфига делает тики. Конфиг читается каждый круг —
// переключатель на /simulator действует без перезапуска. Зависимости внедряются.

import type { AgentConfigInput } from '@/lib/validations/agent-config';

/** Как часто проверять, не включили ли таймер. */
export const IDLE_POLL_SEC = 5;
const MS_PER_SEC = 1000;

export interface WorkerLoopDeps {
	getConfig(): Promise<Pick<AgentConfigInput, 'timerEnabled' | 'tickIntervalSec'>>;
	tick(): Promise<unknown>;
	sleep(ms: number, signal: AbortSignal): Promise<void>;
	signal: AbortSignal;
}

/** Пауза, которую прерывает `signal`. */
export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal.aborted) {
			resolve();
			return;
		}
		const onAbort = () => {
			clearTimeout(timer);
			resolve();
		};
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal.addEventListener('abort', onAbort, { once: true });
	});
}

export async function runWorkerLoop({ getConfig, tick, sleep, signal }: WorkerLoopDeps): Promise<void> {
	while (!signal.aborted) {
		let waitMs = IDLE_POLL_SEC * MS_PER_SEC;
		try {
			const config = await getConfig();
			if (config.timerEnabled) {
				waitMs = config.tickIntervalSec * MS_PER_SEC;
				await tick();
			}
		} catch (error) {
			console.error('Сбой круга worker-а:', error);
		}
		await sleep(waitMs, signal);
	}
}
