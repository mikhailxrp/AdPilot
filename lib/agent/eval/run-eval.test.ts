// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EVAL_CONFIG, EVAL_SCENARIOS } from '@/lib/agent/eval/scenarios';
import { runEval } from '@/lib/agent/eval/run-eval';
import { createLlmEngine } from '@/lib/agent/engines/llm';
import { rulesEngine } from '@/lib/agent/engines/rules';
import { FakeLLMClient, type FakeResponder } from '@/lib/llm/fake-client';
import { LLMClientError } from '@/lib/llm/types';
import { computeMetrics } from '@/lib/metrics/metrics';

const HOLD_ANSWER = JSON.stringify({ action: 'HOLD', value: null, reason: 'держим' });

function runLlm(respond: FakeResponder) {
	return runEval(createLlmEngine(new FakeLLMClient(respond)), EVAL_SCENARIOS, EVAL_CONFIG);
}

describe('EVAL_SCENARIOS', () => {
	it('id уникальны, допустимые действия заданы', () => {
		const ids = EVAL_SCENARIOS.map(({ id }) => id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const { allowed } of EVAL_SCENARIOS) expect(allowed.length).toBeGreaterThan(0);
	});

	it('метрики снимка согласованы с окном', () => {
		for (const { snapshot } of EVAL_SCENARIOS) {
			expect(snapshot.metrics).toEqual(computeMetrics(snapshot.window));
		}
	});
});

describe('runEval', () => {
	it('rules проходит все сценарии', async () => {
		const report = await runEval(rulesEngine, EVAL_SCENARIOS, EVAL_CONFIG);

		expect(report.rows.filter((row) => !row.passed).map((row) => row.missReason)).toEqual([]);
		expect(report).toMatchObject({ passed: EVAL_SCENARIOS.length, total: EVAL_SCENARIOS.length, scorePct: 100 });
	});

	it('llm, всегда отвечающая HOLD, промахивается там, где нужно действовать', async () => {
		const report = await runLlm(() => HOLD_ANSWER);

		const missed = report.rows.filter((row) => !row.passed).map((row) => row.scenarioId);
		expect(missed).toEqual(['bad-no-orders', 'bad-high-cpo', 'budget-limited', 'degraded']);
		expect(report).toMatchObject({ passed: 2, total: 6, scorePct: 33 });
		expect(report.rows[0]?.missReason).toContain('HOLD');
		expect(report.rows[0]?.rawResponse).toBe(HOLD_ANSWER);
	});

	it('ответ не JSON → промах с причиной отказа и сырым ответом', async () => {
		const report = await runLlm(() => 'снизь ставку');

		expect(report.passed).toBe(0);
		expect(report.rows[0]).toMatchObject({
			action: null,
			rawResponse: 'снизь ставку',
			passed: false,
			missReason: 'Движок отказал: Ответ модели не JSON',
		});
	});

	it('модель недоступна → промах, прогон не падает', async () => {
		const report = await runLlm(() => new LLMClientError('unavailable', 'сервис недоступен'));

		expect(report).toMatchObject({ passed: 0, total: 6, scorePct: 0 });
		expect(report.rows[0]?.missReason).toContain('Модель недоступна');
	});

	it('верное действие, но шаг больше maxStepPct → промах из-за guardrails', async () => {
		// bad-high-cpo: ставка 20 ₽, 10 ₽ — это −50% при лимите 20%
		const report = await runLlm((request) =>
			request.user.includes('Плохая с дорогим CPO')
				? JSON.stringify({ action: 'LOWER_BID', value: 10, reason: 'резко снижаем' })
				: HOLD_ANSWER,
		);

		const row = report.rows.find((item) => item.scenarioId === 'bad-high-cpo');
		expect(row).toMatchObject({ action: 'LOWER_BID', after: 1_000, passed: false });
		expect(row?.missReason).toContain('guardrails');
	});

	it('пустой набор → 0 баллов', async () => {
		expect(await runEval(rulesEngine, [], EVAL_CONFIG)).toEqual({ rows: [], passed: 0, total: 0, scorePct: 0 });
	});
});
