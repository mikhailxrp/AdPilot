import { describe, expect, it } from 'vitest';
import { DECISION_ACTIONS } from '@/lib/agent/types';
import { LLM_DECISION_JSON_SCHEMA, LLM_REASON_MAX_LENGTH, llmDecisionSchema } from '@/lib/validations/llm-decision';

describe('llmDecisionSchema', () => {
	it('валидный ответ проходит', () => {
		const result = llmDecisionSchema.safeParse({ action: 'LOWER_BID', value: 16.5, reason: 'CPO выше цели' });
		expect(result.success).toBe(true);
	});

	it('value: null проходит', () => {
		expect(llmDecisionSchema.safeParse({ action: 'HOLD', value: null, reason: 'в норме' }).success).toBe(true);
	});

	it('неизвестное действие отклоняется', () => {
		expect(llmDecisionSchema.safeParse({ action: 'DELETE', value: null, reason: 'x' }).success).toBe(false);
	});

	it('пустой reason отклоняется', () => {
		expect(llmDecisionSchema.safeParse({ action: 'HOLD', value: null, reason: '   ' }).success).toBe(false);
	});

	it('слишком длинный reason отклоняется', () => {
		const reason = 'а'.repeat(LLM_REASON_MAX_LENGTH + 1);
		expect(llmDecisionSchema.safeParse({ action: 'HOLD', value: null, reason }).success).toBe(false);
	});

	it('value строкой отклоняется', () => {
		expect(llmDecisionSchema.safeParse({ action: 'RAISE_BID', value: '20', reason: 'x' }).success).toBe(false);
	});
});

describe('LLM_DECISION_JSON_SCHEMA', () => {
	it('содержит все действия и обязательные поля', () => {
		const text = JSON.stringify(LLM_DECISION_JSON_SCHEMA.schema);
		for (const action of DECISION_ACTIONS) expect(text).toContain(`"${action}"`);
		expect(LLM_DECISION_JSON_SCHEMA.schema).toMatchObject({ required: ['action', 'value', 'reason'] });
	});
});
