import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CampaignSummary } from '@/components/features/campaigns/CampaignSummary';
import type { CampaignDetail } from '@/lib/campaigns/queries';
import { NO_DATA } from '@/lib/metrics/format';

// Intl для ru-RU ставит неразрывные пробелы
const NBSP = ' ';

const CAMPAIGN: Omit<CampaignDetail, 'ticks'> = {
	id: 'c1',
	name: 'Плохая',
	state: 'ON',
	bid: 2_000,
	dailyBudget: 300_000,
	targetCpo: 50_000,
	run: { id: 'r1', seed: 42, currentTick: 3, archived: false },
	totals: { impressions: 1000, clicks: 50, orders: 2, cost: 10_000 },
	metrics: { cpc: 200, cpm: 10_000, ctr: 0.05, cr: 0.04, cpo: 5000 },
};

function valueOf(label: string): string | null {
	const term = screen.getByText(label, { selector: 'dt' });
	return term.nextElementSibling?.textContent ?? null;
}

describe('CampaignSummary', () => {
	afterEach(cleanup);

	it('показывает параметры, итоги и прогон', () => {
		render(<CampaignSummary campaign={CAMPAIGN} />);

		expect(valueOf('Ставка')).toBe(`20,00${NBSP}₽`);
		expect(valueOf('Расход')).toBe(`100,00${NBSP}₽`);
		expect(valueOf('CTR')).toBe(`5${NBSP}%`);
		expect(screen.getByText('Тик 3 · seed 42')).toBeTruthy();
	});

	it('бейдж «архив» только у архивного прогона', () => {
		render(<CampaignSummary campaign={CAMPAIGN} />);
		expect(screen.queryByText('архив')).toBeNull();
		cleanup();

		render(<CampaignSummary campaign={{ ...CAMPAIGN, run: { ...CAMPAIGN.run, archived: true } }} />);
		expect(screen.getByText('архив')).toBeTruthy();
	});

	it('без заказов CPO — «нет данных», а не NaN / ∞', () => {
		render(
			<CampaignSummary
				campaign={{
					...CAMPAIGN,
					totals: { impressions: 0, clicks: 0, orders: 0, cost: 0 },
					metrics: { cpc: null, cpm: null, ctr: null, cr: null, cpo: null },
				}}
			/>,
		);

		expect(valueOf('CPO')).toBe(NO_DATA);
		expect(document.body.textContent).not.toMatch(/NaN|∞/);
	});

	it('SUSPENDED показывается как «Приостановлена»', () => {
		render(<CampaignSummary campaign={{ ...CAMPAIGN, state: 'SUSPENDED' }} />);

		expect(screen.getByText('Приостановлена')).toBeTruthy();
	});
});
