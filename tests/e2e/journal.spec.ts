import { expect, test, type Page } from '@playwright/test';
import { resetAgentConfig } from './helpers/agent-config';

// E2E в конце Phase 2: seed 42, 25 тиков, пороги по умолчанию — «плохая» урезана, «хорошая» усилена.
// Те же цифры проверяет быстрый сценарий lib/agent/scenario.test.ts.

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const SEED = '42';
const TICKS = 25;
const BAD_START_BID_RUB = 30;
const SCENARIO_TIMEOUT_MS = 180_000;

// Тесты меняют общий активный прогон — выполняем по очереди
test.describe.configure({ mode: 'serial' });

async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(ADMIN_EMAIL);
	await page.getByLabel('Пароль', { exact: true }).fill(ADMIN_PASSWORD);
	await page.getByRole('button', { name: 'Войти' }).click();
	await expect(page).toHaveURL(/\/dashboard/);
}

async function resetAndRunTicks(page: Page, ticks: number): Promise<void> {
	await page.goto('/simulator');
	await page.getByLabel('Seed').fill(SEED);
	await page.getByRole('button', { name: 'Сбросить' }).click();
	await expect(page.getByText(/^Тик 0 · seed /)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Сбросить' })).toBeEnabled();

	for (let tick = 1; tick <= ticks; tick += 1) {
		await page.getByRole('button', { name: 'Один тик' }).click();
		await expect(page.getByText(new RegExp(`^Тик ${tick} · seed `))).toBeVisible();
	}
}

async function filterByCampaign(page: Page, name: string): Promise<void> {
	await page.getByRole('combobox', { name: 'Кампания' }).click();
	await page.getByRole('option', { name, exact: true }).click();
	await expect(page).toHaveURL(/campaign=/);
}

/** Строки журнала с одним из действий и без пометки «Отклонено». */
function acceptedRows(page: Page, actions: RegExp) {
	return page.getByRole('row').filter({ hasText: actions }).filter({ hasNotText: 'Отклонено' });
}

function parseRub(text: string): number {
	return Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
}

test.describe('Phase 2: агент урезает плохую кампанию и усиливает хорошую', () => {
	test.beforeAll(() => {
		if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
			throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD должны быть заданы в .env');
		}
		resetAgentConfig();
	});

	test('гость на /journal уходит на /login', async ({ page }) => {
		await page.goto('/journal');

		await expect(page).toHaveURL(/\/login/);
	});

	test(`сброс с seed 42 и ${TICKS} тиков: журнал с причинами, плохая урезана, хорошая усилена`, async ({ page }) => {
		test.setTimeout(SCENARIO_TIMEOUT_MS);
		await login(page);
		await resetAndRunTicks(page, TICKS);

		// Кампания «Плохая» на /simulator: ставка ниже стартовой или пауза
		const badRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Плохая', exact: true }) });
		const badState = await badRow.getByRole('cell').nth(1).innerText();
		const badBid = parseRub(await badRow.getByRole('cell').nth(2).innerText());
		expect(badState === 'Приостановлена' || badBid < BAD_START_BID_RUB).toBe(true);

		// Журнал: записи с причиной и метриками
		await page.getByRole('link', { name: 'Журнал' }).click();
		await expect(page).toHaveURL(/\/journal/);
		const firstRow = page.getByRole('row').nth(1);
		await expect(firstRow).toContainText(/Мало данных|CPO|Заказов|паузе/);
		await firstRow.getByText('Показать').click();
		await expect(firstRow.getByText('CPO', { exact: true })).toBeVisible();

		await filterByCampaign(page, 'Плохая');
		await expect(acceptedRows(page, /Снижение ставки|Пауза/).first()).toBeVisible();

		await filterByCampaign(page, 'Хорошая');
		await expect(acceptedRows(page, /Повышение бюджета|Повышение ставки/).first()).toBeVisible();
	});
});
