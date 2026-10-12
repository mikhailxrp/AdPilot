import { z } from 'zod';
import { DECISION_ACTIONS, type DecisionMetrics } from '@/lib/agent/types';
import { AGENT_ENGINES } from '@/lib/validations/agent-config';

export const JOURNAL_PAGE_SIZE = 50;
const FIRST_PAGE = 1;

/** Невалидное значение параметра URL не ломает страницу — откатываемся к «без фильтра» / первой странице. */
export const journalFiltersSchema = z.object({
	campaign: z.string().min(1).optional().catch(undefined),
	action: z.enum(DECISION_ACTIONS).optional().catch(undefined),
	engine: z.enum(AGENT_ENGINES).optional().catch(undefined),
	page: z.coerce.number().int().min(FIRST_PAGE).catch(FIRST_PAGE),
});

export type JournalFilters = z.infer<typeof journalFiltersSchema>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseJournalFilters(raw: RawSearchParams): JournalFilters {
	return journalFiltersSchema.parse(raw);
}

/** Ссылка на журнал с фильтрами; дефолтные значения в URL не попадают. */
export function buildJournalHref(filters: Omit<JournalFilters, 'page'>, page: number): string {
	const params = new URLSearchParams();
	if (filters.campaign) params.set('campaign', filters.campaign);
	if (filters.action) params.set('action', filters.action);
	if (filters.engine) params.set('engine', filters.engine);
	if (page > FIRST_PAGE) params.set('page', String(page));

	const query = params.toString();
	return query ? `/journal?${query}` : '/journal';
}

const nullableNumber = z.number().nullable();

const decisionMetricsSchema = z.object({
	windowTicks: z.number(),
	window: z.object({
		impressions: z.number(),
		clicks: z.number(),
		orders: z.number(),
		cost: z.number(),
	}),
	metrics: z.object({
		cpc: nullableNumber,
		cpm: nullableNumber,
		ctr: nullableNumber,
		cr: nullableNumber,
		cpo: nullableNumber,
	}),
	daySpend: z.number(),
});

/** `Decision.metrics` — Json: старая или битая запись даёт `null`, а не ошибку страницы. */
export function parseDecisionMetrics(value: unknown): DecisionMetrics | null {
	const result = decisionMetricsSchema.safeParse(value);
	return result.success ? result.data : null;
}
