// Общие типы агента: что видит движок и что он предлагает. Деньги — копейки.

import type { AdsCampaign } from '@/lib/ads/types';
import type { Metrics, MetricsInput } from '@/lib/metrics/metrics';
import type { AgentConfigInput } from '@/lib/validations/agent-config';

/** Значения enum `DecisionAction` без импорта из generated/prisma: из них соберётся Zod-схема ответа LLM. */
export const DECISION_ACTIONS = ['WAIT_DATA', 'HOLD', 'LOWER_BID', 'RAISE_BID', 'RAISE_BUDGET', 'PAUSE'] as const;

export type DecisionAction = (typeof DECISION_ACTIONS)[number];

/** Предложение движка: `after` — новая ставка или бюджет, для остальных действий `null`. */
export interface Proposal {
	action: DecisionAction;
	after: number | null;
	reason: string;
}

/** Состояние кампании на момент решения. */
export interface CampaignSnapshot {
	campaign: AdsCampaign;
	currentTick: number;
	/** Суммы за окно `windowTicks`. */
	window: MetricsInput;
	/** `computeMetrics(window)`. */
	metrics: Metrics;
	/** Расход за последние сутки (`TICKS_PER_DAY` тиков). */
	daySpend: number;
}

export type RulesConfig = Pick<
	AgentConfigInput,
	'minClicks' | 'maxStepPct' | 'maxDailyBudget' | 'cooldownTicks' | 'cpoTolerancePct' | 'windowTicks'
>;
