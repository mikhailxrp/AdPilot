// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { MemoryProvider } from '@/lib/ads/memory-provider';
import { AdsProviderError, type AdsCampaign, type AdsReportRow } from '@/lib/ads/types';
import { runAgentCycle, type CycleConfig } from '@/lib/agent/cycle';
import { rulesEngine } from '@/lib/agent/engines/rules';
import { MemoryJournal } from '@/lib/agent/memory-journal';
import type { JournalEntry } from '@/lib/agent/types';

const RUN_ID = 'run1';
const TICK = 10;
const TARGET_CPO = 100_000;

const CONFIG: CycleConfig = {
	dryRun: false,
	minClicks: 30,
	maxStepPct: 20,
	maxDailyBudget: 1_000_000,
	cooldownTicks: 3,
	cpoTolerancePct: 20,
	windowTicks: 6,
};

function campaign(id: string, overrides: Partial<AdsCampaign> = {}): AdsCampaign {
	return { id, name: id, state: 'ON', bid: 2_000, dailyBudget: 300_000, targetCpo: TARGET_CPO, ...overrides };
}

/** Строки тиков 1..TICK с одинаковой статистикой за тик. */
function rowsFor(campaignId: string, perTick: { clicks: number; orders: number; cost: number }): AdsReportRow[] {
	return Array.from({ length: TICK }, (_, index) => ({
		campaignId,
		tick: index + 1,
		impressions: 1_000,
		bid: 2_000,
		...perTick,
	}));
}

// bad: за окно 1 заказ при расходе ~200 000 → CPO выше допустимых 120 000 → LOWER_BID 2 000 → 1 600
function badRows(): AdsReportRow[] {
	return rowsFor('bad', { clicks: 10, orders: 0, cost: 33_334 }).map((row) => ({
		...row,
		orders: row.tick === TICK ? 1 : 0,
	}));
}

// good: CPO 60 000 ≤ цели, за сутки потрачено 100% бюджета → RAISE_BUDGET 300 000 → 360 000
const GOOD_ROWS = rowsFor('good', { clicks: 10, orders: 1, cost: 30_000 });
// idle: кликов мало → WAIT_DATA
const IDLE_ROWS = rowsFor('idle', { clicks: 1, orders: 0, cost: 100 });
// leak: заказов нет, расход выше допустимого CPO → PAUSE
const LEAK_ROWS = rowsFor('leak', { clicks: 10, orders: 0, cost: 30_000 });

function setup(config: Partial<CycleConfig> = {}) {
	const provider = new MemoryProvider({
		campaigns: [campaign('bad'), campaign('good'), campaign('idle'), campaign('leak')],
		rows: [...badRows(), ...GOOD_ROWS, ...IDLE_ROWS, ...LEAK_ROWS],
		currentTick: TICK,
	});
	const journal = new MemoryJournal();
	const run = () =>
		runAgentCycle({ provider, journal, engine: rulesEngine, config: { ...CONFIG, ...config }, runId: RUN_ID });
	return { provider, journal, run };
}

async function campaignOf(provider: MemoryProvider, id: string): Promise<AdsCampaign> {
	const found = (await provider.listCampaigns()).find((candidate) => candidate.id === id);
	if (!found) throw new Error(`Нет кампании ${id}`);
	return found;
}

function priorChange(campaignId: string, tick: number): JournalEntry {
	return {
		runId: RUN_ID,
		campaignId,
		tick,
		engine: 'RULES',
		action: 'LOWER_BID',
		before: 2_500,
		after: 2_000,
		reason: 'раньше',
		metrics: {
			windowTicks: 6,
			window: { impressions: 0, clicks: 0, orders: 0, cost: 0 },
			metrics: { cpc: null, cpm: null, ctr: null, cr: null, cpo: null },
			daySpend: 0,
		},
		dryRun: false,
		verdict: 'ACCEPTED',
		rejectReason: null,
		rawResponse: null,
	};
}

describe('runAgentCycle', () => {
	it('пишет по одной записи на кампанию, включая WAIT_DATA, с тиком, движком и метриками', async () => {
		const { journal, run } = setup();
		const result = await run();

		expect(result.tick).toBe(TICK);
		expect(result.failures).toEqual([]);
		expect(journal.entries.map((entry) => [entry.campaignId, entry.action])).toEqual([
			['bad', 'LOWER_BID'],
			['good', 'RAISE_BUDGET'],
			['idle', 'WAIT_DATA'],
			['leak', 'PAUSE'],
		]);
		const first = journal.entries[0];
		expect(first).toMatchObject({ runId: RUN_ID, tick: TICK, engine: 'RULES', dryRun: false, verdict: 'ACCEPTED' });
		expect(first?.reason).not.toBe('');
		expect(first?.metrics.window.clicks).toBe(60);
		expect(first?.metrics.windowTicks).toBe(6);
	});

	it('применяет принятые решения: ставка, бюджет, пауза', async () => {
		const { provider, run } = setup();
		const result = await run();

		expect((await campaignOf(provider, 'bad')).bid).toBe(1_600);
		expect((await campaignOf(provider, 'good')).dailyBudget).toBe(360_000);
		expect((await campaignOf(provider, 'leak')).state).toBe('SUSPENDED');
		expect(result.decisions.filter((decision) => decision.applied).map((decision) => decision.campaignId)).toEqual([
			'bad',
			'good',
			'leak',
		]);
	});

	it('записывает before и after в журнал', async () => {
		const { journal, run } = setup();
		await run();
		expect(journal.entries[0]).toMatchObject({ before: 2_000, after: 1_600 });
		expect(journal.entries[2]).toMatchObject({ before: null, after: null });
	});

	it('dry-run: запись с dryRun = true, кампании не меняются', async () => {
		const { provider, journal, run } = setup({ dryRun: true });
		const result = await run();

		expect(journal.entries).toHaveLength(4);
		expect(journal.entries.every((entry) => entry.dryRun)).toBe(true);
		expect(result.decisions.some((decision) => decision.applied)).toBe(false);
		expect(await campaignOf(provider, 'bad')).toMatchObject({ bid: 2_000, state: 'ON' });
		expect(await campaignOf(provider, 'good')).toMatchObject({ dailyBudget: 300_000 });
		expect(await campaignOf(provider, 'leak')).toMatchObject({ state: 'ON' });
	});

	it('REJECTED: пауза между изменениями — запись с rejectReason, кампания не меняется', async () => {
		const { provider, journal, run } = setup();
		await journal.record(priorChange('bad', TICK - 1));
		await run();

		const entry = journal.entries.find((candidate) => candidate.campaignId === 'bad' && candidate.tick === TICK);
		expect(entry).toMatchObject({ action: 'LOWER_BID', verdict: 'REJECTED' });
		expect(entry?.rejectReason).toContain('пауза между изменениями');
		expect((await campaignOf(provider, 'bad')).bid).toBe(2_000);
	});

	it('запись в журнал упала: кампания не меняется, остальные обработаны', async () => {
		const { provider, journal, run } = setup();
		const record = journal.record.bind(journal);
		vi.spyOn(journal, 'record').mockImplementation(async (entry) => {
			if (entry.campaignId === 'bad') throw new Error('БД недоступна');
			return record(entry);
		});
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		const result = await run();

		expect(result.failures).toEqual([{ campaignId: 'bad', error: 'БД недоступна' }]);
		expect((await campaignOf(provider, 'bad')).bid).toBe(2_000);
		expect((await campaignOf(provider, 'good')).dailyBudget).toBe(360_000);
		expect(journal.entries.map((entry) => entry.campaignId)).toEqual(['good', 'idle', 'leak']);
	});

	it('применение упало: applyError в записи, остальные обработаны', async () => {
		const { provider, journal, run } = setup();
		provider.failures.setBid = new AdsProviderError('conflict', 'Кампания занята');
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		const result = await run();

		expect(journal.entries[0]).toMatchObject({ campaignId: 'bad', verdict: 'ACCEPTED', applyError: 'Кампания занята' });
		expect(result.decisions[0]).toMatchObject({ applied: false, applyError: 'Кампания занята' });
		expect(result.failures).toEqual([]);
		expect((await campaignOf(provider, 'good')).dailyBudget).toBe(360_000);
		expect((await campaignOf(provider, 'leak')).state).toBe('SUSPENDED');
	});

	it('неудачное применение не запускает паузу между изменениями', async () => {
		const { provider, journal, run } = setup();
		provider.failures.setBid = new AdsProviderError('conflict', 'Кампания занята');
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		await run();

		expect((await journal.lastChangeTicks(RUN_ID, ['bad', 'good'])).get('bad')).toBeUndefined();
		expect((await journal.lastChangeTicks(RUN_ID, ['bad', 'good'])).get('good')).toBe(TICK);
	});

	it('getReport упал: цикл бросает ошибку, записей нет', async () => {
		const { provider, journal, run } = setup();
		provider.failures.getReport = new AdsProviderError('unavailable', 'Мок недоступен');

		await expect(run()).rejects.toMatchObject({ code: 'unavailable' });
		expect(journal.entries).toEqual([]);
	});
});
