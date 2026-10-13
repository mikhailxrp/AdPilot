import { expect, test, type Page } from '@playwright/test';
import { resetAgentConfig } from './helpers/agent-config';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const STEP_LABEL = 'Максимальный шаг, %';
const DEFAULT_STEP = '20';
const NEW_STEP = '15';
const INVALID_STEP = '51';

// Тесты меняют общий конфиг агента — выполняем по очереди
test.describe.configure({ mode: 'serial' });

async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(ADMIN_EMAIL);
	await page.getByLabel('Пароль', { exact: true }).fill(ADMIN_PASSWORD);
	await page.getByRole('button', { name: 'Войти' }).click();
	await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('настройки агента', () => {
	test.beforeAll(() => {
		if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
			throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD должны быть заданы в .env');
		}
		resetAgentConfig();
	});

	// Остальные спеки рассчитаны на дефолты: RULES, без dry-run, шаг 20 %
	test.afterAll(() => {
		resetAgentConfig();
	});

	test('гость на /settings уходит на /login', async ({ page }) => {
		await page.goto('/settings');

		await expect(page).toHaveURL(/\/login/);
	});

	test('ссылка «Настройки» в шапке ведёт на /settings', async ({ page }) => {
		await login(page);

		await page.getByRole('link', { name: 'Настройки' }).click();

		await expect(page).toHaveURL(/\/settings/);
		await expect(page.getByRole('link', { name: 'Настройки' })).toHaveAttribute('aria-current', 'page');
	});

	test('невалидный шаг — ошибка у поля, конфиг не меняется', async ({ page }) => {
		await login(page);
		await page.goto('/settings');

		await page.getByLabel(STEP_LABEL).fill(INVALID_STEP);
		await page.getByRole('button', { name: 'Сохранить' }).click();

		await expect(page.getByText('Целое число от 1 до 50')).toBeVisible();
		await page.reload();
		await expect(page.getByLabel(STEP_LABEL)).toHaveValue(DEFAULT_STEP);
	});

	test('шаг, dry-run и движок сохраняются и видны на /simulator', async ({ page }) => {
		await login(page);
		await page.goto('/settings');

		await page.getByLabel(STEP_LABEL).fill(NEW_STEP);
		await page.getByRole('switch', { name: 'Dry-run' }).click();
		await page.getByRole('radiogroup', { name: 'Движок агента' }).getByRole('radio', { name: 'LLM' }).click();
		await page.getByRole('button', { name: 'Сохранить' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Сохранено' })).toBeVisible();

		await page.reload();
		await expect(page.getByLabel(STEP_LABEL)).toHaveValue(NEW_STEP);
		await expect(page.getByRole('switch', { name: 'Dry-run' })).toBeChecked();
		await expect(
			page.getByRole('radiogroup', { name: 'Движок агента' }).getByRole('radio', { name: 'LLM' }),
		).toBeChecked();

		await page.goto('/simulator');
		await expect(
			page.getByRole('radiogroup', { name: 'Движок агента' }).getByRole('radio', { name: 'LLM' }),
		).toBeChecked();
	});
});
