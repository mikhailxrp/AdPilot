// Оценочные сценарии (PRD, требование 8): фиксированные снимки кампаний и допустимые действия.
// Снимки не зависят от симулятора и seed — результаты прогонов сравнимы между собой. Деньги — копейки.

import type { AdsCampaign } from '@/lib/ads/types';
import type { CampaignSnapshot, DecisionAction, RulesConfig } from '@/lib/agent/types';
import { computeMetrics, type MetricsInput } from '@/lib/metrics/metrics';

/** Явный конфиг оценки, а не `agentConfigSchema.parse({})`: смена дефолтов не меняет сценарии. */
export const EVAL_CONFIG: RulesConfig = {
	minClicks: 30,
	maxStepPct: 20,
	maxDailyBudget: 1_000_000,
	cooldownTicks: 3,
	cpoTolerancePct: 20,
	windowTicks: 16,
};

const EVAL_TICK = 40;

export interface EvalScenario {
	id: string;
	title: string;
	snapshot: CampaignSnapshot;
	/** Действия, которые считаются разумным решением. */
	allowed: readonly DecisionAction[];
}

const BASE_CAMPAIGN: AdsCampaign = {
	id: 'eval',
	name: 'Оценочная кампания',
	state: 'ON',
	bid: 2_000, // 20 ₽
	dailyBudget: 300_000, // 3 000 ₽
	targetCpo: 100_000, // 1 000 ₽, допустимый CPO с допуском 20% — 1 200 ₽
};

function snapshot(name: string, window: MetricsInput, daySpend: number): CampaignSnapshot {
	return {
		campaign: { ...BASE_CAMPAIGN, name },
		currentTick: EVAL_TICK,
		window,
		metrics: computeMetrics(window),
		daySpend,
	};
}

export const EVAL_SCENARIOS: readonly EvalScenario[] = [
	{
		id: 'bad-no-orders',
		title: 'Плохая: расход выше допустимого CPO, заказов нет',
		snapshot: snapshot('Плохая без заказов', { impressions: 6_000, clicks: 60, orders: 0, cost: 150_000 }, 150_000),
		allowed: ['PAUSE', 'LOWER_BID'],
	},
	{
		id: 'bad-high-cpo',
		title: 'Плохая: CPO заметно выше допустимого',
		snapshot: snapshot('Плохая с дорогим CPO', { impressions: 8_000, clicks: 80, orders: 2, cost: 400_000 }, 200_000),
		allowed: ['LOWER_BID', 'PAUSE'],
	},
	{
		id: 'low-data',
		title: 'Мало данных: кликов меньше минимума',
		snapshot: snapshot('Новая', { impressions: 1_200, clicks: 12, orders: 0, cost: 24_000 }, 24_000),
		allowed: ['WAIT_DATA', 'HOLD'],
	},
	{
		id: 'budget-limited',
		title: 'Нужно поднять бюджет: CPO ниже цели, бюджет почти выбран',
		snapshot: snapshot('Хорошая, упирается в бюджет', { impressions: 12_000, clicks: 120, orders: 4, cost: 320_000 }, 285_000),
		allowed: ['RAISE_BUDGET'],
	},
	{
		id: 'degraded',
		title: 'Капризная после деградации: конверсия упала, CPO вырос',
		snapshot: snapshot('Капризная', { impressions: 15_000, clicks: 150, orders: 1, cost: 500_000 }, 220_000),
		allowed: ['LOWER_BID', 'PAUSE'],
	},
	{
		id: 'healthy',
		title: 'В норме: CPO в допуске, бюджет не выбран',
		snapshot: snapshot('Стабильная', { impressions: 10_000, clicks: 100, orders: 3, cost: 330_000 }, 150_000),
		allowed: ['HOLD'],
	},
];
