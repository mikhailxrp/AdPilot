import { z } from 'zod';

// Конфиг агента: единственный источник дефолтов (в Prisma у полей нет @default).
// Деньги — копейки, проценты — целые. Стартовые пороги подобраны на моке (Phase 2, таск 7,
// lib/agent/scenario.test.ts): окно 6 тиков не набирало данных для «плохой», 16 — устойчиво на разных seed.

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
	windowTicks: { min: 1, max: 168, default: 16 },
} as const satisfies Record<string, IntBounds>;

/** Температура модели: 0 — детерминированно, 1 — максимум разнообразия. */
export const LLM_TEMPERATURE_BOUNDS = { min: 0, max: 1 } as const;

function boundedInt({ min, max, default: fallback }: IntBounds) {
	const message = `Целое число от ${min} до ${max}`;
	return z.int(message).min(min, message).max(max, message).default(fallback);
}

/** Конфиг без параметров LLM — то, что редактирует форма /settings (таск 5). */
export const agentConfigBaseSchema = z.object({
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

export type AgentConfigBaseInput = z.infer<typeof agentConfigBaseSchema>;

const temperatureMessage = `Число от ${LLM_TEMPERATURE_BOUNDS.min} до ${LLM_TEMPERATURE_BOUNDS.max}`;

/**
 * Параметры LLM: `null` — «по умолчанию» (встроенный промпт; модель и температура из env / констант).
 * Текст промпта хранится как есть, без trim: пустой или пробельный отклоняется, «по умолчанию» — это `null`.
 */
export const agentConfigSchema = agentConfigBaseSchema.extend({
	llmSystemPrompt: z
		.string()
		.refine((text) => text.trim().length > 0, 'Промпт не может быть пустым')
		.nullable()
		.default(null),
	llmModelUri: z.string().nullable().default(null),
	llmTemperature: z
		.number(temperatureMessage)
		.min(LLM_TEMPERATURE_BOUNDS.min, temperatureMessage)
		.max(LLM_TEMPERATURE_BOUNDS.max, temperatureMessage)
		.nullable()
		.default(null),
});

export type AgentConfigInput = z.infer<typeof agentConfigSchema>;

/** Переключатель таймера на /simulator: без дефолта — значение обязано прийти явно. */
export const timerToggleSchema = z.object({ timerEnabled: z.boolean('Ожидается true или false') });

export type TimerToggleInput = z.infer<typeof timerToggleSchema>;

/** Переключатель движка на /simulator: без дефолта — значение обязано прийти явно. */
export const engineToggleSchema = z.object({ engine: z.enum(AGENT_ENGINES, 'Неизвестный движок агента') });

export type EngineToggleInput = z.infer<typeof engineToggleSchema>;
