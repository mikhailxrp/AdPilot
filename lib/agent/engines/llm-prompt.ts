// Промпт движка `llm`: модель получает готовые метрики, цели, лимиты и границы значений — считает всё код.
// Деньги — рубли простыми числами (без ₽ и неразрывных пробелов, чтобы модель не повторяла их в ответе).
// На вход — только снимок кампании и конфиг: скрытые параметры симулятора сюда не попадают.

import type { CampaignSnapshot, RulesConfig } from '@/lib/agent/types';
import { NO_DATA } from '@/lib/metrics/format';
import { kopecksToRub } from '@/lib/metrics/money';

const PERCENT = 100;
const RUB_FRACTION_DIGITS = 2;
const PERCENT_FRACTION_DIGITS = 2;

export interface LlmPrompt {
	system: string;
	user: string;
}

export const LLM_SYSTEM_PROMPT = [
	'Ты агент, который ведёт рекламную кампанию в Яндекс Директе. Раз в тик ты получаешь статистику кампании',
	'и выбираешь одно действие. Все метрики и границы уже посчитаны — не пересчитывай их.',
	'',
	'Действия:',
	'- WAIT_DATA — данных мало, ждать;',
	'- HOLD — ничего не менять;',
	'- LOWER_BID — снизить ставку за клик (value — новая ставка);',
	'- RAISE_BID — повысить ставку за клик (value — новая ставка);',
	'- RAISE_BUDGET — повысить дневной бюджет (value — новый бюджет);',
	'- PAUSE — остановить кампанию.',
	'',
	'Правила:',
	'- деньги — в рублях, числом с точностью до копеек;',
	'- value указывай только для LOWER_BID, RAISE_BID, RAISE_BUDGET и только в пределах указанных границ, иначе null;',
	'- reason — коротко по-русски, с цифрами, на которые опирается решение.',
	'',
	'Ответ — только JSON-объект: {"action": "...", "value": число или null, "reason": "..."}.',
].join('\n');

function rub(kopecks: number | null): string {
	return kopecks === null ? NO_DATA : kopecksToRub(kopecks).toFixed(RUB_FRACTION_DIGITS);
}

function percent(ratio: number | null): string {
	return ratio === null ? NO_DATA : `${(ratio * PERCENT).toFixed(PERCENT_FRACTION_DIGITS)}%`;
}

/** Границы нового значения в копейках — те же формулы, что проверяют guardrails. */
export interface ValueBounds {
	lowerBid: { min: number; max: number } | null;
	raiseBidMax: number | null;
	raiseBudgetMax: number | null;
}

export function valueBounds(snapshot: CampaignSnapshot, config: RulesConfig): ValueBounds {
	const { bid, dailyBudget } = snapshot.campaign;
	const { maxStepPct, maxDailyBudget } = config;
	const lowerMin = Math.ceil((bid * (PERCENT - maxStepPct)) / PERCENT);
	const raiseBidMax = Math.floor((bid * (PERCENT + maxStepPct)) / PERCENT);
	const raiseBudgetMax = Math.min(Math.floor((dailyBudget * (PERCENT + maxStepPct)) / PERCENT), maxDailyBudget);
	return {
		lowerBid: lowerMin < bid ? { min: lowerMin, max: bid - 1 } : null,
		raiseBidMax: raiseBidMax > bid ? raiseBidMax : null,
		raiseBudgetMax: raiseBudgetMax > dailyBudget ? raiseBudgetMax : null,
	};
}

function boundsLines(bounds: ValueBounds): string[] {
	const unavailable = 'недоступно';
	return [
		`- новая ставка для LOWER_BID: ${bounds.lowerBid ? `от ${rub(bounds.lowerBid.min)} до ${rub(bounds.lowerBid.max)} руб.` : unavailable}`,
		`- новая ставка для RAISE_BID: ${bounds.raiseBidMax === null ? unavailable : `до ${rub(bounds.raiseBidMax)} руб.`}`,
		`- новый бюджет для RAISE_BUDGET: ${bounds.raiseBudgetMax === null ? unavailable : `до ${rub(bounds.raiseBudgetMax)} руб.`}`,
	];
}

export function buildLlmPrompt(snapshot: CampaignSnapshot, config: RulesConfig): LlmPrompt {
	const { campaign, currentTick, window, metrics, daySpend } = snapshot;
	const { minClicks, maxStepPct, maxDailyBudget, cooldownTicks, cpoTolerancePct, windowTicks } = config;
	const allowedCpo = (campaign.targetCpo * (PERCENT + cpoTolerancePct)) / PERCENT;

	const user = [
		`Кампания «${campaign.name}», тик ${currentTick}.`,
		`Состояние: ${campaign.state === 'ON' ? 'работает' : 'на паузе'}.`,
		`Ставка за клик: ${rub(campaign.bid)} руб. Дневной бюджет: ${rub(campaign.dailyBudget)} руб.`,
		`Цель CPO: ${rub(campaign.targetCpo)} руб. Допустимый CPO (цель + ${cpoTolerancePct}%): ${rub(allowedCpo)} руб.`,
		'',
		`Статистика за последние ${windowTicks} тиков:`,
		`- показы: ${window.impressions}, клики: ${window.clicks}, заказы: ${window.orders}, расход: ${rub(window.cost)} руб.`,
		`- CPC: ${rub(metrics.cpc)} руб., CPM: ${rub(metrics.cpm)} руб., CTR: ${percent(metrics.ctr)}, CR: ${percent(metrics.cr)}, CPO: ${rub(metrics.cpo)} руб.`,
		`Расход за последние сутки: ${rub(daySpend)} руб. из ${rub(campaign.dailyBudget)} руб.`,
		'',
		'Лимиты:',
		`- минимум данных для изменений: ${minClicks} кликов за окно;`,
		`- шаг изменения ставки или бюджета: не больше ${maxStepPct}%;`,
		`- потолок дневного бюджета: ${rub(maxDailyBudget)} руб.;`,
		`- пауза между изменениями одной кампании: ${cooldownTicks} тиков.`,
		'',
		'Допустимые значения:',
		...boundsLines(valueBounds(snapshot, config)),
	].join('\n');

	return { system: LLM_SYSTEM_PROMPT, user };
}
