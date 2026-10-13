// Движок `llm`: промпт из снимка → модель → разбор ответа. Лимиты не проверяет — это делают общие guardrails.
// Невалидный ответ и недоступная модель — отказ движка (значение), а не исключение; прочие ошибки — баги, пробрасываются.

import { parseLlmDecision } from '@/lib/agent/engines/llm-parse';
import { LLM_SYSTEM_PROMPT, buildLlmPrompt } from '@/lib/agent/engines/llm-prompt';
import type { AgentEngine } from '@/lib/agent/types';
import { LLMClientError, type LLMClient, type LLMResponse } from '@/lib/llm/types';
import { LLM_DECISION_JSON_SCHEMA } from '@/lib/validations/llm-decision';

export interface LlmEngineOptions {
	/** Системный промпт; по умолчанию встроенный. Он же пишется в журнал как версия. */
	systemPrompt?: string;
}

export function createLlmEngine(
	client: LLMClient,
	{ systemPrompt = LLM_SYSTEM_PROMPT }: LlmEngineOptions = {},
): AgentEngine {
	return {
		name: 'LLM',
		systemPrompt,
		decide: async (snapshot, config) => {
			const { system, user } = buildLlmPrompt(snapshot, config, systemPrompt);

			let response: LLMResponse;
			try {
				response = await client.complete({ system, user, jsonSchema: LLM_DECISION_JSON_SCHEMA });
			} catch (error) {
				if (!(error instanceof LLMClientError)) throw error;
				console.error(`Модель недоступна (${error.code}):`, error);
				return { ok: false, rejectReason: `Модель недоступна: ${error.message}`, rawResponse: null };
			}

			const parsed = parseLlmDecision(response.content);
			if (!parsed.ok) return { ok: false, rejectReason: parsed.reason, rawResponse: response.raw };
			return { ok: true, proposal: parsed.proposal, rawResponse: response.raw };
		},
	};
}
