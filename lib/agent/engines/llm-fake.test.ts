// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createFakeLlmEngine, FAKE_REASON_PREFIX, toLlmAnswer } from '@/lib/agent/engines/llm-fake';
import { decideByRules } from '@/lib/agent/engines/rules';
import { runEval } from '@/lib/agent/eval/run-eval';
import { EVAL_CONFIG, EVAL_SCENARIOS } from '@/lib/agent/eval/scenarios';
import { llmDecisionSchema } from '@/lib/validations/llm-decision';

function scenario(id: string) {
	const found = EVAL_SCENARIOS.find((item) => item.id === id);
	if (!found) throw new Error(`Нет сценария ${id}`);
	return found.snapshot;
}

describe('toLlmAnswer', () => {
	it('переводит копейки в рубли и помечает причину', () => {
		const answer: unknown = JSON.parse(toLlmAnswer({ action: 'LOWER_BID', after: 1_650, reason: 'CPO выше' }));

		expect(llmDecisionSchema.parse(answer)).toEqual({ action: 'LOWER_BID', value: 16.5, reason: 'fake: CPO выше' });
	});
});

describe('createFakeLlmEngine', () => {
	const engine = createFakeLlmEngine();

	it('движок называется LLM', () => {
		expect(engine.name).toBe('LLM');
	});

	it('плохая кампания → то же действие и значение в копейках, что у rules; сырой ответ с пометкой fake', async () => {
		const snapshot = scenario('bad-high-cpo');
		const expected = decideByRules(snapshot, EVAL_CONFIG);

		const decision = await engine.decide(snapshot, EVAL_CONFIG);

		expect(expected.action).toBe('LOWER_BID');
		expect(decision).toEqual({
			ok: true,
			proposal: { ...expected, reason: `${FAKE_REASON_PREFIX}${expected.reason}` },
			rawResponse: toLlmAnswer(expected),
		});
		expect(decision.rawResponse).toContain(FAKE_REASON_PREFIX);
		expect(() => llmDecisionSchema.parse(JSON.parse(decision.rawResponse ?? ''))).not.toThrow();
	});

	it('мало данных → WAIT_DATA без значения', async () => {
		const decision = await engine.decide(scenario('low-data'), EVAL_CONFIG);

		expect(decision).toMatchObject({ ok: true, proposal: { action: 'WAIT_DATA', after: null } });
	});

	it('проходит все оценочные сценарии, как rules', async () => {
		const report = await runEval(engine, EVAL_SCENARIOS, EVAL_CONFIG);

		expect(report.rows.filter((row) => !row.passed).map((row) => row.missReason)).toEqual([]);
		expect(report.scorePct).toBe(100);
	});
});
