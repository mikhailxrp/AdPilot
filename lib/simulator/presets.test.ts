import { describe, expect, it } from 'vitest';
import { CAMPAIGN_PRESETS, type PresetKey } from '@/lib/simulator/presets';

const BAD_CPO_MULTIPLIER = 3;

function preset(key: PresetKey) {
	const found = CAMPAIGN_PRESETS.find((p) => p.key === key);
	if (!found) throw new Error(`Нет пресета ${key}`);
	return found;
}

/** Ожидаемый CPO: клик стоит bid, заказ — 1 из 1/cr кликов. */
function expectedCpo(key: PresetKey): number {
	const { bid, truth } = preset(key);
	return bid / truth.cr;
}

describe('CAMPAIGN_PRESETS', () => {
	it('4 пресета с уникальными ключами', () => {
		const keys = CAMPAIGN_PRESETS.map((p) => p.key);
		expect(keys).toHaveLength(4);
		expect(new Set(keys).size).toBe(4);
	});

	it('у хорошей ожидаемый CPO ниже цели', () => {
		expect(expectedCpo('good')).toBeLessThan(preset('good').targetCpo);
	});

	it('у плохой ожидаемый CPO выше цели в 3+ раза', () => {
		expect(expectedCpo('bad')).toBeGreaterThanOrEqual(preset('bad').targetCpo * BAD_CPO_MULTIPLIER);
	});

	it('у новой меньше клика за тик', () => {
		const { truth } = preset('new');
		expect(truth.baseImpressions * truth.ctr).toBeLessThan(1);
	});

	it('у капризной задан порог и конверсия после него ниже', () => {
		const { truth } = preset('moody');
		expect(truth.degradeFromTick).not.toBeNull();
		expect(truth.degradedCr).not.toBeNull();
		expect(truth.degradedCr ?? truth.cr).toBeLessThan(truth.cr);
	});
});
