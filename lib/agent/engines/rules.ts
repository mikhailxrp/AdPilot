// Движок на правилах (PRD, требование 4): ждать данных, пауза при расходе без заказов,
// снижение ставки, повышение бюджета, не трогать. Первое сработавшее правило — решение.
// Сравнения в целых числах (копейки × проценты), чтобы границы не плыли из-за дробей.

import { formatRub } from '@/lib/metrics/format';
import type { AgentEngine, CampaignSnapshot, Proposal, RulesConfig } from '@/lib/agent/types';

const PERCENT = 100;

/** Бюджет считается выбранным, если за сутки израсходовано не меньше этой доли, %. */
export const BUDGET_LIMITED_PCT = 90;

/** Допустимый CPO: цель + допуск. Общий для текста причины и графика CPO на `/campaigns/[id]`. */
export function allowedCpo(targetCpo: number, tolerancePct: number): number {
	return (targetCpo * (PERCENT + tolerancePct)) / PERCENT;
}

export function decideByRules(snapshot: CampaignSnapshot, config: RulesConfig): Proposal {
	const { campaign, window, metrics, daySpend } = snapshot;
	const { minClicks, maxStepPct, maxDailyBudget, cpoTolerancePct, windowTicks } = config;
	const { targetCpo, bid, dailyBudget } = campaign;
	const allowed = allowedCpo(targetCpo, cpoTolerancePct);
	const allowedText = `${formatRub(allowed)} (цель ${formatRub(targetCpo)} + ${cpoTolerancePct}%)`;

	if (campaign.state === 'SUSPENDED') {
		return { action: 'HOLD', after: null, reason: 'Кампания на паузе — движок её не трогает' };
	}

	if (window.clicks < minClicks) {
		return {
			action: 'WAIT_DATA',
			after: null,
			reason: `Мало данных: ${window.clicks} кликов за ${windowTicks} тиков, нужно не меньше ${minClicks}`,
		};
	}

	if (window.orders === 0) {
		if (window.cost * PERCENT >= targetCpo * (PERCENT + cpoTolerancePct)) {
			return {
				action: 'PAUSE',
				after: null,
				reason: `Нет заказов при расходе ${formatRub(window.cost)} за ${windowTicks} тиков — больше допустимого CPO ${allowedText}`,
			};
		}
		return {
			action: 'WAIT_DATA',
			after: null,
			reason: `Заказов пока нет, расход ${formatRub(window.cost)} меньше допустимого CPO ${allowedText}`,
		};
	}

	const cpoText = formatRub(metrics.cpo);

	if (window.cost * PERCENT > window.orders * targetCpo * (PERCENT + cpoTolerancePct)) {
		const after = Math.ceil((bid * (PERCENT - maxStepPct)) / PERCENT);
		if (after >= bid) {
			return {
				action: 'HOLD',
				after: null,
				reason: `CPO ${cpoText} выше допустимого ${allowedText}, но ставку ${formatRub(bid)} снизить некуда`,
			};
		}
		return {
			action: 'LOWER_BID',
			after,
			reason: `CPO ${cpoText} выше допустимого ${allowedText}: ставка ${formatRub(bid)} → ${formatRub(after)} (−${maxStepPct}%)`,
		};
	}

	const budgetText = `за сутки израсходовано ${formatRub(daySpend)} из ${formatRub(dailyBudget)}`;
	const cpoWithinTarget = window.cost <= window.orders * targetCpo;
	const budgetLimited = daySpend * PERCENT >= dailyBudget * BUDGET_LIMITED_PCT;

	if (cpoWithinTarget && budgetLimited) {
		const after = Math.min(Math.floor((dailyBudget * (PERCENT + maxStepPct)) / PERCENT), maxDailyBudget);
		if (after <= dailyBudget) {
			return {
				action: 'HOLD',
				after: null,
				reason: `CPO ${cpoText} не выше цели ${formatRub(targetCpo)}, ${budgetText}, но бюджет уже на потолке ${formatRub(maxDailyBudget)}`,
			};
		}
		return {
			action: 'RAISE_BUDGET',
			after,
			reason: `CPO ${cpoText} не выше цели ${formatRub(targetCpo)}, ${budgetText}: бюджет ${formatRub(dailyBudget)} → ${formatRub(after)}`,
		};
	}

	return {
		action: 'HOLD',
		after: null,
		reason: `CPO ${cpoText} в пределах допустимого ${allowedText}, ${budgetText} — менять нечего`,
	};
}

/** Движок `rules` в форме `AgentEngine` для цикла агента. */
export const rulesEngine: AgentEngine = {
	name: 'RULES',
	decide: async (snapshot, config) => ({
		ok: true,
		proposal: decideByRules(snapshot, config),
		rawResponse: null,
	}),
};
