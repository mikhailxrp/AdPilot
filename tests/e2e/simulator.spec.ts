import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const SEED = '42';
const TICKS = 3;
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

async function resetWithSeed(page: Page, seed: string): Promise<void> {
	await page.getByLabel('Seed').fill(seed);
	await page.getByRole('button', { name: 'Сбросить' }).click();
	await expect(page.getByText(/^Тик 0 · seed /)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Сбросить' })).toBeEnabled();
}

async function runTicks(page: Page, count: number): Promise<void> {
	for (let tick = 1; tick <= count; tick++) {
		await page.getByRole('button', { name: 'Один тик' }).click();
		await expect(page.getByText(new RegExp(`^Тик ${tick} · seed `))).toBeVisible();
	}
}

test.describe('симулятор', () => {
	test.beforeAll(() => {
		if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
			throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD должны быть заданы в .env');
		}
	});

	test('гость на /simulator уходит на /login', async ({ page }) => {
		await page.goto('/simulator');

		await expect(page).toHaveURL(/\/login/);
	});

	test('сброс с seed, три тика и воспроизводимость цифр', async ({ page }) => {
		await login(page);
		await page.goto('/simulator');

		await resetWithSeed(page, SEED);
		await runTicks(page, TICKS);
		await expect(page.getByRole('row')).toHaveCount(CAMPAIGNS_COUNT + 1);
		const firstRun = (await page.getByRole('table').textContent()) ?? '';
		expect(firstRun).toContain('Хорошая');

		await resetWithSeed(page, SEED);
		await runTicks(page, TICKS);
		await expect(page.getByRole('table')).toHaveText(firstRun);
	});

	test('невалидный seed показывает ошибку у поля', async ({ page }) => {
		await login(page);
		await page.goto('/simulator');

		await page.getByLabel('Seed').fill('abc');
		await page.getByRole('button', { name: 'Сбросить' }).click();

		await expect(page.getByText(/Seed — целое число/)).toBeVisible();
	});
});
