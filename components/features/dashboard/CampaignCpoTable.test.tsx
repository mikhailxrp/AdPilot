import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CampaignCpoTable } from '@/components/features/dashboard/CampaignCpoTable';
import type { CampaignCpoRow } from '@/lib/dashboard/summary';
import { NO_DATA } from '@/lib/metrics/format';

const BASE: CampaignCpoRow = {
	id: 'c1',
	name: 'Хорошая',
	targetCpo: 100_000,
	allowedCpo: 120_000,
	cpo: 90_000,
	status: 'WITHIN_TARGET',
};

const CAMPAIGNS: CampaignCpoRow[] = [
	BASE,
	{ ...BASE, id: 'c2', name: 'Средняя', cpo: 110_000, status: 'WITHIN_TOLERANCE' },
	{ ...BASE, id: 'c3', name: 'Плохая', cpo: 200_000, status: 'OVER_TOLERANCE' },
	{ ...BASE, id: 'c4', name: 'Новая', cpo: null, status: 'NO_DATA' },
];

function rowOf(name: string): HTMLElement {
	const row = screen.getByRole('link', { name }).closest('tr');
	if (!row) throw new Error(`строка кампании «${name}» не найдена`);
	return row;
}

describe('CampaignCpoTable', () => {
	afterEach(cleanup);

	it('название ведёт на страницу кампании', () => {
		render(<CampaignCpoTable campaigns={CAMPAIGNS} />);

		expect(screen.getByRole('link', { name: 'Хорошая' }).getAttribute('href')).toBe('/campaigns/c1');
		expect(screen.getByRole('link', { name: 'Новая' }).getAttribute('href')).toBe('/campaigns/c4');
	});

	it('подписи статусов относительно цели и допуска', () => {
		render(<CampaignCpoTable campaigns={CAMPAIGNS} />);

		expect(rowOf('Хорошая').textContent).toContain('в цели');
		expect(rowOf('Средняя').textContent).toContain('в допуске');
		expect(rowOf('Плохая').textContent).toContain('выше допуска');
	});

	it('без заказов: CPO и статус — «нет данных»', () => {
		render(<CampaignCpoTable campaigns={CAMPAIGNS} />);
		const cells = Array.from(rowOf('Новая').querySelectorAll('td'), (cell) => cell.textContent);

		expect(cells.slice(-2)).toEqual([NO_DATA, NO_DATA]);
	});
});
