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
	rawResponse: null,
	shadowAction: null,
	shadowAfter: null,
	shadowReason: null,
	promptVersion: null,
};

const LLM_ROW: JournalRow = {
	...BASE_ROW,
	id: 'd2',
	engine: 'LLM',
	action: 'HOLD',
	before: null,
	after: null,
	reason: 'Ждём ещё сутки',
	rawResponse: '{"action":"HOLD","value":null,"reason":"Ждём ещё сутки"}',
	shadowAction: 'LOWER_BID',
	shadowAfter: 8_000,
	shadowReason: 'CPO выше допустимого',
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

	it('у записи LLM видно, что решил бы rules: действие, рубли, причина и «Разошлись»', () => {
		render(<JournalTable rows={[LLM_ROW]} />);

		expect(screen.getByRole('columnheader', { name: 'rules решил бы' })).toBeTruthy();
		expect(screen.getByText('Снижение ставки')).toBeTruthy();
		expect(screen.getByText(/→\s80,00\s₽/)).toBeTruthy();
		expect(screen.getByText('CPO выше допустимого')).toBeTruthy();
		expect(screen.getByText('Разошлись')).toBeTruthy();
	});

	it('одинаковые действия — без «Разошлись»', () => {
		render(<JournalTable rows={[{ ...LLM_ROW, action: 'LOWER_BID', before: 10_000, after: 8_000 }]} />);

		expect(screen.queryByText('Разошлись')).toBeNull();
	});

	it('у записи rules в колонке сравнения прочерк, ответа модели нет', () => {
		render(<JournalTable rows={[BASE_ROW]} />);

		const cells = screen.getAllByRole('cell');
		expect(cells[5]?.textContent).toBe('—');
		expect(screen.queryByText('Ответ модели')).toBeNull();
	});

	it('сырой ответ модели под «Ответ модели»', () => {
		render(<JournalTable rows={[LLM_ROW]} />);

		expect(screen.getByText('Ответ модели')).toBeTruthy();
		expect(screen.getByText(LLM_ROW.rawResponse ?? '')).toBeTruthy();
	});

	it('у записи с версией промпта — отпечаток, дата и текст', () => {
		const promptVersion = {
			id: 'pv1',
			sha256: 'abcdef0123456789',
			text: 'Ты — агент рекламных кампаний',
			createdAt: new Date('2026-10-13T09:30:00'),
		};
		render(<JournalTable rows={[{ ...LLM_ROW, promptVersion }]} />);

		expect(screen.getByText(/Версия промпта abcdef01/)).toBeTruthy();
		expect(screen.getByText('Ты — агент рекламных кампаний')).toBeTruthy();
	});

	it('без версии промпта блока нет', () => {
		render(<JournalTable rows={[BASE_ROW]} />);

		expect(screen.queryByText(/Версия промпта/)).toBeNull();
	});

	it('кнопок «изменить» и «удалить» нет', () => {
		render(<JournalTable rows={[BASE_ROW]} />);

		expect(screen.queryByRole('button')).toBeNull();
	});
});
