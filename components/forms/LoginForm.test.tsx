import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signIn } from 'next-auth/react';
import { LoginForm } from '@/components/forms/LoginForm';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push, refresh }),
}));

vi.mock('next-auth/react', () => ({
	signIn: vi.fn(),
}));

const signInMock = vi.mocked(signIn as (...args: unknown[]) => Promise<unknown>);

async function fillAndSubmit(email: string, password: string): Promise<void> {
	const user = userEvent.setup();
	await user.type(screen.getByLabelText('Email'), email);
	await user.type(screen.getByLabelText('Пароль'), password);
	await user.click(screen.getByRole('button', { name: 'Войти' }));
}

describe('LoginForm', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('показывает ошибки полей при пустой отправке и не вызывает signIn', async () => {
		render(<LoginForm />);
		await userEvent.setup().click(screen.getByRole('button', { name: 'Войти' }));

		expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
		expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
		expect(signInMock).not.toHaveBeenCalled();
	});

	it('показывает «Неверный email или пароль», если signIn вернул ошибку', async () => {
		signInMock.mockResolvedValue({ error: 'CredentialsSignin', ok: true });
		render(<LoginForm />);
		await fillAndSubmit('admin@example.com', 'wrong-password');

		expect(await screen.findByText('Неверный email или пароль')).toBeTruthy();
		expect(push).not.toHaveBeenCalled();
	});

	it('при успешном входе переходит на /dashboard', async () => {
		signInMock.mockResolvedValue({ error: undefined, ok: true });
		render(<LoginForm />);
		await fillAndSubmit('admin@example.com', 'correct-password');

		await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
		expect(signInMock).toHaveBeenCalledWith('credentials', {
			email: 'admin@example.com',
			password: 'correct-password',
			redirect: false,
		});
	});
});
