// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MemoryJournal } from '@/lib/agent/memory-journal';
import type { JournalEntry } from '@/lib/agent/types';

const RUN_ID = 'run1';

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
	return {
		runId: RUN_ID,
		campaignId: 'c1',
		tick: 5,
		engine: 'RULES',
		action: 'LOWER_BID',
		before: 2_000,
		after: 1_600,
		reason: 'причина',
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
		...overrides,
	};
}

async function lastTick(journal: MemoryJournal, campaignId = 'c1'): Promise<number | undefined> {
	return (await journal.lastChangeTicks(RUN_ID, [campaignId])).get(campaignId);
}

describe('MemoryJournal.lastChangeTicks', () => {
	it('возвращает максимальный тик применённого изменения', async () => {
		const journal = new MemoryJournal();
		await journal.record(entry({ tick: 3 }));
		await journal.record(entry({ tick: 7, action: 'PAUSE', before: null, after: null }));
		expect(await lastTick(journal)).toBe(7);
	});

	it('не учитывает dry-run', async () => {
		const journal = new MemoryJournal();
		await journal.record(entry({ dryRun: true }));
		expect(await lastTick(journal)).toBeUndefined();
	});

	it('не учитывает REJECTED', async () => {
		const journal = new MemoryJournal();
		await journal.record(entry({ verdict: 'REJECTED', rejectReason: 'лимит' }));
		expect(await lastTick(journal)).toBeUndefined();
	});

	it('не учитывает записи с applyError', async () => {
		const journal = new MemoryJournal();
		const { id } = await journal.record(entry());
		await journal.setApplyError(id, 'сбой');
		expect(await lastTick(journal)).toBeUndefined();
	});

	it('не учитывает HOLD и WAIT_DATA', async () => {
		const journal = new MemoryJournal();
		await journal.record(entry({ action: 'HOLD', before: null, after: null }));
		await journal.record(entry({ action: 'WAIT_DATA', before: null, after: null }));
		expect(await lastTick(journal)).toBeUndefined();
	});

	it('учитывает только свой прогон и запрошенные кампании', async () => {
		const journal = new MemoryJournal();
		await journal.record(entry({ runId: 'other' }));
		await journal.record(entry({ campaignId: 'c2' }));
		expect(await lastTick(journal)).toBeUndefined();
	});
});

describe('MemoryJournal.record', () => {
	it('бросает recordError, если она задана', async () => {
		const journal = new MemoryJournal();
		journal.recordError = new Error('БД недоступна');
		await expect(journal.record(entry())).rejects.toThrow('БД недоступна');
		expect(journal.entries).toEqual([]);
	});
});
