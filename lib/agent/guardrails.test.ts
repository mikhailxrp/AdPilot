import { describe, expect, it } from 'vitest';
import type { AdsCampaign } from '@/lib/ads/types';
import { beforeValue, checkProposal, type GuardrailContext } from '@/lib/agent/guardrails';
import type { Proposal, RulesConfig } from '@/lib/agent/types';

const CONFIG: RulesConfig = {
	minClicks: 30,
	maxStepPct: 20,
	maxDailyBudget: 1_000_000,
	cooldownTicks: 3,
	cpoTolerancePct: 20,
	windowTicks: 6,
};

const CAMPAIGN: AdsCampaign = {
	id: 'c1',
	name: 'Кампания',
	state: 'ON',
	bid: 2_000,
	dailyBudget: 300_000,
	targetCpo: 100_000,
};

function context(overrides: Partial<GuardrailContext> = {}): GuardrailContext {
	return {
		campaign: CAMPAIGN,
		windowClicks: 50,
		currentTick: 10,
		lastChangeTick: null,
		config: CONFIG,
		...overrides,
	};
}

function proposal(action: Proposal['action'], after: number | null): Proposal {
	return { action, after, reason: 'тест' };
}

function expectRejected(result: ReturnType<typeof checkProposal>, text: string): void {
	expect(result.verdict).toBe('REJECTED');
	if (result.verdict === 'REJECTED') expect(result.rejectReason).toContain(text);
}

describe('beforeValue', () => {
	it('ставка — для LOWER_BID и RAISE_BID', () => {
		expect(beforeValue('LOWER_BID', CAMPAIGN)).toBe(2_000);
		expect(beforeValue('RAISE_BID', CAMPAIGN)).toBe(2_000);
	});

	it('бюджет — для RAISE_BUDGET', () => {
		expect(beforeValue('RAISE_BUDGET', CAMPAIGN)).toBe(300_000);
	});

	it('null — для PAUSE, HOLD, WAIT_DATA', () => {
		expect(beforeValue('PAUSE', CAMPAIGN)).toBeNull();
		expect(beforeValue('HOLD', CAMPAIGN)).toBeNull();
		expect(beforeValue('WAIT_DATA', CAMPAIGN)).toBeNull();
	});
});

describe('checkProposal', () => {
	it('HOLD и WAIT_DATA принимаются даже без данных и в паузе между изменениями', () => {
		const ctx = context({ windowClicks: 0, lastChangeTick: 10 });
		expect(checkProposal(proposal('HOLD', null), ctx)).toEqual({ verdict: 'ACCEPTED', before: null, after: null });
		expect(checkProposal(proposal('WAIT_DATA', null), ctx).verdict).toBe('ACCEPTED');
	});

	it('HOLD с новым значением отклоняется', () => {
		expectRejected(checkProposal(proposal('HOLD', 1_000), context()), 'без изменений');
	});

	it('принятое изменение возвращает было/стало', () => {
		expect(checkProposal(proposal('LOWER_BID', 1_600), context())).toEqual({
			verdict: 'ACCEPTED',
			before: 2_000,
			after: 1_600,
		});
	});

	it('кампанию на паузе изменять нельзя', () => {
		const ctx = context({ campaign: { ...CAMPAIGN, state: 'SUSPENDED' } });
		expectRejected(checkProposal(proposal('PAUSE', null), ctx), 'на паузе');
		expectRejected(checkProposal(proposal('LOWER_BID', 1_600), ctx), 'на паузе');
	});

	describe('минимум данных', () => {
		it('ровно minClicks — принято', () => {
			expect(checkProposal(proposal('PAUSE', null), context({ windowClicks: 30 })).verdict).toBe('ACCEPTED');
		});

		it('меньше minClicks — отклонено', () => {
			expectRejected(checkProposal(proposal('PAUSE', null), context({ windowClicks: 29 })), 'Мало данных');
		});
	});

	describe('пауза между изменениями', () => {
		it('прошло ровно cooldownTicks — принято', () => {
			expect(checkProposal(proposal('LOWER_BID', 1_600), context({ lastChangeTick: 7 })).verdict).toBe('ACCEPTED');
		});

		it('прошло меньше cooldownTicks — отклонено', () => {
			expectRejected(checkProposal(proposal('LOWER_BID', 1_600), context({ lastChangeTick: 8 })), 'тике 8');
		});
	});

	describe('шаг изменения', () => {
		it('ровно maxStepPct — принято', () => {
			expect(checkProposal(proposal('LOWER_BID', 1_600), context()).verdict).toBe('ACCEPTED');
			expect(checkProposal(proposal('RAISE_BID', 2_400), context()).verdict).toBe('ACCEPTED');
			expect(checkProposal(proposal('RAISE_BUDGET', 360_000), context()).verdict).toBe('ACCEPTED');
		});

		it('на копейку больше maxStepPct — отклонено', () => {
			expectRejected(checkProposal(proposal('LOWER_BID', 1_599), context()), '20%');
			expectRejected(checkProposal(proposal('RAISE_BID', 2_401), context()), '20%');
			expectRejected(checkProposal(proposal('RAISE_BUDGET', 360_001), context()), '20%');
		});
	});

	describe('потолок дневного бюджета', () => {
		const ctx = context({ campaign: { ...CAMPAIGN, dailyBudget: 900_000 } });

		it('ровно maxDailyBudget — принято', () => {
			expect(checkProposal(proposal('RAISE_BUDGET', 1_000_000), ctx).verdict).toBe('ACCEPTED');
		});

		it('выше maxDailyBudget — отклонено', () => {
			expectRejected(checkProposal(proposal('RAISE_BUDGET', 1_000_001), ctx), 'потолка');
		});
	});

	it('неверное направление — отклонено', () => {
		expectRejected(checkProposal(proposal('LOWER_BID', 2_100), context()), 'уменьшать');
		expectRejected(checkProposal(proposal('RAISE_BID', 1_900), context()), 'увеличивать');
		expectRejected(checkProposal(proposal('RAISE_BUDGET', 300_000), context()), 'увеличивать');
	});

	it('значение не целое положительное или отсутствует — отклонено', () => {
		expectRejected(checkProposal(proposal('LOWER_BID', 0), context({ campaign: { ...CAMPAIGN, bid: 1 } })), 'целым');
		expectRejected(checkProposal(proposal('LOWER_BID', -100), context()), 'целым');
		expectRejected(checkProposal(proposal('LOWER_BID', 1_900.5), context()), 'целым');
		expectRejected(checkProposal(proposal('RAISE_BID', null), context()), 'целым');
	});

	it('PAUSE с новым значением — отклонено', () => {
		expectRejected(checkProposal(proposal('PAUSE', 1_000), context()), 'паузы');
	});

	it('отклонённое решение сохраняет предложенное значение', () => {
		expect(checkProposal(proposal('RAISE_BID', 5_000), context())).toMatchObject({
			verdict: 'REJECTED',
			before: 2_000,
			after: 5_000,
		});
	});
});
