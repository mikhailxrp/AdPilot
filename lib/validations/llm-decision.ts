import { z } from 'zod';
import { DECISION_ACTIONS } from '@/lib/agent/types';
import type { LLMJsonSchema } from '@/lib/llm/types';

// Ответ модели (Phase 3): действие, новое значение в рублях, причина.
// Схема проверяет только форму; лимиты (шаг, потолок, cooldown) — в guardrails.

/** Причина пишется в журнал — ограничиваем, чтобы модель не заполнила его простынёй. */
export const LLM_REASON_MAX_LENGTH = 500;

export const llmDecisionSchema = z.object({
	action: z.enum(DECISION_ACTIONS, `action должен быть одним из: ${DECISION_ACTIONS.join(', ')}`),
	value: z.number('value должен быть числом в рублях или null').nullable(),
	reason: z
		.string('reason должен быть строкой')
		.trim()
		.min(1, 'reason не должен быть пустым')
		.max(LLM_REASON_MAX_LENGTH, `reason длиннее ${LLM_REASON_MAX_LENGTH} символов`),
});

export type LlmDecision = z.infer<typeof llmDecisionSchema>;

/** JSON Schema для `response_format: json_schema` — из той же Zod-схемы, что проверяет ответ. */
export const LLM_DECISION_JSON_SCHEMA: LLMJsonSchema = {
	name: 'agent_decision',
	schema: z.toJSONSchema(llmDecisionSchema),
};
