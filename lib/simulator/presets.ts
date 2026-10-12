// Тестовые кампании симулятора (PRD, требование 2). Деньги — копейки.
// Ключ стабилен между прогонами: по нему выводится seed тика.

import type { TruthParams } from '@/lib/simulator/model';

export type PresetKey = 'good' | 'bad' | 'new' | 'moody';

export interface CampaignPreset {
	key: PresetKey;
	name: string;
	bid: number;
	dailyBudget: number;
	targetCpo: number;
	truth: TruthParams;
}

const TARGET_CPO = 100_000; // 1 000 ₽
const MOODY_DEGRADE_FROM_TICK = 15; // середина окна 20–30 тиков сквозного теста Phase 2

export const CAMPAIGN_PRESETS: readonly CampaignPreset[] = [
	{
		// CPO ~250 ₽, упирается в дневной бюджет — есть что усилить
		key: 'good',
		name: 'Хорошая',
		bid: 2_000,
		dailyBudget: 300_000,
		targetCpo: TARGET_CPO,
		truth: {
			ctr: 0.05,
			cr: 0.08,
			bidSensitivity: 0.8,
			baseImpressions: 200,
			referenceBid: 2_000,
			degradeFromTick: null,
			degradedCr: null,
		},
	},
	{
		// CPO ~6 000 ₽, почти без заказов — урезать или поставить на паузу
		key: 'bad',
		name: 'Плохая',
		bid: 3_000,
		dailyBudget: 300_000,
		targetCpo: TARGET_CPO,
		truth: {
			ctr: 0.03,
			cr: 0.005,
			bidSensitivity: 0.8,
			baseImpressions: 200,
			referenceBid: 3_000,
			degradeFromTick: null,
			degradedCr: null,
		},
	},
	{
		// Меньше клика за тик — «мало данных»
		key: 'new',
		name: 'Новая',
		bid: 1_500,
		dailyBudget: 100_000,
		targetCpo: TARGET_CPO,
		truth: {
			ctr: 0.04,
			cr: 0.05,
			bidSensitivity: 0.8,
			baseImpressions: 20,
			referenceBid: 1_500,
			degradeFromTick: null,
			degradedCr: null,
		},
	},
	{
		// Как «хорошая», но с тика 15 CPO ~2 000 ₽
		key: 'moody',
		name: 'Капризная',
		bid: 2_000,
		dailyBudget: 300_000,
		targetCpo: TARGET_CPO,
		truth: {
			ctr: 0.05,
			cr: 0.08,
			bidSensitivity: 0.8,
			baseImpressions: 200,
			referenceBid: 2_000,
			degradeFromTick: MOODY_DEGRADE_FROM_TICK,
			degradedCr: 0.01,
		},
	},
];
