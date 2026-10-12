import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { JournalTable } from '@/components/features/journal/JournalTable';
import type { JournalRow } from '@/lib/agent/journal-queries';

const BASE_ROW: JournalRow = {
	id: 'd1',
	tick: 7,
	campaignName: 'Плохая',
	engine: 'RULES',
	action: 'LOWER_BID',
	before: 10_000,
	after: 8_000,
	reason: 'CPO выше цели на 40%',
	verdict: 'ACCEPTED',
	rejectReason: null,
	dryRun: false,
	applyError: null,
	metrics: null,
};

describe('JournalTable', () => {
	afterEach(cleanup);

	it('пустой список — «Записей нет»', () => {
		render(<JournalTable rows={[]} />);

		expect(screen.getByText(/Записей нет/)).toBeTruthy();
	});

	it('показывает причину и «было → стало» в рублях', () => {
		render(<JournalTable rows={[BASE_ROW]} />);

		expect(screen.getByText('CPO выше цели на 40%')).toBeTruthy();
		expect(screen.getByText(/100,00\s₽\s→\s80,00\s₽/)).toBeTruthy();
		expect(screen.getByText('Снижение ставки')).toBeTruthy();
	});

	it('помечает отклонённое решение и показывает причину отказа', () => {
		render(<JournalTable rows={[{ ...BASE_ROW, verdict: 'REJECTED', rejectReason: 'Шаг больше 20%' }]} />);

		expect(screen.getByText('Отклонено')).toBeTruthy();
		expect(screen.getByText(/Шаг больше 20%/)).toBeTruthy();
	});

	it('показывает ошибку применения и dry-run', () => {
		render(<JournalTable rows={[{ ...BASE_ROW, applyError: 'мок недоступен', dryRun: true }]} />);

		expect(screen.getByText(/мок недоступен/)).toBeTruthy();
		expect(screen.getByText('dry-run')).toBeTruthy();
	});

	it('кнопок «изменить» и «удалить» нет', () => {
		render(<JournalTable rows={[BASE_ROW]} />);

		expect(screen.queryByRole('button')).toBeNull();
	});
});
