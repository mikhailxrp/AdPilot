// Один тик для кнопки и worker-а: тик мира + цикл агента под advisory lock.

import { createMockProviderFromEnv } from '@/lib/ads/mock-provider';
import { getAgentConfig } from '@/lib/agent/config';
import { runAgentCycle } from '@/lib/agent/cycle';
import { rulesEngine } from '@/lib/agent/engines/rules';
import { prismaJournal } from '@/lib/agent/journal';
import { withTickLock } from '@/lib/agent/tick-lock';
import { runTickWith, type TickOutcome } from '@/lib/agent/tick-core';
import { db } from '@/lib/db';
import { RunStatus } from '@/generated/prisma/client';
import { runTick } from '@/lib/simulator/service';

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
		runCycle: ({ config, runId }) =>
			runAgentCycle({
				provider: createMockProviderFromEnv(),
				journal: prismaJournal,
				engine: rulesEngine,
				config,
				runId,
			}),
	});
}
