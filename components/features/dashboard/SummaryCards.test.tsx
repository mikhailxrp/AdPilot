import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SummaryCards } from '@/components/features/dashboard/SummaryCards';
import { NO_DATA } from '@/lib/metrics/format';

// Intl для ru-RU ставит неразрывные пробелы
const NBSP = ' ';

describe('SummaryCards', () => {
	afterEach(cleanup);

	it('показывает расход, заказы и средний CPO', () => {
		render(<SummaryCards totals={{ cost: 123_456, orders: 12, cpo: 10_288 }} />);
		const region = screen.getByRole('region', { name: 'Итоги прогона' });

		expect(region.textContent).toContain(`1${NBSP}234,56${NBSP}₽`);
		expect(region.textContent).toContain('12');
		expect(region.textContent).toContain(`102,88${NBSP}₽`);
	});

	it('нет заказов → средний CPO «нет данных», без NaN и ∞', () => {
		render(<SummaryCards totals={{ cost: 0, orders: 0, cpo: null }} />);
		const region = screen.getByRole('region', { name: 'Итоги прогона' });

		expect(screen.getByText(NO_DATA)).toBeTruthy();
		expect(region.textContent).toContain(`0,00${NBSP}₽`);
		expect(region.textContent).not.toMatch(/NaN|∞/);
	});
});
