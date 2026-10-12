// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { IDLE_POLL_SEC, abortableSleep, runWorkerLoop } from '@/lib/agent/worker-loop';

const INTERVAL_SEC = 60;
const MS_PER_SEC = 1000;
const ENABLED = { timerEnabled: true, tickIntervalSec: INTERVAL_SEC };
const DISABLED = { timerEnabled: false, tickIntervalSec: INTERVAL_SEC };

/** Крутит цикл `rounds` кругов: на последней паузе останавливает worker. */
function setup(configs: Array<typeof ENABLED | Error>, tick: () => Promise<unknown> = async () => undefined) {
	const controller = new AbortController();
	const sleeps: number[] = [];
	let round = 0;
	const deps = {
		getConfig: vi.fn(async () => {
			const next = configs[round];
			if (next instanceof Error) throw next;
			return next ?? DISABLED;
		}),
		tick: vi.fn(tick),
		sleep: async (ms: number) => {
			sleeps.push(ms);
			round += 1;
			if (round >= configs.length) controller.abort();
		},
		signal: controller.signal,
	};
	return { deps, sleeps, controller };
}

describe('runWorkerLoop', () => {
	it('таймер выключен → тиков нет, пауза опроса', async () => {
		const { deps, sleeps } = setup([DISABLED, DISABLED]);

		await runWorkerLoop(deps);

		expect(deps.tick).not.toHaveBeenCalled();
		expect(sleeps).toEqual([IDLE_POLL_SEC * MS_PER_SEC, IDLE_POLL_SEC * MS_PER_SEC]);
	});

	it('таймер включён → тик на каждом круге, пауза tickIntervalSec', async () => {
		const { deps, sleeps } = setup([ENABLED, ENABLED, ENABLED]);

		await runWorkerLoop(deps);

		expect(deps.tick).toHaveBeenCalledTimes(3);
		expect(sleeps).toEqual([INTERVAL_SEC * MS_PER_SEC, INTERVAL_SEC * MS_PER_SEC, INTERVAL_SEC * MS_PER_SEC]);
	});

	it('переключение таймера на лету подхватывается', async () => {
		const { deps } = setup([DISABLED, ENABLED, DISABLED]);

		await runWorkerLoop(deps);

		expect(deps.tick).toHaveBeenCalledTimes(1);
	});

	it('ошибка тика → цикл продолжается', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { deps } = setup([ENABLED, ENABLED], async () => {
			throw new Error('прогона нет');
		});

		await runWorkerLoop(deps);

		expect(deps.tick).toHaveBeenCalledTimes(2);
	});

	it('ошибка чтения конфига → цикл продолжается', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { deps } = setup([new Error('БД недоступна'), ENABLED]);

		await runWorkerLoop(deps);

		expect(deps.tick).toHaveBeenCalledTimes(1);
	});

	it('abort во время тика → тик доделан, нового нет', async () => {
		const { deps, controller } = setup([ENABLED, ENABLED, ENABLED], async () => {
			controller.abort();
		});

		await runWorkerLoop(deps);

		expect(deps.tick).toHaveBeenCalledTimes(1);
	});

	it('уже остановлен → ни конфига, ни тика', async () => {
		const { deps, controller } = setup([ENABLED]);
		controller.abort();

		await runWorkerLoop(deps);

		expect(deps.getConfig).not.toHaveBeenCalled();
		expect(deps.tick).not.toHaveBeenCalled();
	});
});

describe('abortableSleep', () => {
	it('abort прерывает паузу сразу', async () => {
		const controller = new AbortController();
		const sleeping = abortableSleep(60_000, controller.signal);

		controller.abort();

		await expect(sleeping).resolves.toBeUndefined();
	});

	it('уже прерванный signal → пауза не начинается', async () => {
		const controller = new AbortController();
		controller.abort();

		await expect(abortableSleep(60_000, controller.signal)).resolves.toBeUndefined();
	});
});
