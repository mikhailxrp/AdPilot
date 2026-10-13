import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const SEED = '42';
const CAMPAIGNS_COUNT = 4;
const SCENARIO_TICKS = 20;
const SCENARIO_TIMEOUT_MS = 240_000;

// Тесты меняют общий активный прогон — выполняем по очереди
test.describe.configure({ mode: 'serial' });

async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(ADMIN_EMAIL);
	await page.getByLabel('Пароль', { exact: true }).fill(ADMIN_PASSWORD);
	await page.getByRole('button', { name: 'Войти' }).click();
	await expect(page).toHaveURL(/\/dashboard/);
}

async function reset(page: Page): Promise<void> {
	await page.goto('/simulator');
	await page.getByLabel('Seed').fill(SEED);
	await page.getByRole('button', { name: 'Сбросить' }).click();
	await expect(page.getByText(/^Тик 0 · seed /)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Сбросить' })).toBeEnabled();
}

async function resetAndTick(page: Page): Promise<void> {
	await reset(page);
	await page.getByRole('button', { name: 'Один тик' }).click();
	await expect(page.getByText(/^Тик 1 · seed /)).toBeVisible();
}

async function runTicks(page: Page, count: number): Promise<void> {
	for (let tick = 1; tick <= count; tick += 1) {
		await page.getByRole('button', { name: 'Один тик' }).click();
		await expect(page.getByText(new RegExp(`^Тик ${tick} · seed `))).toBeVisible();
	}
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

test.describe('панель: страница кампании', () => {
	test('гость на /campaigns/<id> уходит на /login', async ({ page }) => {
		await page.goto('/campaigns/any-id');

		await expect(page).toHaveURL(/\/login/);
	});

	test('админ видит сводку, тики и только журнал кампании; старая кампания — архив', async ({ page }) => {
		await login(page);
		await resetAndTick(page);

		await page.goto('/campaigns');
		await page.getByRole('link', { name: 'Плохая' }).click();
		await expect(page).toHaveURL(/\/campaigns\/[^/]+$/);
		const campaignUrl = page.url();

		await expect(page.getByRole('heading', { level: 1, name: 'Плохая' })).toBeVisible();
		const summary = page.getByRole('region', { name: 'Сводка кампании' });
		await expect(summary.getByText(/^Тик 1 · seed /)).toBeVisible();
		await expect(summary.getByText('архив')).toHaveCount(0);

		const charts = page.getByRole('region', { name: 'Графики' });
		for (const name of ['Ставка', 'Расход', /^CPO за \d+ тиков/]) {
			const chart = charts.getByRole('img', { name });
			await expect(chart).toBeVisible();
			await expect(chart.locator('svg .recharts-line').first()).toBeAttached();
		}
		await expect(charts.getByText(/^Цель CPO:/)).toBeVisible();
		await expect(charts.getByText(/^Допустимый CPO/)).toBeVisible();

		await page.getByText('Данные по тикам').click();
		await expect(page.getByRole('columnheader', { name: /^CPO за \d+ тиков$/ })).toBeVisible();

		const journal = page.getByRole('region', { name: 'Журнал кампании' });
		const journalRows = journal.getByRole('row');
		// строка заголовка + хотя бы одно решение
		await expect(journalRows.nth(1)).toBeVisible();
		const campaignCells = await journalRows.locator('td:nth-child(2)').allTextContents();
		expect(campaignCells.length).toBeGreaterThan(0);
		expect(new Set(campaignCells)).toEqual(new Set(['Плохая']));

		// Новый сброс архивирует прогон — сохранённая ссылка открывается с бейджем «архив»
		await resetAndTick(page);
		await page.goto(campaignUrl);
		await expect(page.getByRole('region', { name: 'Сводка кампании' }).getByText('архив')).toBeVisible();
	});

	test('0 тиков → «Тиков ещё не было» вместо графиков', async ({ page }) => {
		await login(page);
		await reset(page);

		await page.goto('/campaigns');
		await page.getByRole('link', { name: 'Плохая' }).click();
		await expect(page).toHaveURL(/\/campaigns\/[^/]+$/);

		const charts = page.getByRole('region', { name: 'Графики' });
		await expect(charts.getByText(/Тиков ещё не было/)).toBeVisible();
		await expect(charts.getByRole('img')).toHaveCount(0);
	});

	test('несуществующая кампания → «Кампания не найдена»', async ({ page }) => {
		await login(page);
		await page.goto('/campaigns/nonexistent');

		await expect(page.getByRole('heading', { name: 'Кампания не найдена' })).toBeVisible();
	});
});

test.describe('панель: дашборд', () => {
	test('админ видит итоги, CPO по кампаниям и последние решения', async ({ page }) => {
		await login(page);
		await resetAndTick(page);

		await page.goto('/dashboard');
		await expect(page.getByRole('heading', { level: 1, name: 'Дашборд' })).toBeVisible();
		await expect(page.getByText(/^Тик 1 · seed /)).toBeVisible();

		const totals = page.getByRole('region', { name: 'Итоги прогона' });
		for (const label of ['Расход', 'Заказы', 'Средний CPO']) {
			await expect(totals.getByText(label, { exact: true })).toBeVisible();
		}
		await expect(totals).not.toContainText(/NaN|∞/);

		const cpo = page.getByRole('region', { name: 'CPO по кампаниям' });
		// строка заголовка + кампании
		await expect(cpo.getByRole('row')).toHaveCount(CAMPAIGNS_COUNT + 1);
		await expect(cpo.getByRole('link', { name: 'Плохая' })).toHaveAttribute('href', /^\/campaigns\/[^/]+$/);

		const decisions = page.getByRole('region', { name: 'Последние решения' });
		await expect(decisions.getByRole('listitem').first()).toContainText('Тик 1');

		await decisions.getByRole('link', { name: 'Весь журнал' }).click();
		await expect(page).toHaveURL(/\/journal/);
	});

	test('0 тиков → CPO «нет данных», решений нет', async ({ page }) => {
		await login(page);
		await reset(page);

		await page.goto('/dashboard');
		await expect(page.getByRole('region', { name: 'Итоги прогона' }).getByText('нет данных')).toBeVisible();
		await expect(page.getByRole('region', { name: 'Последние решения' }).getByText('Решений ещё нет.')).toBeVisible();
	});
});

test.describe('Phase 4: сквозной сценарий панели', () => {
	test(`после ${SCENARIO_TICKS} тиков дашборд, кампании, графики и журнал «Плохой» согласованы`, async ({ page }) => {
		test.setTimeout(SCENARIO_TIMEOUT_MS);
		await login(page);
		await reset(page);
		await runTicks(page, SCENARIO_TICKS);

		await page.goto('/dashboard');
		const totals = page.getByRole('region', { name: 'Итоги прогона' });
		await expect(totals).not.toContainText(/NaN|∞|нет данных/);
		const decisions = page.getByRole('region', { name: 'Последние решения' });
		await expect(decisions.getByRole('listitem').first()).toContainText(`Тик ${SCENARIO_TICKS}`);

		await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Кампании' }).click();
		await expect(page).toHaveURL(/\/campaigns$/);
		await page.getByRole('link', { name: 'Плохая' }).click();
		await expect(page).toHaveURL(/\/campaigns\/[^/]+$/);

		const charts = page.getByRole('region', { name: 'Графики' });
		for (const name of ['Ставка', 'Расход', /^CPO за \d+ тиков/]) {
			await expect(charts.getByRole('img', { name })).toBeVisible();
		}

		const journal = page.getByRole('region', { name: 'Журнал кампании' });
		await expect(journal.getByRole('row').nth(1)).toBeVisible();
		const campaignCells = await journal.getByRole('row').locator('td:nth-child(2)').allTextContents();
		expect(new Set(campaignCells)).toEqual(new Set(['Плохая']));
	});
});
