import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '@/components/forms/PasswordInput';

describe('PasswordInput', () => {
	afterEach(cleanup);

	it('по умолчанию скрывает пароль, кнопка-глазик переключает видимость', async () => {
		render(<PasswordInput aria-label="Пароль" />);
		const input = screen.getByLabelText('Пароль');
		expect(input.getAttribute('type')).toBe('password');

		await userEvent.setup().click(screen.getByRole('button', { name: 'Показать пароль' }));
		expect(input.getAttribute('type')).toBe('text');

		await userEvent.setup().click(screen.getByRole('button', { name: 'Скрыть пароль' }));
		expect(input.getAttribute('type')).toBe('password');
	});
});
