import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const WRONG_PASSWORD = 'definitely-wrong-password';

test.describe('вход администратора', () => {
	test.beforeAll(() => {
		if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
			throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD должны быть заданы в .env');
		}
	});

	test('гость на /dashboard уходит на /login', async ({ page }) => {
		await page.goto('/dashboard');

		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByLabel('Email')).toBeVisible();
	});

	test('неверный пароль показывает ошибку', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(ADMIN_EMAIL);
		await page.getByLabel('Пароль', { exact: true }).fill(WRONG_PASSWORD);
		await page.getByRole('button', { name: 'Войти' }).click();

		await expect(page.getByText('Неверный email или пароль')).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
	});

	test('админ входит и выходит, после выхода /dashboard закрыт', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(ADMIN_EMAIL);
		await page.getByLabel('Пароль', { exact: true }).fill(ADMIN_PASSWORD);
		await page.getByRole('button', { name: 'Войти' }).click();

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();

		await page.getByRole('button', { name: 'Выйти' }).click();
		await expect(page).toHaveURL(/\/login/);

		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login/);
	});
});
