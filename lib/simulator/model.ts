// Модель одного тика одной кампании (1 тик = 1 час). Деньги — целые копейки.
// Порядок обращений к генератору фиксирован: от него зависит воспроизводимость.

import { createRng, deriveTickSeed, type Rng } from '@/lib/simulator/rng';

export const TICKS_PER_DAY = 24;
/** Разброс показов вокруг ожидаемого значения: ±10 %. */
export const IMPRESSION_NOISE = 0.1;

export type CampaignState = 'ON' | 'SUSPENDED';

/** Скрытые параметры кампании — поля `CampaignTruth` без id. */
export interface TruthParams {
	ctr: number;
	cr: number;
	bidSensitivity: number;
	baseImpressions: number;
	referenceBid: number;
	degradeFromTick: number | null;
	degradedCr: number | null;
}

export interface TickInput {
	runSeed: number;
	/** Номер тика, с 1. */
	tick: number;
	/** Стабильный ключ кампании (ключ пресета), не id из БД. */
	campaignKey: string;
	state: CampaignState;
	bid: number;
	dailyBudget: number;
	/** Расход с начала текущих суток (с `dayStartTick(tick)`), без этого тика. */
	spentToday: number;
	truth: TruthParams;
}

export interface TickResult {
	impressions: number;
	clicks: number;
	orders: number;
	cost: number;
	bid: number;
}

export function expectedImpressions(bid: number, truth: TruthParams): number {
	if (bid <= 0) return 0;
	return truth.baseImpressions * (bid / truth.referenceBid) ** truth.bidSensitivity;
}

export function effectiveCr(truth: TruthParams, tick: number): number {
	const { degradeFromTick, degradedCr } = truth;
	if (degradeFromTick !== null && degradedCr !== null && tick >= degradeFromTick) return degradedCr;
	return truth.cr;
}

/** Первый тик суток, в которые попадает `tick`: 1..24 → 1, 25..48 → 25. */
export function dayStartTick(tick: number): number {
	return Math.floor((tick - 1) / TICKS_PER_DAY) * TICKS_PER_DAY + 1;
}

function sampleBinomial(rng: Rng, trials: number, probability: number): number {
	let successes = 0;
	for (let i = 0; i < trials; i++) {
		if (rng() < probability) successes++;
	}
	return successes;
}

export function simulateTick(input: TickInput): TickResult {
	const { runSeed, tick, campaignKey, state, bid, dailyBudget, spentToday, truth } = input;
	const remaining = dailyBudget - spentToday;
	const empty: TickResult = { impressions: 0, clicks: 0, orders: 0, cost: 0, bid };

	// Пауза, нулевая ставка или не хватает даже на один клик
	if (state === 'SUSPENDED' || bid <= 0 || remaining < bid) return empty;

	const rng = createRng(deriveTickSeed(runSeed, tick, campaignKey));

	// Шум — первое число генератора: при том же seed ставка выше → показов не меньше
	const noise = 1 + (rng() * 2 - 1) * IMPRESSION_NOISE;
	let impressions = Math.round(expectedImpressions(bid, truth) * noise);
	let clicks = sampleBinomial(rng, impressions, truth.ctr);

	// Клик стоит ставку; больше остатка суток не тратим
	const affordableClicks = Math.floor(remaining / bid);
	if (clicks > affordableClicks) {
		impressions = Math.round((impressions * affordableClicks) / clicks);
		clicks = affordableClicks;
	}

	const orders = sampleBinomial(rng, clicks, effectiveCr(truth, tick));

	return { impressions, clicks, orders, cost: clicks * bid, bid };
}
