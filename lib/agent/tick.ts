// Один тик для кнопки и worker-а: тик мира + цикл агента под advisory lock.

import { createMockProviderFromEnv } from '@/lib/ads/mock-provider';
import { getAgentConfig } from '@/lib/agent/config';
import { runAgentCycle } from '@/lib/agent/cycle';
import { createLlmEngine } from '@/lib/agent/engines/llm';
import { rulesEngine } from '@/lib/agent/engines/rules';
import { prismaJournal } from '@/lib/agent/journal';
import { withTickLock } from '@/lib/agent/tick-lock';
import { runTickWith, type TickOutcome } from '@/lib/agent/tick-core';
import type { AgentEngine, AgentEngineName } from '@/lib/agent/types';
import { db } from '@/lib/db';
import { createLLMClientFromEnv } from '@/lib/llm/client-from-env';
import { RunStatus } from '@/generated/prisma/client';
import { runTick } from '@/lib/simulator/service';

function createEngine(name: AgentEngineName): AgentEngine {
	return name === 'LLM' ? createLlmEngine(createLLMClientFromEnv()) : rulesEngine;
}

/** При `LLM` на том же снимке спрашиваем `rules` — для сравнения в журнале. При `RULES` модель не вызывается. */
function shadowEngineFor(engine: AgentEngine): AgentEngine | null {
	return engine.name === 'LLM' ? rulesEngine : null;
}

export async function runAgentTick(): Promise<TickOutcome> {
	return runTickWith({
		withLock: withTickLock,
		getConfig: getAgentConfig,
		getActiveRunId: async () => {
			const run = await db.simulationRun.findFirst({
				where: { status: RunStatus.ACTIVE },
				orderBy: { createdAt: 'desc' },
				select: { id: true },
			});
			return run?.id ?? null;
		},
		runWorldTick: runTick,
		createEngine,
		runCycle: ({ config, runId, engine }) =>
			runAgentCycle({
				provider: createMockProviderFromEnv(),
				journal: prismaJournal,
				engine,
				shadowEngine: shadowEngineFor(engine),
				config,
				runId,
			}),
	});
}
