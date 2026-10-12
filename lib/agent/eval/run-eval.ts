// Оценка движка по набору сценариев. Чистая по отношению к БД: движок снаружи, сценарии — аргумент.
// Баллы: действие из `allowed` и предложение проходит те же guardrails, что и в цикле агента.

import { checkProposal } from '@/lib/agent/guardrails';
import type { EvalScenario } from '@/lib/agent/eval/scenarios';
import type { AgentEngine, DecisionAction, RulesConfig } from '@/lib/agent/types';

const PERCENT = 100;

export interface EvalRow {
	scenarioId: string;
	title: string;
	/** `null` — движок отказал (нет предложения). */
	action: DecisionAction | null;
	after: number | null;
	reason: string | null;
	rawResponse: string | null;
	passed: boolean;
	/** Почему промах; у пройденного сценария `null`. */
	missReason: string | null;
}

export interface EvalReport {
	rows: EvalRow[];
	passed: number;
	total: number;
	/** Доля пройденных, %, округлённая до целого; для пустого набора 0. */
	scorePct: number;
}

async function evaluateScenario(engine: AgentEngine, scenario: EvalScenario, config: RulesConfig): Promise<EvalRow> {
	const { id, title, snapshot, allowed } = scenario;
	const decision = await engine.decide(snapshot, config);

	if (!decision.ok) {
		return {
			scenarioId: id,
			title,
			action: null,
			after: null,
			reason: null,
			rawResponse: decision.rawResponse,
			passed: false,
			missReason: `Движок отказал: ${decision.rejectReason}`,
		};
	}

	const { proposal, rawResponse } = decision;
	const row = {
		scenarioId: id,
		title,
		action: proposal.action,
		after: proposal.after,
		reason: proposal.reason,
		rawResponse,
	};

	if (!allowed.includes(proposal.action)) {
		return { ...row, passed: false, missReason: `Действие ${proposal.action} не из допустимых: ${allowed.join(', ')}` };
	}

	const guard = checkProposal(proposal, {
		campaign: snapshot.campaign,
		windowClicks: snapshot.window.clicks,
		currentTick: snapshot.currentTick,
		lastChangeTick: null,
		config,
	});
	if (guard.verdict === 'REJECTED') {
		return { ...row, passed: false, missReason: `guardrails: ${guard.rejectReason}` };
	}
	return { ...row, passed: true, missReason: null };
}

/** Сценарии идут последовательно: один `decide` на сценарий. */
export async function runEval(
	engine: AgentEngine,
	scenarios: readonly EvalScenario[],
	config: RulesConfig,
): Promise<EvalReport> {
	const rows: EvalRow[] = [];
	for (const scenario of scenarios) {
		rows.push(await evaluateScenario(engine, scenario, config));
	}
	const passed = rows.filter((row) => row.passed).length;
	const total = rows.length;
	return { rows, passed, total, scorePct: total === 0 ? 0 : Math.round((passed * PERCENT) / total) };
}
