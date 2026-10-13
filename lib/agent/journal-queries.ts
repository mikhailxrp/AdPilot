// Чтение журнала: /journal — решения активного прогона, /campaigns/[id] — решения одной кампании. Записи не меняются.

import { db } from '@/lib/db';
import { RunStatus, type Prisma } from '@/generated/prisma/client';
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
	/** Сырой ответ LLM; у `rules` — `null`. */
	rawResponse: string | null;
	/** Что решил бы `rules` на тех же цифрах; у записей `rules` — `null`. */
	shadowAction: DecisionAction | null;
	shadowAfter: number | null;
	shadowReason: string | null;
	/** Версия системного промпта, по которой решала модель; у `rules` и старых записей — `null`. */
	promptVersion: JournalPromptVersion | null;
}

export interface JournalPromptVersion {
	id: string;
	sha256: string;
	text: string;
	createdAt: Date;
}

export interface JournalPage {
	rows: JournalRow[];
	total: number;
	/** Страница, которую реально отдали: номер за пределами диапазона прижимается к последней. */
	page: number;
	pageCount: number;
}

export interface CampaignJournal {
	rows: JournalRow[];
	/** Всего записей кампании; в `rows` — не больше `JOURNAL_PAGE_SIZE`. */
	total: number;
}

export interface JournalCampaign {
	id: string;
	name: string;
}

// Общие для всех запросов журнала поля и порядок: строки /journal и /campaigns/[id] не должны расходиться
const JOURNAL_ROW_SELECT = {
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
	rawResponse: true,
	shadowAction: true,
	shadowAfter: true,
	shadowReason: true,
	campaign: { select: { name: true } },
	promptVersion: { select: { id: true, sha256: true, text: true, createdAt: true } },
} satisfies Prisma.DecisionSelect;

const JOURNAL_ORDER_BY = [
	{ createdAt: 'desc' },
	{ id: 'desc' },
] satisfies Prisma.DecisionOrderByWithRelationInput[];

function toJournalRow({
	campaign,
	metrics,
	...decision
}: Prisma.DecisionGetPayload<{ select: typeof JOURNAL_ROW_SELECT }>): JournalRow {
	return { ...decision, campaignName: campaign.name, metrics: parseDecisionMetrics(metrics) };
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

	const where: Prisma.DecisionWhereInput = {
		runId,
		...(filters.campaign && { campaignId: filters.campaign }),
		...(filters.action && { action: filters.action }),
		...(filters.engine && { engine: filters.engine }),
		// «Движки разошлись»: сравнение двух колонок; в AND, чтобы не перетереть фильтр по action
		...(filters.diverged && {
			AND: [
				{ shadowAction: { not: null } },
				{ action: { not: { equals: db.decision.fields.shadowAction } } },
			],
		}),
	};

	const total = await db.decision.count({ where });
	const pageCount = Math.max(1, Math.ceil(total / JOURNAL_PAGE_SIZE));
	const page = Math.min(filters.page, pageCount);

	const decisions = await db.decision.findMany({
		where,
		orderBy: JOURNAL_ORDER_BY,
		skip: (page - 1) * JOURNAL_PAGE_SIZE,
		take: JOURNAL_PAGE_SIZE,
		select: JOURNAL_ROW_SELECT,
	});

	return { total, page, pageCount, rows: decisions.map(toJournalRow) };
}

/** Последние записи журнала одной кампании (любого прогона), новые сверху. */
export async function getCampaignJournal(campaignId: string): Promise<CampaignJournal> {
	const where: Prisma.DecisionWhereInput = { campaignId };
	const [total, decisions] = await Promise.all([
		db.decision.count({ where }),
		db.decision.findMany({
			where,
			orderBy: JOURNAL_ORDER_BY,
			take: JOURNAL_PAGE_SIZE,
			select: JOURNAL_ROW_SELECT,
		}),
	]);

	return { total, rows: decisions.map(toJournalRow) };
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
