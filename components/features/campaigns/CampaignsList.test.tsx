import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CampaignsList } from '@/components/features/campaigns/CampaignsList';
import { NO_DATA } from '@/lib/metrics/format';
import type { CampaignRow } from '@/lib/simulator/queries';

// Intl для ru-RU ставит неразрывные пробелы
const NBSP = ' ';

const ACTIVE_CAMPAIGN: CampaignRow = {
	id: 'c1',
	name: 'Плохая',
	state: 'ON',
	bid: 2_000,
	dailyBudget: 300_000,
	targetCpo: 50_000,
	totals: { impressions: 1000, clicks: 50, orders: 2, cost: 10_000 },
	metrics: { cpc: 200, cpm: 10_000, ctr: 0.05, cr: 0.04, cpo: 5000 },
};

const EMPTY_CAMPAIGN: CampaignRow = {
	...ACTIVE_CAMPAIGN,
	id: 'c2',
	name: 'Новая',
	state: 'SUSPENDED',
	totals: { impressions: 0, clicks: 0, orders: 0, cost: 0 },
	metrics: { cpc: null, cpm: null, ctr: null, cr: null, cpo: null },
};

function rowOf(name: string): HTMLElement {
	const row = screen.getByRole('link', { name }).closest('tr');
	if (!row) throw new Error(`строка кампании «${name}» не найдена`);
	return row;
}

describe('CampaignsList', () => {
	afterEach(cleanup);

	it('название ведёт на страницу кампании', () => {
		render(<CampaignsList campaigns={[ACTIVE_CAMPAIGN, EMPTY_CAMPAIGN]} />);

		expect(screen.getByRole('link', { name: 'Плохая' }).getAttribute('href')).toBe('/campaigns/c1');
		expect(screen.getByRole('link', { name: 'Новая' }).getAttribute('href')).toBe('/campaigns/c2');
	});

	it('показывает метрики кампании с данными', () => {
		render(<CampaignsList campaigns={[ACTIVE_CAMPAIGN]} />);
		const row = rowOf('Плохая');

		expect(row.textContent).toContain('Включена');
		expect(row.textContent).toContain(`100,00${NBSP}₽`);
		expect(row.textContent).toContain(`5${NBSP}%`);
		expect(row.textContent).not.toContain(NO_DATA);
	});

	it('кампания без тиков: метрики — «нет данных», расход — 0 ₽', () => {
		render(<CampaignsList campaigns={[EMPTY_CAMPAIGN]} />);
		const cells = Array.from(rowOf('Новая').querySelectorAll('td'), (cell) => cell.textContent);

		// CPC, CTR, CR, CPO — последние четыре колонки
		expect(cells.slice(-4)).toEqual([NO_DATA, NO_DATA, NO_DATA, NO_DATA]);
		expect(cells).toContain(`0,00${NBSP}₽`);
		expect(cells.join(' ')).not.toMatch(/NaN|∞/);
	});

	it('SUSPENDED показывается как «Приостановлена»', () => {
		render(<CampaignsList campaigns={[EMPTY_CAMPAIGN]} />);

		expect(rowOf('Новая').textContent).toContain('Приостановлена');
	});
});
