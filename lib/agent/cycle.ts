// Цикл агента: статистика → метрики → решение → guardrails → журнал → применение.
// Журнал, провайдер и движок приходят зависимостями — цикл не знает ни Prisma, ни сети.
// Решение пишется в журнал до применения: не записалось — кампания не меняется.

import type { AdsCampaign, AdsProvider } from '@/lib/ads/types';
import { checkProposal } from '@/lib/agent/guardrails';
import { buildSnapshot } from '@/lib/agent/window';
import {
	CHANGE_ACTIONS,
	type AgentEngine,
	type DecisionAction,
	type DecisionMetrics,
	type DecisionVerdict,
	type Journal,
	type JournalEntry,
	type RulesConfig,
} from '@/lib/agent/types';
import type { AgentConfigInput } from '@/lib/validations/agent-config';

export type CycleConfig = RulesConfig & Pick<AgentConfigInput, 'dryRun'>;

export interface CycleParams {
	provider: AdsProvider;
	journal: Journal;
	engine: AgentEngine;
	config: CycleConfig;
	runId: string;
}

export interface CycleDecision {
	campaignId: string;
	action: DecisionAction;
	verdict: DecisionVerdict;
	/** Кампания реально изменена в кабинете. */
	applied: boolean;
	applyError: string | null;
}

export interface CycleFailure {
	campaignId: string;
	error: string;
}

export interface CycleResult {
	tick: number;
	decisions: CycleDecision[];
	failures: CycleFailure[];
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isChange(action: DecisionAction): boolean {
	return (CHANGE_ACTIONS as readonly DecisionAction[]).includes(action);
}

async function applyChange(
	provider: AdsProvider,
	campaign: AdsCampaign,
	action: DecisionAction,
	after: number | null,
): Promise<void> {
	switch (action) {
		case 'LOWER_BID':
		case 'RAISE_BID':
			if (after === null) throw new Error('Нет новой ставки');
			return provider.setBid(campaign.id, after);
		case 'RAISE_BUDGET':
			if (after === null) throw new Error('Нет нового бюджета');
			return provider.setDailyBudget(campaign.id, after);
		case 'PAUSE':
			return provider.suspend(campaign.id);
		case 'HOLD':
		case 'WAIT_DATA':
			return;
	}
}

export async function runAgentCycle({ provider, journal, engine, config, runId }: CycleParams): Promise<CycleResult> {
	const [campaigns, report] = await Promise.all([provider.listCampaigns(), provider.getReport()]);
	const { currentTick } = report;
	const lastChangeTicks = await journal.lastChangeTicks(
		runId,
		campaigns.map((campaign) => campaign.id),
	);

	const result: CycleResult = { tick: currentTick, decisions: [], failures: [] };

	for (const campaign of campaigns) {
		try {
			const rows = report.rows.filter((row) => row.campaignId === campaign.id);
			const snapshot = buildSnapshot(campaign, rows, currentTick, config.windowTicks);
			const proposal = await engine.decide(snapshot, config);
			const check = checkProposal(proposal, {
				campaign,
				windowClicks: snapshot.window.clicks,
				currentTick,
				lastChangeTick: lastChangeTicks.get(campaign.id) ?? null,
				config,
			});
			const metrics: DecisionMetrics = {
				windowTicks: config.windowTicks,
				window: snapshot.window,
				metrics: snapshot.metrics,
				daySpend: snapshot.daySpend,
			};
			const entry: JournalEntry = {
				runId,
				campaignId: campaign.id,
				tick: currentTick,
				engine: engine.name,
				action: proposal.action,
				before: check.before,
				after: check.after,
				reason: proposal.reason,
				metrics,
				dryRun: config.dryRun,
				verdict: check.verdict,
				rejectReason: check.verdict === 'REJECTED' ? check.rejectReason : null,
				rawResponse: null,
			};

			const { id } = await journal.record(entry);

			const decision: CycleDecision = {
				campaignId: campaign.id,
				action: proposal.action,
				verdict: check.verdict,
				applied: false,
				applyError: null,
			};
			result.decisions.push(decision);

			if (check.verdict !== 'ACCEPTED' || config.dryRun || !isChange(proposal.action)) continue;

			try {
				await applyChange(provider, campaign, proposal.action, check.after);
				decision.applied = true;
			} catch (error) {
				console.error(`Не удалось применить ${proposal.action} к кампании ${campaign.id}:`, error);
				decision.applyError = errorMessage(error);
				await journal.setApplyError(id, decision.applyError);
			}
		} catch (error) {
			console.error(`Сбой цикла агента на кампании ${campaign.id}:`, error);
			result.failures.push({ campaignId: campaign.id, error: errorMessage(error) });
		}
	}

	return result;
}
