// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createLlmEngine } from '@/lib/agent/engines/llm';
import { buildLlmPrompt } from '@/lib/agent/engines/llm-prompt';
import type { CampaignSnapshot, RulesConfig } from '@/lib/agent/types';
import { FakeLLMClient } from '@/lib/llm/fake-client';
import { LLMClientError } from '@/lib/llm/types';
import { computeMetrics, type MetricsInput } from '@/lib/metrics/metrics';
import { LLM_DECISION_JSON_SCHEMA } from '@/lib/validations/llm-decision';

const CONFIG: RulesConfig = {
	minClicks: 30,
	maxStepPct: 20,
	maxDailyBudget: 1_000_000,
	cooldownTicks: 3,
	cpoTolerancePct: 20,
	windowTicks: 16,
};

const WINDOW: MetricsInput = { impressions: 10_000, clicks: 200, orders: 2, cost: 400_000 };

const SNAPSHOT: CampaignSnapshot = {
	campaign: { id: 'c1', name: 'Плохая', state: 'ON', bid: 2_000, dailyBudget: 300_000, targetCpo: 100_000 },
	currentTick: 20,
	window: WINDOW,
	metrics: computeMetrics(WINDOW),
	daySpend: 280_000,
};

const LOWER_BID_ANSWER = JSON.stringify({ action: 'LOWER_BID', value: 16.5, reason: 'CPO выше цели' });

describe('createLlmEngine', () => {
	it('движок называется LLM', () => {
		expect(createLlmEngine(new FakeLLMClient(() => LOWER_BID_ANSWER)).name).toBe('LLM');
	});

	it('отправляет промпт из снимка и JSON Schema ответа', async () => {
		const client = new FakeLLMClient(() => LOWER_BID_ANSWER);
		await createLlmEngine(client).decide(SNAPSHOT, CONFIG);

		expect(client.requests).toEqual([{ ...buildLlmPrompt(SNAPSHOT, CONFIG), jsonSchema: LLM_DECISION_JSON_SCHEMA }]);
	});

	it('валидный ответ → предложение в копейках и сырой ответ', async () => {
		const decision = await createLlmEngine(new FakeLLMClient(() => LOWER_BID_ANSWER)).decide(SNAPSHOT, CONFIG);

		expect(decision).toEqual({
			ok: true,
			proposal: { action: 'LOWER_BID', after: 1_650, reason: 'CPO выше цели' },
			rawResponse: LOWER_BID_ANSWER,
		});
	});

	it('ответ не JSON → отказ с причиной и сырым ответом', async () => {
		const decision = await createLlmEngine(new FakeLLMClient(() => 'снизь ставку')).decide(SNAPSHOT, CONFIG);

		expect(decision).toEqual({ ok: false, rejectReason: 'Ответ модели не JSON', rawResponse: 'снизь ставку' });
	});

	it('модель недоступна → отказ без сырого ответа', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const client = new FakeLLMClient(() => new LLMClientError('unavailable', 'Модель не ответила за 30000 мс'));

		const decision = await createLlmEngine(client).decide(SNAPSHOT, CONFIG);

		expect(decision).toEqual({
			ok: false,
			rejectReason: 'Модель недоступна: Модель не ответила за 30000 мс',
			rawResponse: null,
		});
	});

	it('прочая ошибка клиента — не отказ, а исключение', async () => {
		const client = { complete: async () => Promise.reject(new TypeError('баг')) };

		await expect(createLlmEngine(client).decide(SNAPSHOT, CONFIG)).rejects.toThrow('баг');
	});
});
