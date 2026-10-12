import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const SEED = '42';
const CAMPAIGNS_COUNT = 4;

// Тесты меняют общий активный прогон — выполняем по очереди
test.describe.configure({ mode: 'serial' });

async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(ADMIN_EMAIL);
	await page.getByLabel('Пароль', { exact: true }).fill(ADMIN_PASSWORD);
	await page.getByRole('button', { name: 'Войти' }).click();
	await expect(page).toHaveURL(/\/dashboard/);
}

async function resetAndTick(page: Page): Promise<void> {
	await page.goto('/simulator');
	await page.getByLabel('Seed').fill(SEED);
	await page.getByRole('button', { name: 'Сбросить' }).click();
	await expect(page.getByText(/^Тик 0 · seed /)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Сбросить' })).toBeEnabled();

	await page.getByRole('button', { name: 'Один тик' }).click();
	await expect(page.getByText(/^Тик 1 · seed /)).toBeVisible();
}

test.describe('журнал решений', () => {
	test.beforeAll(() => {
		if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
			throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD должны быть заданы в .env');
		}
	});

	test('гость на /journal уходит на /login', async ({ page }) => {
		await page.goto('/journal');

		await expect(page).toHaveURL(/\/login/);
	});

	test('после тика журнал показывает решения по всем кампаниям, без кнопок правки', async ({ page }) => {
		await login(page);
		await resetAndTick(page);

		await page.getByRole('link', { name: 'Журнал' }).click();

		await expect(page).toHaveURL(/\/journal/);
		await expect(page.getByRole('row')).toHaveCount(CAMPAIGNS_COUNT + 1);
		await expect(page.getByRole('button', { name: /изменить|удалить/i })).toHaveCount(0);
	});

	test('фильтр по действию попадает в URL, переживает перезагрузку и сужает список', async ({ page }) => {
		await login(page);
		await resetAndTick(page);
		await page.goto('/journal');

		await page.getByRole('combobox', { name: 'Действие' }).click();
		await page.getByRole('option', { name: 'Пауза' }).click();

		await expect(page).toHaveURL(/action=PAUSE/);
		await expect(page.getByText(/Записей нет/)).toBeVisible();

		await page.reload();
		await expect(page).toHaveURL(/action=PAUSE/);
		await expect(page.getByRole('combobox', { name: 'Действие' })).toContainText('Пауза');
	});

	test('невалидные параметры URL не ломают страницу', async ({ page }) => {
		await login(page);

		await page.goto('/journal?action=EXPLODE&page=-5');

		await expect(page.getByRole('heading', { name: 'Журнал решений' })).toBeVisible();
	});
});
