import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { CampaignCharts } from '@/components/features/campaigns/CampaignCharts';
import type { ChartReference } from '@/components/features/campaigns/TickChart';
import type { SeriesPoint } from '@/lib/campaigns/series';

// Recharts в jsdom не измеряет контейнер и ничего не рисует — заменяем график заглушкой
// с заголовком, ориентирами и подписью; сам график проверяет e2e.
vi.mock('@/components/features/campaigns/TickChart', () => ({
	TickChart: ({ title, references = [], note }: { title: string; references?: ChartReference[]; note?: string }) => (
		<figure aria-label={title}>
			<ul>
				{references.map((reference) => (
					<li key={reference.label}>{`${reference.label}=${reference.value}`}</li>
				))}
			</ul>
			{note && <p>{note}</p>}
		</figure>
	),
}));

const TARGET_CPO = 100_000;
const TOLERANCE_PCT = 20;
const WINDOW_TICKS = 16;

function renderCharts(points: SeriesPoint[]) {
	return render(
		<CampaignCharts
			points={points}
			targetCpo={TARGET_CPO}
			cpoTolerancePct={TOLERANCE_PCT}
			windowTicks={WINDOW_TICKS}
		/>,
	);
}

describe('CampaignCharts', () => {
	afterEach(cleanup);

	it('0 точек → «Тиков ещё не было», графиков нет', () => {
		renderCharts([]);

		expect(screen.getByText(/Тиков ещё не было/)).toBeTruthy();
		expect(screen.queryAllByRole('figure')).toHaveLength(0);
	});

	it('есть точки → три графика: ставка, расход, CPO по окну', () => {
		renderCharts([{ tick: 1, bid: 2_000, cost: 1_000, windowCpo: 50_000 }]);

		const titles = screen.getAllByRole('figure').map((figure) => figure.getAttribute('aria-label'));
		expect(titles).toEqual(['Ставка', 'Расход', `CPO за ${WINDOW_TICKS} тиков`]);
	});

	it('у графика CPO линии цели и допуска (цель + допуск)', () => {
		renderCharts([{ tick: 1, bid: 2_000, cost: 1_000, windowCpo: 50_000 }]);

		const cpoChart = screen.getByRole('figure', { name: `CPO за ${WINDOW_TICKS} тиков` });
		expect(within(cpoChart).getByText('Цель CPO=100000')).toBeTruthy();
		expect(within(cpoChart).getByText(`Допустимый CPO (+${TOLERANCE_PCT}%)=120000`)).toBeTruthy();
		expect(within(cpoChart).queryByText(/CPO появится/)).toBeNull();
		expect(within(screen.getByRole('figure', { name: 'Ставка' })).queryAllByRole('listitem')).toHaveLength(0);
	});

	it('в окне ещё не было заказов → подпись «CPO появится после первого заказа»', () => {
		renderCharts([
			{ tick: 1, bid: 2_000, cost: 1_000, windowCpo: null },
			{ tick: 2, bid: 2_000, cost: 1_000, windowCpo: null },
		]);

		const cpoChart = screen.getByRole('figure', { name: `CPO за ${WINDOW_TICKS} тиков` });
		expect(within(cpoChart).getByText(/CPO появится после первого заказа/)).toBeTruthy();
	});
});
