// Ограничения (PRD, требование 5): проверяют предложение любого движка.
// Значение за лимитом отклоняется, а не подрезается — в журнале видно, что предлагалось.

import type { AdsCampaign } from '@/lib/ads/types';
import { formatRub } from '@/lib/metrics/format';
import type { DecisionAction, Proposal, RulesConfig } from '@/lib/agent/types';

const PERCENT = 100;

export interface GuardrailContext {
	campaign: AdsCampaign;
	/** Клики за окно `windowTicks`. */
	windowClicks: number;
	currentTick: number;
	/** Тик последнего применённого изменения этой кампании; `null` — изменений не было. */
	lastChangeTick: number | null;
	config: RulesConfig;
}

export type GuardrailResult =
	| { verdict: 'ACCEPTED'; before: number | null; after: number | null }
	| { verdict: 'REJECTED'; before: number | null; after: number | null; rejectReason: string };

/** Что меняет действие: ставку, бюджет или ничего (`null`). */
export function beforeValue(action: DecisionAction, campaign: AdsCampaign): number | null {
	switch (action) {
		case 'LOWER_BID':
		case 'RAISE_BID':
			return campaign.bid;
		case 'RAISE_BUDGET':
			return campaign.dailyBudget;
		case 'PAUSE':
		case 'HOLD':
		case 'WAIT_DATA':
			return null;
	}
}

/** Причина отказа для значения ставки/бюджета или `null`, если значение в лимитах. */
function checkValue(action: DecisionAction, before: number, after: number | null, config: RulesConfig): string | null {
	if (after === null || !Number.isInteger(after) || after <= 0) {
		return 'Новое значение должно быть целым положительным числом копеек';
	}
	if (action === 'LOWER_BID' ? after >= before : after <= before) {
		return action === 'LOWER_BID' ? 'Снижение ставки должно уменьшать её' : 'Повышение должно увеличивать значение';
	}
	if (Math.abs(after - before) * PERCENT > before * config.maxStepPct) {
		return `Шаг ${formatRub(before)} → ${formatRub(after)} больше допустимых ${config.maxStepPct}%`;
	}
	if (action === 'RAISE_BUDGET' && after > config.maxDailyBudget) {
		return `Дневной бюджет ${formatRub(after)} выше потолка ${formatRub(config.maxDailyBudget)}`;
	}
	return null;
}

function rejectReason(proposal: Proposal, before: number | null, context: GuardrailContext): string | null {
	const { action, after } = proposal;
	const { campaign, windowClicks, currentTick, lastChangeTick, config } = context;

	if (action === 'HOLD' || action === 'WAIT_DATA') {
		return after === null ? null : 'У действия без изменений не должно быть нового значения';
	}
	if (campaign.state !== 'ON') {
		return 'Кампания на паузе — изменять её нельзя';
	}
	if (windowClicks < config.minClicks) {
		return `Мало данных: ${windowClicks} кликов, нужно не меньше ${config.minClicks}`;
	}
	if (lastChangeTick !== null && currentTick - lastChangeTick < config.cooldownTicks) {
		return `Кампанию меняли на тике ${lastChangeTick}, пауза между изменениями — ${config.cooldownTicks} тиков`;
	}
	if (action === 'PAUSE') {
		return after === null ? null : 'У паузы не должно быть нового значения';
	}
	return before === null ? null : checkValue(action, before, after, config);
}

export function checkProposal(proposal: Proposal, context: GuardrailContext): GuardrailResult {
	const before = beforeValue(proposal.action, context.campaign);
	const reason = rejectReason(proposal, before, context);
	if (reason === null) return { verdict: 'ACCEPTED', before, after: proposal.after };
	return { verdict: 'REJECTED', before, after: proposal.after, rejectReason: reason };
}
