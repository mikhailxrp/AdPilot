import { describe, expect, it } from 'vitest';
import type { AdsCampaign } from '@/lib/ads/types';
import { LLM_SYSTEM_PROMPT, buildLlmPrompt, comparisonLines, valueBounds } from '@/lib/agent/engines/llm-prompt';
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
	daySpend?: number;
}

function snapshot({ campaign, window, daySpend = 280_000 }: SnapshotOverrides = {}): CampaignSnapshot {
	const stats: MetricsInput = {
		impressions: 10_000,
		clicks: 200,
		orders: 2,
		cost: 400_000,
		...window,
	};
	return {
		campaign: { ...CAMPAIGN, ...campaign },
		currentTick: 20,
		window: stats,
		metrics: computeMetrics(stats),
		daySpend,
	};
}

describe('buildLlmPrompt', () => {
	it('system — общий текст с действиями и форматом ответа', () => {
		const { system } = buildLlmPrompt(snapshot(), CONFIG);
		expect(system).toBe(LLM_SYSTEM_PROMPT);
		for (const action of DECISION_ACTIONS) expect(system).toContain(action);
		expect(system).toContain('"value"');
	});

	it('переданный текст попадает в system вместо встроенного', () => {
		const { system } = buildLlmPrompt(snapshot(), CONFIG, 'Свой промпт');
		expect(system).toBe('Свой промпт');
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

describe('comparisonLines', () => {
	const lines = (overrides: SnapshotOverrides): string => comparisonLines(snapshot(overrides), CONFIG).join('\n');

	it('блок «Сравнения» — в пользовательском промпте', () => {
		const { user } = buildLlmPrompt(snapshot(), CONFIG);
		expect(user).toContain('Сравнения (посчитаны кодом):');
		for (const line of comparisonLines(snapshot(), CONFIG)) expect(user).toContain(line);
	});

	it('CPO 1100 при цели 1000 и допуске 20% → выше цели, но в пределах допустимого', () => {
		const text = lines({ window: { orders: 4, cost: 440_000 } });
		expect(text).toContain('- CPO выше цели, но в пределах допустимого — в норме, ставку не снижать;');
		expect(text.split('\n').filter((line) => line.startsWith('- CPO'))).toHaveLength(1);
	});

	it('CPO выше допустимого', () => {
		const text = lines({ window: { orders: 1, cost: 120_001 } });
		expect(text).toContain('- CPO выше допустимого;');
	});

	it('CPO ровно на допустимом — в пределах допустимого, как у rules', () => {
		expect(lines({ window: { orders: 1, cost: 120_000 } })).toContain(
			'- CPO выше цели, но в пределах допустимого — в норме, ставку не снижать;',
		);
	});

	it('CPO не выше цели', () => {
		expect(lines({ window: { orders: 1, cost: 100_000 } })).toContain('- CPO не выше цели — в норме;');
	});

	it('заказов нет → сравнение расхода с допустимым CPO, без сравнений CPO', () => {
		const spent = lines({ window: { orders: 0, cost: 120_000 } });
		expect(spent).toContain('- заказов нет, расход 1200.00 руб. не меньше допустимого CPO;');
		expect(spent).not.toContain('- CPO');
		expect(lines({ window: { orders: 0, cost: 119_999 } })).toContain(
			'- заказов нет, расход 1199.99 руб. меньше допустимого CPO;',
		);
	});

	it('клики относительно минимума', () => {
		expect(lines({ window: { clicks: 29 } })).toContain('- клики: 29 — меньше минимума 30, данных мало;');
		expect(lines({ window: { clicks: 30 } })).toContain('- клики: 30 — не меньше минимума 30, данных достаточно;');
	});

	it('бюджет выбран от 90% за сутки', () => {
		expect(lines({ daySpend: 270_000 })).toContain('израсходовано 90% дневного бюджета — бюджет выбран (порог 90%)');
		expect(lines({ daySpend: 269_999 })).toContain('израсходовано 89% дневного бюджета — бюджет не выбран (порог 90%)');
	});

	it('нулевой дневной бюджет — без деления на ноль', () => {
		expect(lines({ campaign: { dailyBudget: 0 } })).toContain(`израсходовано ${NO_DATA} дневного бюджета`);
	});

	it('системный промпт: порядок решений и HOLD в пределах допустимого', () => {
		expect(LLM_SYSTEM_PROMPT).toContain('Как выбирать действие');
		expect(LLM_SYSTEM_PROMPT).toContain('CPO в норме — HOLD, ставку не снижать');
		expect(LLM_SYSTEM_PROMPT).toContain('«Сравнения»');
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
