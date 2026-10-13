import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { updateAgentConfigAction } from '@/actions/settings';
import { AgentConfigForm } from '@/components/forms/AgentConfigForm';
import { agentConfigSchema } from '@/lib/validations/agent-config';

vi.mock('@/actions/settings', () => ({
	updateAgentConfigAction: vi.fn(),
}));

const actionMock = vi.mocked(updateAgentConfigAction);
const DEFAULT_CONFIG = agentConfigSchema.parse({});

async function replaceValue(label: string, value: string): Promise<void> {
	const user = userEvent.setup();
	const input = screen.getByLabelText(label);
	await user.clear(input);
	await user.type(input, value);
}

async function submit(): Promise<void> {
	await userEvent.setup().click(screen.getByRole('button', { name: 'Сохранить' }));
}

describe('AgentConfigForm', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('показывает текущий конфиг, лимит бюджета — в рублях', () => {
		render(<AgentConfigForm config={{ ...DEFAULT_CONFIG, maxDailyBudget: 1_000_050 }} />);

		expect(screen.getByLabelText('Максимальный шаг, %')).toHaveProperty('value', '20');
		expect(screen.getByLabelText('Лимит дневного бюджета, ₽')).toHaveProperty('value', '10000,50');
		expect(screen.getByRole('radio', { name: 'Правила' }).getAttribute('aria-checked')).toBe('true');
	});

	it('шаг за границей — ошибка у поля, action не вызывается', async () => {
		render(<AgentConfigForm config={DEFAULT_CONFIG} />);
		await replaceValue('Максимальный шаг, %', '51');
		await submit();

		expect(await screen.findByText('Целое число от 1 до 50')).toBeTruthy();
		expect(screen.getByLabelText('Максимальный шаг, %').getAttribute('aria-invalid')).toBe('true');
		expect(actionMock).not.toHaveBeenCalled();
	});

	it('дробные копейки — ошибка у поля лимита', async () => {
		render(<AgentConfigForm config={DEFAULT_CONFIG} />);
		await replaceValue('Лимит дневного бюджета, ₽', '1,005');
		await submit();

		expect(await screen.findByText('Не больше 2 знаков после запятой')).toBeTruthy();
		expect(actionMock).not.toHaveBeenCalled();
	});

	it('валидная форма → action получает значения формы, показывается «Сохранено»', async () => {
		const saved = { ...DEFAULT_CONFIG, maxStepPct: 15, dryRun: true };
		actionMock.mockResolvedValue({ success: true, data: saved });
		render(<AgentConfigForm config={DEFAULT_CONFIG} />);

		await replaceValue('Максимальный шаг, %', '15');
		await userEvent.setup().click(screen.getByRole('switch', { name: 'Dry-run' }));
		await submit();

		expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Сохранено');
		expect(actionMock).toHaveBeenCalledTimes(1);
		expect(actionMock.mock.calls[0]?.[0]).toMatchObject({ maxStepPct: '15', dryRun: true, maxDailyBudget: '10000' });
	});

	it('ошибка сервера показывается сообщением', async () => {
		actionMock.mockResolvedValue({ success: false, error: 'Не удалось сохранить настройки. Попробуйте ещё раз' });
		render(<AgentConfigForm config={DEFAULT_CONFIG} />);
		await submit();

		expect(await screen.findByRole('alert')).toHaveProperty(
			'textContent',
			'Не удалось сохранить настройки. Попробуйте ещё раз',
		);
		expect(screen.queryByText('Сохранено')).toBeNull();
	});
});
