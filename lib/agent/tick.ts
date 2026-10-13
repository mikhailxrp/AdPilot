// Один тик для кнопки и worker-а: тик мира + цикл агента под advisory lock.

import { createMockProviderFromEnv } from '@/lib/ads/mock-provider';
import { getAgentConfig } from '@/lib/agent/config';
import { runAgentCycle } from '@/lib/agent/cycle';
import { createLlmEngine } from '@/lib/agent/engines/llm';
import { createFakeLlmEngine } from '@/lib/agent/engines/llm-fake';
import { rulesEngine } from '@/lib/agent/engines/rules';
import { prismaJournal } from '@/lib/agent/journal';
import { resolveSystemPrompt } from '@/lib/agent/prompt-versions';
import { ensurePromptVersion } from '@/lib/agent/prompt-versions-db';
import { withTickLock } from '@/lib/agent/tick-lock';
import { runTickWith, type TickOutcome } from '@/lib/agent/tick-core';
import type { AgentEngine } from '@/lib/agent/types';
import { db } from '@/lib/db';
import { createLLMClientFromEnv, llmClientKindFromEnv } from '@/lib/llm/client-from-env';
import { RunStatus } from '@/generated/prisma/client';
import { runTick } from '@/lib/simulator/service';
import type { AgentConfigInput } from '@/lib/validations/agent-config';

/** `LLM_CLIENT=fake` (e2e): «модель» отвечает решением `rules` — детерминированно и без сети. */
function createLlm(config: AgentConfigInput): AgentEngine {
	const systemPrompt = resolveSystemPrompt(config);
	if (llmClientKindFromEnv() === 'fake') return createFakeLlmEngine({ systemPrompt });
	const client = createLLMClientFromEnv(process.env, {
		modelUri: config.llmModelUri,
		temperature: config.llmTemperature,
	});
	return createLlmEngine(client, { systemPrompt });
}

function createEngine(config: AgentConfigInput): AgentEngine {
	return config.engine === 'LLM' ? createLlm(config) : rulesEngine;
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
		runCycle: async ({ config, runId, engine }) => {
			// Версия промпта — по тексту, который реально держит движок; у `rules` его нет
			const promptVersionId = engine.systemPrompt === undefined ? null : await ensurePromptVersion(engine.systemPrompt);
			return runAgentCycle({
				provider: createMockProviderFromEnv(),
				journal: prismaJournal,
				engine,
				shadowEngine: shadowEngineFor(engine),
				config,
				runId,
				promptVersionId,
			});
		},
	});
}
