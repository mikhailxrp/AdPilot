// Генератор случайных чисел с seed (mulberry32) и вывод seed тика (FNV-1a).
// Состояние не хранится: каждый тик кампании получает свой генератор от (seed прогона, тик, ключ).

const UINT32_RANGE = 2 ** 32;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export type Rng = () => number;

/** Детерминированный генератор: возвращает числа в [0, 1). */
export function createRng(seed: number): Rng {
	let state = seed >>> 0;
	return () => {
		state = (state + MULBERRY_INCREMENT) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
	};
}

/** 32-битный хеш FNV-1a от частей, склеенных через «:». */
export function hashSeed(...parts: Array<string | number>): number {
	const text = parts.join(':');
	let hash = FNV_OFFSET_BASIS;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, FNV_PRIME) >>> 0;
	}
	return hash >>> 0;
}

export function deriveTickSeed(runSeed: number, tick: number, campaignKey: string): number {
	return hashSeed(runSeed, tick, campaignKey);
}
