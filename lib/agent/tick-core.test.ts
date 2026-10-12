// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { CycleResult } from '@/lib/agent/cycle';
import {
	NO_ACTIVE_RUN_MESSAGE,
	TickError,
	UNSUPPORTED_ENGINE_MESSAGE,
	runTickWith,
	type TickDeps,
} from '@/lib/agent/tick-core';
import { agentConfigSchema, type AgentConfigInput } from '@/lib/validations/agent-config';

const RUN_ID = 'run1';
const TICK = 7;
const CYCLE: CycleResult = { tick: TICK, decisions: [], failures: [] };

function makeDeps(overrides: Partial<TickDeps> = {}, config: AgentConfigInput = agentConfigSchema.parse({})) {
	const calls: string[] = [];
	const deps: TickDeps = {
		withLock: async (fn) => {
			calls.push('lock');
			return { acquired: true, value: await fn() };
		},
		getConfig: async () => {
			calls.push('config');
			return config;
		},
		getActiveRunId: async () => RUN_ID,
		runWorldTick: vi.fn(async () => {
			calls.push('world');
			return { tick: TICK };
		}),
		runCycle: vi.fn(async () => {
			calls.push('cycle');
			return CYCLE;
		}),
		...overrides,
	};
	return { deps, calls };
}

describe('runTickWith', () => {
	it('порядок: замок → конфиг → тик мира → цикл, в цикл уходят runId и конфиг', async () => {
		const { deps, calls } = makeDeps();

		const outcome = await runTickWith(deps);

		expect(outcome).toEqual({ status: 'done', tick: TICK, cycle: CYCLE, cycleError: null });
		expect(calls).toEqual(['lock', 'config', 'world', 'cycle']);
		expect(deps.runCycle).toHaveBeenCalledWith({ config: agentConfigSchema.parse({}), runId: RUN_ID });
	});

	it('замок занят → ни тика мира, ни цикла', async () => {
		const { deps } = makeDeps({ withLock: async () => ({ acquired: false }) });

		const outcome = await runTickWith(deps);

		expect(outcome).toEqual({ status: 'busy' });
		expect(deps.runWorldTick).not.toHaveBeenCalled();
		expect(deps.runCycle).not.toHaveBeenCalled();
	});

	it('цикл упал → тик мира сохранён, ошибка в cycleError', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { deps } = makeDeps({
			runCycle: async () => {
				throw new Error('мок недоступен');
			},
		});

		const outcome = await runTickWith(deps);

		expect(outcome).toEqual({ status: 'done', tick: TICK, cycle: null, cycleError: 'мок недоступен' });
		expect(deps.runWorldTick).toHaveBeenCalledOnce();
	});

	it('прогона нет → понятная ошибка, время не идёт', async () => {
		const { deps } = makeDeps({ getActiveRunId: async () => null });

		await expect(runTickWith(deps)).rejects.toThrow(new TickError(NO_ACTIVE_RUN_MESSAGE));
		expect(deps.runWorldTick).not.toHaveBeenCalled();
	});

	it('движок LLM → ошибка, время не идёт', async () => {
		const { deps } = makeDeps({}, agentConfigSchema.parse({ engine: 'LLM' }));

		await expect(runTickWith(deps)).rejects.toThrow(new TickError(UNSUPPORTED_ENGINE_MESSAGE));
		expect(deps.runWorldTick).not.toHaveBeenCalled();
	});

	it('тик мира упал → ошибка пробрасывается, цикл не запускается', async () => {
		const { deps } = makeDeps({
			runWorldTick: async () => {
				throw new Error('тик не удался');
			},
		});

		await expect(runTickWith(deps)).rejects.toThrow('тик не удался');
		expect(deps.runCycle).not.toHaveBeenCalled();
	});
});
