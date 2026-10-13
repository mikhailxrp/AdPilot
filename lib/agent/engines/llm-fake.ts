// Fake-движок `llm` для `LLM_CLIENT=fake` (e2e): «модель» отвечает решением `rules` на том же снимке, детерминированно.
// Ответ идёт через настоящий `createLlmEngine` — промпт, разбор Zod, рубли → копейки, — чтобы e2e проверял весь путь.

import { createLlmEngine, type LlmEngineOptions } from '@/lib/agent/engines/llm';
import { LLM_SYSTEM_PROMPT } from '@/lib/agent/engines/llm-prompt';
import { decideByRules } from '@/lib/agent/engines/rules';
import type { AgentEngine, Proposal } from '@/lib/agent/types';
import { FakeLLMClient } from '@/lib/llm/fake-client';
import { kopecksToRub } from '@/lib/metrics/money';
import type { LlmDecision } from '@/lib/validations/llm-decision';

/** Пометка в `reason`: по журналу и в e2e видно, что решал fake, а не настоящая модель. */
export const FAKE_REASON_PREFIX = 'fake: ';

/** Решение `rules` в формате ответа модели: деньги в рублях. */
export function toLlmAnswer(proposal: Proposal): string {
	const answer: LlmDecision = {
		action: proposal.action,
		value: proposal.after === null ? null : kopecksToRub(proposal.after),
		reason: `${FAKE_REASON_PREFIX}${proposal.reason}`,
	};
	return JSON.stringify(answer);
}

export function createFakeLlmEngine({ systemPrompt = LLM_SYSTEM_PROMPT }: LlmEngineOptions = {}): AgentEngine {
	return {
		name: 'LLM',
		systemPrompt,
		decide: (snapshot, config) => {
			const answer = toLlmAnswer(decideByRules(snapshot, config));
			return createLlmEngine(new FakeLLMClient(() => answer), { systemPrompt }).decide(snapshot, config);
		},
	};
}
