import { describe, expect, it } from 'vitest';
import {
	buildJournalHref,
	parseDecisionMetrics,
	parseJournalFilters,
} from '@/lib/validations/journal';

describe('parseJournalFilters', () => {
	it('пустые параметры дают дефолты', () => {
		expect(parseJournalFilters({})).toEqual({ page: 1 });
	});

	it('принимает валидные значения и приводит page из строки', () => {
		expect(parseJournalFilters({ campaign: 'c1', action: 'PAUSE', engine: 'RULES', page: '3' })).toEqual({
			campaign: 'c1',
			action: 'PAUSE',
			engine: 'RULES',
			page: 3,
		});
	});

	it('чужое действие и движок откатываются к «без фильтра»', () => {
		expect(parseJournalFilters({ action: 'EXPLODE', engine: 'GPT' })).toEqual({ page: 1 });
	});

	it.each(['0', '-1', 'abc', '', '1.5'])('page=%j откатывается к первой странице', (page) => {
		expect(parseJournalFilters({ page }).page).toBe(1);
	});

	it('повторяющийся параметр (массив) не ломает разбор', () => {
		expect(parseJournalFilters({ action: ['PAUSE', 'HOLD'] })).toEqual({ page: 1 });
	});
});

describe('buildJournalHref', () => {
	it('без фильтров и на первой странице — чистый путь', () => {
		expect(buildJournalHref({}, 1)).toBe('/journal');
	});

	it('сохраняет фильтры и номер страницы', () => {
		expect(buildJournalHref({ campaign: 'c1', action: 'PAUSE', engine: 'RULES' }, 2)).toBe(
			'/journal?campaign=c1&action=PAUSE&engine=RULES&page=2',
		);
	});
});

describe('parseDecisionMetrics', () => {
	const valid = {
		windowTicks: 6,
		window: { impressions: 1000, clicks: 40, orders: 2, cost: 12000 },
		metrics: { cpc: 300, cpm: 12000, ctr: 0.04, cr: 0.05, cpo: null },
		daySpend: 50000,
	};

	it('валидный JSON проходит', () => {
		expect(parseDecisionMetrics(valid)).toEqual(valid);
	});

	it.each([null, 'мусор', {}, { ...valid, window: null }])('битое значение %j даёт null', (value) => {
		expect(parseDecisionMetrics(value)).toBeNull();
	});
});
