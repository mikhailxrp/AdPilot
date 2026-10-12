// Разбор ответа модели: текст → `Proposal` (деньги в копейках) или отказ с причиной. Исключений не бросает.
// Проверяется только форма ответа; лимиты (шаг, потолок, cooldown, мало данных) — дело guardrails.

import type { DecisionAction, Proposal } from '@/lib/agent/types';
import { rubToKopecks } from '@/lib/metrics/money';
import { llmDecisionSchema } from '@/lib/validations/llm-decision';

export type LlmParseResult = { ok: true; proposal: Proposal } | { ok: false; reason: string };

/** Действия, которым нужно новое значение (ставка или бюджет). */
const VALUE_ACTIONS: readonly DecisionAction[] = ['LOWER_BID', 'RAISE_BID', 'RAISE_BUDGET'];

/** Ответ в markdown-обёртке: ```json … ``` или ``` … ```. */
const CODE_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

function unwrap(content: string): string {
	const trimmed = content.trim();
	return CODE_FENCE.exec(trimmed)?.[1] ?? trimmed;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false };
	}
}

export function parseLlmDecision(content: string): LlmParseResult {
	const json = parseJson(unwrap(content));
	if (!json.ok) return { ok: false, reason: 'Ответ модели не JSON' };

	const parsed = llmDecisionSchema.safeParse(json.value);
	if (!parsed.success) {
		const issues = parsed.error.issues.map(({ message }) => message).join('; ');
		return { ok: false, reason: `Ответ модели не по схеме: ${issues}` };
	}

	const { action, value, reason } = parsed.data;
	if (!VALUE_ACTIONS.includes(action)) {
		// Значение у действия без изменения ничего не меняет — отбрасываем, а не отклоняем.
		return { ok: true, proposal: { action, after: null, reason } };
	}
	if (value === null) {
		return { ok: false, reason: `Для ${action} не указано новое значение` };
	}
	const after = rubToKopecks(value);
	if (after <= 0) {
		return { ok: false, reason: `Для ${action} новое значение должно быть больше нуля, получено ${value}` };
	}
	return { ok: true, proposal: { action, after, reason } };
}
