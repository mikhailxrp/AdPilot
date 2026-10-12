// @vitest-environment node
// Сквозной сценарий PRD: seed 42, движок rules, пороги по умолчанию — «плохая» урезана, «хорошая» усилена.
// Мир считается так же, как runTick() в lib/simulator/service.ts, поэтому цифры совпадают с прогоном в БД
// (и с e2e tests/e2e/journal.spec.ts, который делает 25 тиков).

import { describe, expect, it } from 'vitest';
import { MemoryProvider } from '@/lib/ads/memory-provider';
import { runAgentCycle, type CycleConfig } from '@/lib/agent/cycle';
import { rulesEngine } from '@/lib/agent/engines/rules';
import { MemoryJournal, type MemoryDecision } from '@/lib/agent/memory-journal';
import { CHANGE_ACTIONS, type DecisionAction } from '@/lib/agent/types';
import { simulateTick } from '@/lib/simulator/model';
import { CAMPAIGN_PRESETS, type PresetKey } from '@/lib/simulator/presets';
import { spentToday } from '@/lib/simulator/stats';
import { agentConfigSchema } from '@/lib/validations/agent-config';

const RUN_ID = 'scenario';
const RUN_SEED = 42;
const TOTAL_TICKS = 30;
/** Столько тиков делает e2e фазы — результат должен быть виден уже к нему. */
const E2E_TICKS = 25;

interface ScenarioResult {
	provider: MemoryProvider;
	journal: MemoryJournal;
}

/** Тик мира + цикл агента, `ticks` раз. Id кампании = ключ пресета. */
async function runScenario(config: CycleConfig, ticks: number): Promise<ScenarioResult> {
	const provider = new MemoryProvider({
		campaigns: CAMPAIGN_PRESETS.map(({ key, name, bid, dailyBudget, targetCpo }) => ({
			id: key,
			name,
			state: 'ON',
			bid,
			dailyBudget,
			targetCpo,
		})),
	});
	const journal = new MemoryJournal();

	for (let tick = 1; tick <= ticks; tick += 1) {
		const [campaigns, report] = await Promise.all([provider.listCampaigns(), provider.getReport()]);
		const rows = CAMPAIGN_PRESETS.map((preset) => {
			const campaign = campaigns.find(({ id }) => id === preset.key);
			if (!campaign) throw new Error(`Нет кампании ${preset.key}`);
			const history = report.rows.filter((row) => row.campaignId === preset.key);
			const result = simulateTick({
				runSeed: RUN_SEED,
				tick,
				campaignKey: preset.key,
				state: campaign.state,
				bid: campaign.bid,
				dailyBudget: campaign.dailyBudget,
				spentToday: spentToday(history, tick),
				truth: preset.truth,
			});
			return { campaignId: preset.key, tick, ...result };
		});
		provider.addRows(rows);

		const cycle = await runAgentCycle({
			provider,
			journal,
			engine: rulesEngine,
			shadowEngine: null,
			config,
			runId: RUN_ID,
		});
		expect(cycle.failures).toEqual([]);
	}

	return { provider, journal };
}

function isChange(action: DecisionAction): boolean {
	return (CHANGE_ACTIONS as readonly DecisionAction[]).includes(action);
}

function acceptedChanges(journal: MemoryJournal, key: PresetKey, upToTick: number): MemoryDecision[] {
	return journal.entries.filter(
		(entry) =>
			entry.campaignId === key && entry.tick <= upToTick && entry.verdict === 'ACCEPTED' && isChange(entry.action),
	);
}

function presetBid(key: PresetKey): number {
	const preset = CAMPAIGN_PRESETS.find((candidate) => candidate.key === key);
	if (!preset) throw new Error(`Нет пресета ${key}`);
	return preset.bid;
}

describe('сквозной сценарий: seed 42, движок rules, пороги по умолчанию', () => {
	const config: CycleConfig = agentConfigSchema.parse({});

	it(`за ${E2E_TICKS} тиков «плохая» урезана: ставка ниже стартовой или пауза`, async () => {
		const { provider, journal } = await runScenario(config, E2E_TICKS);

		const actions = acceptedChanges(journal, 'bad', E2E_TICKS).map((entry) => entry.action);
		expect(actions.some((action) => action === 'LOWER_BID' || action === 'PAUSE')).toBe(true);

		const bad = (await provider.listCampaigns()).find(({ id }) => id === 'bad');
		expect(bad && (bad.bid < presetBid('bad') || bad.state === 'SUSPENDED')).toBe(true);
	});

	it(`за ${E2E_TICKS} тиков «хорошая» усилена: принято RAISE_BUDGET или RAISE_BID`, async () => {
		const { journal } = await runScenario(config, E2E_TICKS);

		const actions = acceptedChanges(journal, 'good', E2E_TICKS).map((entry) => entry.action);
		expect(actions.some((action) => action === 'RAISE_BUDGET' || action === 'RAISE_BID')).toBe(true);
		expect(actions).not.toContain('LOWER_BID');
		expect(actions).not.toContain('PAUSE');
	});

	it(`за ${TOTAL_TICKS} тиков «новую» не трогают — мало данных`, async () => {
		const { journal } = await runScenario(config, TOTAL_TICKS);

		expect(acceptedChanges(journal, 'new', TOTAL_TICKS)).toEqual([]);
		const newActions = journal.entries.filter((entry) => entry.campaignId === 'new').map((entry) => entry.action);
		expect(newActions).toContain('WAIT_DATA');
	});

	it('журнал пишется по каждой кампании на каждом тике', async () => {
		const { journal } = await runScenario(config, TOTAL_TICKS);

		expect(journal.entries).toHaveLength(TOTAL_TICKS * CAMPAIGN_PRESETS.length);
		expect(journal.entries.every((entry) => entry.reason.length > 0)).toBe(true);
	});

	it('тот же seed даёт тот же журнал', async () => {
		const first = await runScenario(config, TOTAL_TICKS);
		const second = await runScenario(config, TOTAL_TICKS);

		expect(second.journal.entries).toEqual(first.journal.entries);
	});
});
