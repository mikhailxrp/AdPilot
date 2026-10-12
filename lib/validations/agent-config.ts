import { z } from 'zod';

// Конфиг агента: единственный источник дефолтов (в Prisma у полей нет @default).
// Деньги — копейки, проценты — целые. Стартовые пороги подбираются в Phase 2, таск 7.

/** Конфиг в БД всегда один — строка с этим id. */
export const AGENT_CONFIG_ID = 'default';

/** Без импорта из generated/prisma: схему подключит клиентская форма /settings. */
export const AGENT_ENGINES = ['RULES', 'LLM'] as const;

interface IntBounds {
	min: number;
	max: number;
	default: number;
}

export const AGENT_CONFIG_BOUNDS = {
	tickIntervalSec: { min: 5, max: 3600, default: 60 },
	minClicks: { min: 1, max: 1000, default: 30 },
	maxStepPct: { min: 1, max: 50, default: 20 },
	maxDailyBudget: { min: 1, max: 100_000_000, default: 1_000_000 },
	cooldownTicks: { min: 0, max: 168, default: 3 },
	cpoTolerancePct: { min: 0, max: 100, default: 20 },
	windowTicks: { min: 1, max: 168, default: 6 },
} as const satisfies Record<string, IntBounds>;

function boundedInt({ min, max, default: fallback }: IntBounds) {
	const message = `Целое число от ${min} до ${max}`;
	return z.int(message).min(min, message).max(max, message).default(fallback);
}

export const agentConfigSchema = z.object({
	engine: z.enum(AGENT_ENGINES).default('RULES'),
	dryRun: z.boolean().default(false),
	timerEnabled: z.boolean().default(false),
	tickIntervalSec: boundedInt(AGENT_CONFIG_BOUNDS.tickIntervalSec),
	minClicks: boundedInt(AGENT_CONFIG_BOUNDS.minClicks),
	maxStepPct: boundedInt(AGENT_CONFIG_BOUNDS.maxStepPct),
	maxDailyBudget: boundedInt(AGENT_CONFIG_BOUNDS.maxDailyBudget),
	cooldownTicks: boundedInt(AGENT_CONFIG_BOUNDS.cooldownTicks),
	cpoTolerancePct: boundedInt(AGENT_CONFIG_BOUNDS.cpoTolerancePct),
	windowTicks: boundedInt(AGENT_CONFIG_BOUNDS.windowTicks),
});

export type AgentConfigInput = z.infer<typeof agentConfigSchema>;
