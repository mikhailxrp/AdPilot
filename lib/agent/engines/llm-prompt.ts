// Промпт движка `llm`: модель получает готовые метрики, цели, лимиты и границы значений — считает всё код.
// Деньги — рубли простыми числами (без ₽ и неразрывных пробелов, чтобы модель не повторяла их в ответе).
// На вход — только снимок кампании и конфиг: скрытые параметры симулятора сюда не попадают.

import { BUDGET_LIMITED_PCT } from '@/lib/agent/engines/rules';
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
	'- LOWER_BID — снизить ставку за клик (value — новая ставка), только если CPO выше допустимого или заказов нет;',
	'- RAISE_BID — повысить ставку за клик (value — новая ставка);',
	'- RAISE_BUDGET — повысить дневной бюджет (value — новый бюджет);',
	'- PAUSE — остановить кампанию.',
	'',
	'Как выбирать действие (сверху вниз, первое подходящее):',
	'1. Кампания на паузе — HOLD.',
	'2. Кликов меньше минимума — WAIT_DATA.',
	'3. Заказов нет: расход не меньше допустимого CPO — PAUSE или LOWER_BID, иначе WAIT_DATA.',
	'4. CPO выше допустимого — LOWER_BID или PAUSE.',
	'5. CPO не выше цели и бюджет выбран — RAISE_BUDGET.',
	'6. Иначе CPO в норме — HOLD, ставку не снижать.',
	'Цель CPO — ориентир, а граница — допустимый CPO: CPO выше цели, но в пределах допустимого — это норма, а не повод снижать ставку.',
	'Опирайся на блок «Сравнения»: в нём числа уже сравнены, сам их не сравнивай.',
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

/**
 * Один вывод по CPO, а не два («выше цели» + «в пределах допустимого»): в таске 6.1 модель видела
 * «выше цели» отдельной строкой и снижала ставку, хотя CPO был в допуске.
 */
function cpoVerdict(withinTarget: boolean, aboveAllowed: boolean): string {
	if (aboveAllowed) return '- CPO выше допустимого;';
	if (withinTarget) return '- CPO не выше цели — в норме;';
	return '- CPO выше цели, но в пределах допустимого — в норме, ставку не снижать;';
}

/**
 * Готовые выводы по кликам, CPO и бюджету — те же сравнения в целых числах, что в `decideByRules`,
 * чтобы модель не сравнивала числа сама и видела те же факты, что `rules`.
 */
export function comparisonLines(snapshot: CampaignSnapshot, config: RulesConfig): string[] {
	const { campaign, window, daySpend } = snapshot;
	const { minClicks, cpoTolerancePct } = config;
	const { targetCpo, dailyBudget } = campaign;
	const allowedScaled = targetCpo * (PERCENT + cpoTolerancePct);

	const clicks =
		window.clicks < minClicks
			? `- клики: ${window.clicks} — меньше минимума ${minClicks}, данных мало;`
			: `- клики: ${window.clicks} — не меньше минимума ${minClicks}, данных достаточно;`;

	const cpo =
		window.orders === 0
			? [
					window.cost * PERCENT >= allowedScaled
						? `- заказов нет, расход ${rub(window.cost)} руб. не меньше допустимого CPO;`
						: `- заказов нет, расход ${rub(window.cost)} руб. меньше допустимого CPO;`,
				]
			: [cpoVerdict(window.cost <= window.orders * targetCpo, window.cost * PERCENT > window.orders * allowedScaled)];

	const budgetLimited = daySpend * PERCENT >= dailyBudget * BUDGET_LIMITED_PCT;
	const spentPct = dailyBudget > 0 ? `${Math.floor((daySpend * PERCENT) / dailyBudget)}%` : NO_DATA;
	const budget = `- за сутки израсходовано ${spentPct} дневного бюджета — бюджет ${budgetLimited ? 'выбран' : 'не выбран'} (порог ${BUDGET_LIMITED_PCT}%).`;

	return [clicks, ...cpo, budget];
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
		'Сравнения (посчитаны кодом):',
		...comparisonLines(snapshot, config),
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
