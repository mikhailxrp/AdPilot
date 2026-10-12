// Журнал в памяти для тестов цикла и сквозного сценария. Логика `lastChangeTicks` та же, что у prismaJournal.

import { CHANGE_ACTIONS, type DecisionAction, type Journal, type JournalEntry } from '@/lib/agent/types';

export interface MemoryDecision extends JournalEntry {
	id: string;
	applyError: string | null;
}

export class MemoryJournal implements Journal {
	readonly entries: MemoryDecision[] = [];
	/** Если задана, `record` бросает её — имитация сбоя БД. */
	recordError: Error | null = null;

	async record(entry: JournalEntry): Promise<{ id: string }> {
		if (this.recordError) throw this.recordError;
		const id = `d${this.entries.length + 1}`;
		this.entries.push({ ...entry, id, applyError: null });
		return { id };
	}

	async setApplyError(id: string, message: string): Promise<void> {
		const entry = this.entries.find((candidate) => candidate.id === id);
		if (!entry) throw new Error(`Записи ${id} нет в журнале`);
		entry.applyError = message;
	}

	async lastChangeTicks(runId: string, campaignIds: readonly string[]): Promise<Map<string, number>> {
		const ticks = new Map<string, number>();
		for (const entry of this.entries) {
			const applied =
				entry.runId === runId &&
				campaignIds.includes(entry.campaignId) &&
				entry.verdict === 'ACCEPTED' &&
				!entry.dryRun &&
				entry.applyError === null &&
				(CHANGE_ACTIONS as readonly DecisionAction[]).includes(entry.action);
			if (applied && entry.tick > (ticks.get(entry.campaignId) ?? -1)) ticks.set(entry.campaignId, entry.tick);
		}
		return ticks;
	}
}
