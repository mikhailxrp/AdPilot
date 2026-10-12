// Чтение журнала для страницы /journal: решения активного прогона. Записи не меняются.

import { db } from '@/lib/db';
import { RunStatus } from '@/generated/prisma/client';
import type { AgentEngineName, DecisionAction, DecisionMetrics, DecisionVerdict } from '@/lib/agent/types';
import { JOURNAL_PAGE_SIZE, parseDecisionMetrics, type JournalFilters } from '@/lib/validations/journal';

export interface JournalRow {
	id: string;
	tick: number;
	campaignName: string;
	engine: AgentEngineName;
	action: DecisionAction;
	before: number | null;
	after: number | null;
	reason: string;
	verdict: DecisionVerdict;
	rejectReason: string | null;
	dryRun: boolean;
	applyError: string | null;
	metrics: DecisionMetrics | null;
}

export interface JournalPage {
	rows: JournalRow[];
	total: number;
	/** Страница, которую реально отдали: номер за пределами диапазона прижимается к последней. */
	page: number;
	pageCount: number;
}

export interface JournalCampaign {
	id: string;
	name: string;
}

async function getActiveRunId(): Promise<string | null> {
	const run = await db.simulationRun.findFirst({
		where: { status: RunStatus.ACTIVE },
		orderBy: { createdAt: 'desc' },
		select: { id: true },
	});
	return run?.id ?? null;
}

/** Страница журнала активного прогона, новые сверху. Нет прогона → `null`. */
export async function getJournalPage(filters: JournalFilters): Promise<JournalPage | null> {
	const runId = await getActiveRunId();
	if (!runId) return null;

	const where = {
		runId,
		...(filters.campaign && { campaignId: filters.campaign }),
		...(filters.action && { action: filters.action }),
		...(filters.engine && { engine: filters.engine }),
	};

	const total = await db.decision.count({ where });
	const pageCount = Math.max(1, Math.ceil(total / JOURNAL_PAGE_SIZE));
	const page = Math.min(filters.page, pageCount);

	const decisions = await db.decision.findMany({
		where,
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		skip: (page - 1) * JOURNAL_PAGE_SIZE,
		take: JOURNAL_PAGE_SIZE,
		select: {
			id: true,
			tick: true,
			engine: true,
			action: true,
			before: true,
			after: true,
			reason: true,
			verdict: true,
			rejectReason: true,
			dryRun: true,
			applyError: true,
			metrics: true,
			campaign: { select: { name: true } },
		},
	});

	return {
		total,
		page,
		pageCount,
		rows: decisions.map(({ campaign, metrics, ...decision }) => ({
			...decision,
			campaignName: campaign.name,
			metrics: parseDecisionMetrics(metrics),
		})),
	};
}

/** Кампании активного прогона — для фильтра. */
export async function listJournalCampaigns(): Promise<JournalCampaign[]> {
	const runId = await getActiveRunId();
	if (!runId) return [];

	return db.campaign.findMany({
		where: { runId },
		orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
		select: { id: true, name: true },
	});
}
