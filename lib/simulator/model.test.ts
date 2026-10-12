import { describe, expect, it } from 'vitest';
import {
	dayStartTick,
	effectiveCr,
	expectedImpressions,
	simulateTick,
	type TickInput,
} from '@/lib/simulator/model';
import { CAMPAIGN_PRESETS, type PresetKey } from '@/lib/simulator/presets';

const SEED_COUNT = 100;
const DEGRADE_SAMPLE_SEEDS = 200;

function preset(key: PresetKey) {
	const found = CAMPAIGN_PRESETS.find((p) => p.key === key);
	if (!found) throw new Error(`Нет пресета ${key}`);
	return found;
}

function inputFor(key: PresetKey, overrides: Partial<TickInput> = {}): TickInput {
	const { bid, dailyBudget, truth } = preset(key);
	return {
		runSeed: 42,
		tick: 1,
		campaignKey: key,
		state: 'ON',
		bid,
		dailyBudget,
		spentToday: 0,
		truth,
		...overrides,
	};
}

describe('simulateTick', () => {
	it('одинаковый вход даёт одинаковый результат', () => {
		expect(simulateTick(inputFor('good'))).toEqual(simulateTick(inputFor('good')));
	});

	it('другой runSeed меняет результат', () => {
		const ticks = Array.from({ length: 10 }, (_, i) => i + 1);
		const differs = ticks.some(
			(tick) =>
				JSON.stringify(simulateTick(inputFor('good', { tick, runSeed: 42 }))) !==
				JSON.stringify(simulateTick(inputFor('good', { tick, runSeed: 43 }))),
		);
		expect(differs).toBe(true);
	});

	it('при том же seed ставка выше даёт не меньше показов', () => {
		for (let seed = 0; seed < SEED_COUNT; seed++) {
			const low = simulateTick(inputFor('good', { runSeed: seed, bid: 2_000 }));
			const high = simulateTick(inputFor('good', { runSeed: seed, bid: 4_000 }));
			expect(high.impressions).toBeGreaterThanOrEqual(low.impressions);
		}
	});

	it('расход не превышает остаток дневного бюджета', () => {
		const dailyBudget = 300_000;
		const spentToday = dailyBudget - 5_000;
		for (let seed = 0; seed < SEED_COUNT; seed++) {
			const result = simulateTick(inputFor('good', { runSeed: seed, dailyBudget, spentToday }));
			expect(result.cost).toBeLessThanOrEqual(dailyBudget - spentToday);
		}
	});

	it('бюджет исчерпан — тик из нулей', () => {
		const result = simulateTick(inputFor('good', { spentToday: 300_000 }));
		expect(result).toEqual({ impressions: 0, clicks: 0, orders: 0, cost: 0, bid: 2_000 });
	});

	it('остатка меньше ставки — тик из нулей', () => {
		const result = simulateTick(inputFor('good', { spentToday: 300_000 - 1_999 }));
		expect(result.cost).toBe(0);
		expect(result.impressions).toBe(0);
	});

	it('на паузе — тик из нулей', () => {
		const result = simulateTick(inputFor('good', { state: 'SUSPENDED' }));
		expect(result).toEqual({ impressions: 0, clicks: 0, orders: 0, cost: 0, bid: 2_000 });
	});

	it('нулевая ставка — тик из нулей', () => {
		expect(simulateTick(inputFor('good', { bid: 0 }))).toEqual({
			impressions: 0,
			clicks: 0,
			orders: 0,
			cost: 0,
			bid: 0,
		});
	});

	it('clicks ≤ impressions, orders ≤ clicks, всё целое и ≥ 0', () => {
		for (const { key } of CAMPAIGN_PRESETS) {
			for (let seed = 0; seed < SEED_COUNT; seed++) {
				const r = simulateTick(inputFor(key, { runSeed: seed, spentToday: seed * 2_000 }));
				for (const value of [r.impressions, r.clicks, r.orders, r.cost]) {
					expect(Number.isInteger(value)).toBe(true);
					expect(value).toBeGreaterThanOrEqual(0);
				}
				expect(r.clicks).toBeLessThanOrEqual(r.impressions);
				expect(r.orders).toBeLessThanOrEqual(r.clicks);
				expect(r.cost).toBe(r.clicks * r.bid);
			}
		}
	});

	it('у капризной после порога заказов заметно меньше', () => {
		const { truth } = preset('moody');
		const threshold = truth.degradeFromTick ?? 0;
		let before = 0;
		let after = 0;
		for (let seed = 0; seed < DEGRADE_SAMPLE_SEEDS; seed++) {
			before += simulateTick(inputFor('moody', { runSeed: seed, tick: threshold - 1 })).orders;
			after += simulateTick(inputFor('moody', { runSeed: seed, tick: threshold })).orders;
		}
		expect(after).toBeLessThan(before / 2);
	});
});

describe('expectedImpressions', () => {
	const { truth } = preset('good');

	it('строго растёт по ставке', () => {
		expect(expectedImpressions(2_000, truth)).toBeLessThan(expectedImpressions(2_500, truth));
		expect(expectedImpressions(2_500, truth)).toBeLessThan(expectedImpressions(5_000, truth));
	});

	it('при ставке, равной referenceBid, равен baseImpressions', () => {
		expect(expectedImpressions(truth.referenceBid, truth)).toBe(truth.baseImpressions);
	});

	it('при ставке 0 — 0', () => {
		expect(expectedImpressions(0, truth)).toBe(0);
	});
});

describe('effectiveCr', () => {
	it('у капризной: cr до порога, degradedCr с порога', () => {
		const { truth } = preset('moody');
		expect(effectiveCr(truth, 14)).toBe(truth.cr);
		expect(effectiveCr(truth, 15)).toBe(truth.degradedCr);
		expect(effectiveCr(truth, 100)).toBe(truth.degradedCr);
	});

	it('без порога — всегда cr', () => {
		const { truth } = preset('good');
		expect(effectiveCr(truth, 1_000)).toBe(truth.cr);
	});
});

describe('dayStartTick', () => {
	it.each([
		[1, 1],
		[24, 1],
		[25, 25],
		[48, 25],
		[49, 49],
	])('тик %i → начало суток %i', (tick, start) => {
		expect(dayStartTick(tick)).toBe(start);
	});
});
