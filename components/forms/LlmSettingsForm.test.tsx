import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { checkModelAction, resetPromptAction, updateLlmSettingsAction } from '@/actions/settings';
import { LlmSettingsForm } from '@/components/forms/LlmSettingsForm';
import { agentConfigSchema } from '@/lib/validations/agent-config';

vi.mock('@/actions/settings', () => ({
	updateLlmSettingsAction: vi.fn(),
	checkModelAction: vi.fn(),
	resetPromptAction: vi.fn(),
}));

const saveMock = vi.mocked(updateLlmSettingsAction);
const checkMock = vi.mocked(checkModelAction);
const resetMock = vi.mocked(resetPromptAction);
const BUILT_IN = 'Встроенный промпт';
const DEFAULT_CONFIG = agentConfigSchema.parse({});
const URI_LABEL = 'URI модели';
const PROMPT_LABEL = 'Системный промпт';

async function replaceValue(label: string, value: string): Promise<void> {
	const user = userEvent.setup();
	const input = screen.getByLabelText(label);
	await user.clear(input);
	await user.type(input, value);
}

async function click(name: string): Promise<void> {
	await userEvent.setup().click(screen.getByRole('button', { name }));
}

describe('LlmSettingsForm', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('при null в конфиге показывает встроенный промпт и предупреждение про eval:llm', () => {
		render(<LlmSettingsForm config={DEFAULT_CONFIG} builtInPrompt={BUILT_IN} />);

		expect(screen.getByLabelText(PROMPT_LABEL)).toHaveProperty('value', BUILT_IN);
		expect(screen.getByText(/npm run eval:llm/)).toBeTruthy();
	});

	it('URI не того формата — ошибка у поля, action не вызывается', async () => {
		render(<LlmSettingsForm config={DEFAULT_CONFIG} builtInPrompt={BUILT_IN} />);
		await replaceValue(URI_LABEL, 'yandexgpt');
		await click('Сохранить');

		expect(await screen.findByText(/Формат: gpt:/)).toBeTruthy();
		expect(screen.getByLabelText(URI_LABEL).getAttribute('aria-invalid')).toBe('true');
		expect(saveMock).not.toHaveBeenCalled();
	});

	it('пустой промпт — ошибка у поля', async () => {
		render(<LlmSettingsForm config={DEFAULT_CONFIG} builtInPrompt={BUILT_IN} />);
		await userEvent.setup().clear(screen.getByLabelText(PROMPT_LABEL));
		await click('Сохранить');

		expect(await screen.findByText('Промпт не может быть пустым')).toBeTruthy();
		expect(saveMock).not.toHaveBeenCalled();
	});

	it('валидная форма → action получает строки формы, показывается «Сохранено»', async () => {
		saveMock.mockResolvedValue({ success: true, data: { ...DEFAULT_CONFIG, llmTemperature: 0.5 } });
		render(<LlmSettingsForm config={DEFAULT_CONFIG} builtInPrompt={BUILT_IN} />);
		await replaceValue('Температура', '0,5');
		await click('Сохранить');

		expect(await screen.findByText('Сохранено')).toBeTruthy();
		expect(saveMock.mock.calls[0]?.[0]).toMatchObject({ llmTemperature: '0,5', llmSystemPrompt: BUILT_IN });
	});

	it('«Проверить модель» — успех показывает «доступна» и не сохраняет', async () => {
		checkMock.mockResolvedValue({ success: true, data: { ok: true, ms: 120 } });
		render(<LlmSettingsForm config={DEFAULT_CONFIG} builtInPrompt={BUILT_IN} />);
		await replaceValue(URI_LABEL, 'gpt://b1g/aliceai-llm/latest');
		await click('Проверить модель');

		expect(await screen.findByText('Модель доступна (120 мс)')).toBeTruthy();
		expect(checkMock).toHaveBeenCalledWith({ llmModelUri: 'gpt://b1g/aliceai-llm/latest', llmTemperature: '' });
		expect(saveMock).not.toHaveBeenCalled();
	});

	it('«Проверить модель» — ошибка показывает код', async () => {
		checkMock.mockResolvedValue({
			success: true,
			data: { ok: false, code: 'unauthorized', message: 'Неверный ключ', ms: 40 },
		});
		render(<LlmSettingsForm config={DEFAULT_CONFIG} builtInPrompt={BUILT_IN} />);
		await click('Проверить модель');

		expect(await screen.findByText(/unauthorized/)).toBeTruthy();
	});

	it('«Проверить модель» с плохим URI — action не вызывается', async () => {
		render(<LlmSettingsForm config={DEFAULT_CONFIG} builtInPrompt={BUILT_IN} />);
		await replaceValue(URI_LABEL, 'x');
		await click('Проверить модель');

		expect(await screen.findByText(/Формат: gpt:/)).toBeTruthy();
		expect(checkMock).not.toHaveBeenCalled();
	});

	it('«Вернуть по умолчанию» подставляет встроенный текст', async () => {
		resetMock.mockResolvedValue({ success: true, data: DEFAULT_CONFIG });
		render(<LlmSettingsForm config={{ ...DEFAULT_CONFIG, llmSystemPrompt: 'Свой промпт' }} builtInPrompt={BUILT_IN} />);
		expect(screen.getByLabelText(PROMPT_LABEL)).toHaveProperty('value', 'Свой промпт');

		await click('Вернуть по умолчанию');

		expect(await screen.findByText('Промпт возвращён по умолчанию')).toBeTruthy();
		expect(screen.getByLabelText(PROMPT_LABEL)).toHaveProperty('value', BUILT_IN);
		expect(resetMock).toHaveBeenCalledTimes(1);
	});
});
