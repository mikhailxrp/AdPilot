import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TickSeriesTable } from '@/components/features/campaigns/TickSeriesTable';
import { NO_DATA } from '@/lib/metrics/format';

// Intl для ru-RU ставит неразрывные пробелы
const NBSP = ' ';

describe('TickSeriesTable', () => {
	afterEach(cleanup);

	it('0 точек → «Тиков ещё не было»', () => {
		render(<TickSeriesTable points={[]} windowTicks={16} />);

		expect(screen.getByText(/Тиков ещё не было/)).toBeTruthy();
		expect(screen.queryByRole('table')).toBeNull();
	});

	it('строка на тик; null — «нет данных»', () => {
		render(
			<TickSeriesTable
				points={[
					{ tick: 1, bid: 2_000, cost: 1_000, windowCpo: null },
					{ tick: 2, bid: null, cost: null, windowCpo: 5_000 },
				]}
				windowTicks={16}
			/>,
		);

		const rows = screen.getAllByRole('row').slice(1);
		const cells = rows.map((row) => Array.from(row.querySelectorAll('td'), (cell) => cell.textContent));

		expect(screen.getByRole('columnheader', { name: 'CPO за 16 тиков' })).toBeTruthy();
		expect(cells[0]).toEqual(['1', `20,00${NBSP}₽`, `10,00${NBSP}₽`, NO_DATA]);
		expect(cells[1]).toEqual(['2', NO_DATA, NO_DATA, `50,00${NBSP}₽`]);
	});
});
