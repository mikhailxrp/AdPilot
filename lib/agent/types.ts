// Общие типы агента: что видит движок и что он предлагает. Деньги — копейки.

import type { AdsCampaign } from '@/lib/ads/types';
import type { Metrics, MetricsInput } from '@/lib/metrics/metrics';
import type { AGENT_ENGINES, AgentConfigInput } from '@/lib/validations/agent-config';

/** Значения enum `DecisionAction` без импорта из generated/prisma: из них соберётся Zod-схема ответа LLM. */
export const DECISION_ACTIONS = ['WAIT_DATA', 'HOLD', 'LOWER_BID', 'RAISE_BID', 'RAISE_BUDGET', 'PAUSE'] as const;

export type AgentEngineName = (typeof AGENT_ENGINES)[number];

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

/**
 * Ответ движка: предложение или отказ («модель не дала решения»). Отказ — значение, а не исключение:
 * цикл пишет его в журнал как `HOLD` + `REJECTED`. `rawResponse` — сырой ответ LLM, у `rules` — `null`.
 */
export type EngineDecision =
	| { ok: true; proposal: Proposal; rawResponse: string | null }
	| { ok: false; rejectReason: string; rawResponse: string | null };

/** Движок решений: `rules` или `llm`. */
export interface AgentEngine {
	name: AgentEngineName;
	decide(snapshot: CampaignSnapshot, config: RulesConfig): Promise<EngineDecision>;
}

/** Действия, которые меняют кампанию в кабинете. */
export const CHANGE_ACTIONS = ['LOWER_BID', 'RAISE_BID', 'RAISE_BUDGET', 'PAUSE'] as const satisfies readonly DecisionAction[];

export type DecisionVerdict = 'ACCEPTED' | 'REJECTED';

/** Метрики на момент решения — содержимое `Decision.metrics`. */
export interface DecisionMetrics {
	windowTicks: number;
	window: MetricsInput;
	metrics: Metrics;
	daySpend: number;
}

/** Запись журнала до сохранения. */
export interface JournalEntry {
	runId: string;
	campaignId: string;
	tick: number;
	engine: AgentEngineName;
	action: DecisionAction;
	before: number | null;
	after: number | null;
	reason: string;
	metrics: DecisionMetrics;
	dryRun: boolean;
	verdict: DecisionVerdict;
	rejectReason: string | null;
	rawResponse: string | null;
}

/** Журнал решений: только дополняется, единственное изменение — `applyError`. */
export interface Journal {
	record(entry: JournalEntry): Promise<{ id: string }>;
	setApplyError(id: string, message: string): Promise<void>;
	/** Тик последнего применённого изменения по каждой кампании; кампаний без изменений в карте нет. */
	lastChangeTicks(runId: string, campaignIds: readonly string[]): Promise<Map<string, number>>;
}
