import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RecentDecisions } from '@/components/features/dashboard/RecentDecisions';
import type { RecentDecision } from '@/lib/dashboard/queries';

const ACCEPTED: RecentDecision = {
	id: 'd1',
	tick: 3,
	campaignId: 'c1',
	campaignName: 'Плохая',
	engine: 'RULES',
	action: 'LOWER_BID',
	before: 2_000,
	after: 1_800,
	reason: 'CPO выше допустимого',
	verdict: 'ACCEPTED',
	dryRun: false,
};

const REJECTED: RecentDecision = {
	...ACCEPTED,
	id: 'd2',
	campaignId: 'c2',
	campaignName: 'Хорошая',
	engine: 'LLM',
	action: 'RAISE_BID',
	verdict: 'REJECTED',
	dryRun: true,
};

describe('RecentDecisions', () => {
	afterEach(cleanup);

	it('пустой список → «Решений ещё нет», ссылка на журнал остаётся', () => {
		render(<RecentDecisions decisions={[]} />);

		expect(screen.getByText('Решений ещё нет.')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Весь журнал' }).getAttribute('href')).toBe('/journal');
	});

	it('решение: тик, ссылка на кампанию, причина', () => {
		render(<RecentDecisions decisions={[ACCEPTED]} />);
		const item = screen.getByRole('listitem');

		expect(screen.getByRole('link', { name: 'Плохая' }).getAttribute('href')).toBe('/campaigns/c1');
		expect(item.textContent).toContain('Тик 3');
		expect(item.textContent).toContain('CPO выше допустимого');
		expect(item.textContent).not.toContain('Отклонено');
	});

	it('отклонённое решение в dry-run — бейджи «Отклонено» и «dry-run»', () => {
		render(<RecentDecisions decisions={[ACCEPTED, REJECTED]} />);
		const item = screen.getByRole('link', { name: 'Хорошая' }).closest('li');
		if (!item) throw new Error('решение не найдено');

		expect(item.textContent).toContain('Отклонено');
		expect(item.textContent).toContain('dry-run');
		expect(screen.getAllByRole('listitem')).toHaveLength(2);
	});
});
