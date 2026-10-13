import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AdminNav } from '@/components/layouts/AdminNav';

const mockPathname = vi.fn<() => string>();

vi.mock('next/navigation', () => ({
	usePathname: () => mockPathname(),
}));

describe('AdminNav', () => {
	afterEach(cleanup);

	it('показывает ссылки на дашборд и симулятор', () => {
		mockPathname.mockReturnValue('/dashboard');
		render(<AdminNav />);

		expect(screen.getByRole('link', { name: 'Дашборд' }).getAttribute('href')).toBe('/dashboard');
		expect(screen.getByRole('link', { name: 'Симулятор' }).getAttribute('href')).toBe('/simulator');
	});

	it('показывает ссылку на журнал', () => {
		mockPathname.mockReturnValue('/journal');
		render(<AdminNav />);

		const link = screen.getByRole('link', { name: 'Журнал' });
		expect(link.getAttribute('href')).toBe('/journal');
		expect(link.getAttribute('aria-current')).toBe('page');
	});

	it('показывает ссылку на кампании', () => {
		mockPathname.mockReturnValue('/campaigns');
		render(<AdminNav />);

		const link = screen.getByRole('link', { name: 'Кампании' });
		expect(link.getAttribute('href')).toBe('/campaigns');
		expect(link.getAttribute('aria-current')).toBe('page');
		expect(screen.getByRole('link', { name: 'Дашборд' }).getAttribute('aria-current')).toBeNull();
	});

	it('на странице кампании активен раздел «Кампании»', () => {
		mockPathname.mockReturnValue('/campaigns/abc');
		render(<AdminNav />);

		expect(screen.getByRole('link', { name: 'Кампании' }).getAttribute('aria-current')).toBe('page');
	});

	it('путь с тем же началом не делает раздел активным', () => {
		mockPathname.mockReturnValue('/campaigns-archive');
		render(<AdminNav />);

		expect(screen.getByRole('link', { name: 'Кампании' }).getAttribute('aria-current')).toBeNull();
	});

	it('помечает активной только ссылку текущей страницы', () => {
		mockPathname.mockReturnValue('/simulator');
		render(<AdminNav />);

		expect(screen.getByRole('link', { name: 'Симулятор' }).getAttribute('aria-current')).toBe('page');
		expect(screen.getByRole('link', { name: 'Дашборд' }).getAttribute('aria-current')).toBeNull();
	});
});
