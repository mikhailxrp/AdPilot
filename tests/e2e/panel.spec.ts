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

test.describe('панель: кампании', () => {
	test.beforeAll(() => {
		if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
			throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD должны быть заданы в .env');
		}
	});

	test('гость на /campaigns уходит на /login', async ({ page }) => {
		await page.goto('/campaigns');

		await expect(page).toHaveURL(/\/login/);
	});

	test('админ видит кампании активного прогона со ссылками', async ({ page }) => {
		await login(page);
		await resetAndTick(page);

		await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Кампании' }).click();
		await expect(page).toHaveURL(/\/campaigns$/);
		await expect(page.getByRole('heading', { name: 'Кампании' })).toBeVisible();
		// После клиентского перехода скрытая /simulator остаётся в DOM — берём только видимый текст
		await expect(page.getByText(/^Тик 1 · seed /).filter({ visible: true })).toBeVisible();

		const rows = page.getByRole('table').getByRole('row');
		// строка заголовка + кампании
		await expect(rows).toHaveCount(CAMPAIGNS_COUNT + 1);

		const badLink = page.getByRole('link', { name: 'Плохая' });
		await expect(badLink).toHaveAttribute('href', /^\/campaigns\/[^/]+$/);
	});
});
