import { describe, expect, it } from 'vitest';
import type { AdsCampaign } from '@/lib/ads/types';
import { LLM_SYSTEM_PROMPT, buildLlmPrompt, valueBounds } from '@/lib/agent/engines/llm-prompt';
import { DECISION_ACTIONS, type CampaignSnapshot, type RulesConfig } from '@/lib/agent/types';
import { NO_DATA } from '@/lib/metrics/format';
import { computeMetrics, type MetricsInput } from '@/lib/metrics/metrics';

const CONFIG: RulesConfig = {
	minClicks: 30,
	maxStepPct: 20,
	maxDailyBudget: 1_000_000,
	cooldownTicks: 3,
	cpoTolerancePct: 20,
	windowTicks: 16,
};

const CAMPAIGN: AdsCampaign = {
	id: 'c1',
	name: 'Плохая',
	state: 'ON',
	bid: 2_000,
	dailyBudget: 300_000,
	targetCpo: 100_000,
};

interface SnapshotOverrides {
	campaign?: Partial<AdsCampaign>;
	window?: Partial<MetricsInput>;
}

function snapshot({ campaign, window }: SnapshotOverrides = {}): CampaignSnapshot {
	const stats: MetricsInput = { impressions: 10_000, clicks: 200, orders: 2, cost: 400_000, ...window };
	return {
		campaign: { ...CAMPAIGN, ...campaign },
		currentTick: 20,
		window: stats,
		metrics: computeMetrics(stats),
		daySpend: 280_000,
	};
}

describe('buildLlmPrompt', () => {
	it('system — общий текст с действиями и форматом ответа', () => {
		const { system } = buildLlmPrompt(snapshot(), CONFIG);
		expect(system).toBe(LLM_SYSTEM_PROMPT);
		for (const action of DECISION_ACTIONS) expect(system).toContain(action);
		expect(system).toContain('"value"');
	});

	it('кампания, цель и лимиты — в рублях', () => {
		const { user } = buildLlmPrompt(snapshot(), CONFIG);
		expect(user).toContain('Ставка за клик: 20.00 руб.');
		expect(user).toContain('Дневной бюджет: 3000.00 руб.');
		expect(user).toContain('Цель CPO: 1000.00 руб.');
		expect(user).toContain('Допустимый CPO (цель + 20%): 1200.00 руб.');
		expect(user).toContain('потолок дневного бюджета: 10000.00 руб.');
		expect(user).toContain('30 кликов');
		expect(user).toContain('не больше 20%');
		expect(user).toContain('3 тиков');
		expect(user).toContain('Расход за последние сутки: 2800.00 руб.');
	});

	it('метрики посчитаны кодом и переданы готовыми', () => {
		const { user } = buildLlmPrompt(snapshot(), CONFIG);
		expect(user).toContain('за последние 16 тиков');
		expect(user).toContain('показы: 10000, клики: 200, заказы: 2, расход: 4000.00 руб.');
		expect(user).toContain('CPC: 20.00 руб.');
		expect(user).toContain('CPM: 400.00 руб.');
		expect(user).toContain('CTR: 2.00%');
		expect(user).toContain('CR: 1.00%');
		expect(user).toContain('CPO: 2000.00 руб.');
	});

	it('метрики без данных → «нет данных»', () => {
		const { user } = buildLlmPrompt(snapshot({ window: { impressions: 0, clicks: 0, orders: 0, cost: 0 } }), CONFIG);
		expect(user).toContain(`CPC: ${NO_DATA}`);
		expect(user).toContain(`CTR: ${NO_DATA}`);
		expect(user).toContain(`CPO: ${NO_DATA}`);
	});

	it('границы новых значений — в промпте', () => {
		const { user } = buildLlmPrompt(snapshot(), CONFIG);
		expect(user).toContain('LOWER_BID: от 16.00 до 19.99 руб.');
		expect(user).toContain('RAISE_BID: до 24.00 руб.');
		expect(user).toContain('RAISE_BUDGET: до 3600.00 руб.');
	});

	it('кампания на паузе отмечена', () => {
		expect(buildLlmPrompt(snapshot({ campaign: { state: 'SUSPENDED' } }), CONFIG).user).toContain('на паузе');
	});

	it('нет скрытых параметров симулятора', () => {
		const { system, user } = buildLlmPrompt(snapshot(), CONFIG);
		const text = `${system}\n${user}`;
		for (const hidden of ['referenceBid', 'reference_bid', 'bidSensitivity', 'baseImpressions', 'degrade', 'truth']) {
			expect(text).not.toContain(hidden);
		}
		expect(text).not.toContain(CAMPAIGN.id);
	});
});

describe('valueBounds', () => {
	it('совпадают с формулами guardrails', () => {
		expect(valueBounds(snapshot(), CONFIG)).toEqual({
			lowerBid: { min: 1_600, max: 1_999 },
			raiseBidMax: 2_400,
			raiseBudgetMax: 360_000,
		});
	});

	it('бюджет на потолке — повышать некуда', () => {
		const atCeiling = snapshot({ campaign: { dailyBudget: 1_000_000 } });
		expect(valueBounds(atCeiling, CONFIG).raiseBudgetMax).toBeNull();
		expect(buildLlmPrompt(atCeiling, CONFIG).user).toContain('RAISE_BUDGET: недоступно');
	});

	it('потолок бюджета обрезает шаг', () => {
		expect(valueBounds(snapshot({ campaign: { dailyBudget: 900_000 } }), CONFIG).raiseBudgetMax).toBe(1_000_000);
	});

	it('ставка 1 копейка — менять некуда', () => {
		const bounds = valueBounds(snapshot({ campaign: { bid: 1 } }), CONFIG);
		expect(bounds.lowerBid).toBeNull();
		expect(bounds.raiseBidMax).toBeNull();
	});
});
