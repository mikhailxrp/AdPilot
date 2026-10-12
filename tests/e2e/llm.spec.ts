import { expect, test, type Page } from '@playwright/test';
import { resetAgentConfig } from './helpers/agent-config';

// E2E в конце Phase 3: движок llm на fake-модели (`LLM_CLIENT=fake` в playwright.config.ts) — она отвечает
// решением rules в формате модели, поэтому seed 42 и 25 тиков дают тот же итог, что сценарий Phase 2.

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const SEED = '42';
const TICKS = 25;
const FAKE_MARKER = 'fake:';
const SCENARIO_TIMEOUT_MS = 240_000;
const SHADOW_CELL_INDEX = 5;
const NO_VALUE = '—';

// Тесты меняют общий активный прогон и конфиг агента — выполняем по очереди
test.describe.configure({ mode: 'serial' });

async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(ADMIN_EMAIL);
	await page.getByLabel('Пароль', { exact: true }).fill(ADMIN_PASSWORD);
	await page.getByRole('button', { name: 'Войти' }).click();
	await expect(page).toHaveURL(/\/dashboard/);
}

async function resetRun(page: Page): Promise<void> {
	await page.goto('/simulator');
	await page.getByLabel('Seed').fill(SEED);
	await page.getByRole('button', { name: 'Сбросить' }).click();
	await expect(page.getByText(/^Тик 0 · seed /)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Сбросить' })).toBeEnabled();
}

async function selectEngine(page: Page, label: 'LLM' | 'Правила'): Promise<void> {
	const radio = page.getByRole('radiogroup', { name: 'Движок агента' }).getByRole('radio', { name: label });
	await radio.click();
	// Радио отмечается только после успешного сохранения в БД
	await expect(radio).toBeChecked();
}

async function runTicks(page: Page, from: number, to: number): Promise<void> {
	for (let tick = from; tick <= to; tick += 1) {
		await page.getByRole('button', { name: 'Один тик' }).click();
		await expect(page.getByText(new RegExp(`^Тик ${tick} · seed `))).toBeVisible();
	}
}

async function selectFilter(page: Page, filter: string, option: string): Promise<void> {
	await page.getByRole('combobox', { name: filter }).click();
	await page.getByRole('option', { name: option, exact: true }).click();
}

/** Строки журнала с одним из действий и без пометки «Отклонено». */
function acceptedRows(page: Page, actions: RegExp) {
	return page.getByRole('row').filter({ hasText: actions }).filter({ hasNotText: 'Отклонено' });
}

test.describe('Phase 3: движок llm в цикле агента и сравнение с rules', () => {
	test.beforeAll(() => {
		if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
			throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD должны быть заданы в .env');
		}
		resetAgentConfig();
	});

	// Движок по умолчанию — rules: остальные сценарии не должны унаследовать llm, даже если этот упал
	test.afterAll(() => {
		resetAgentConfig();
	});

	test('гость на /journal и /simulator уходит на /login', async ({ page }) => {
		await page.goto('/journal');
		await expect(page).toHaveURL(/\/login/);

		await page.goto('/simulator');
		await expect(page).toHaveURL(/\/login/);
	});

	test(`llm на seed 42, ${TICKS} тиков: журнал с ответом модели и «rules решил бы», плохая урезана`, async ({ page }) => {
		test.setTimeout(SCENARIO_TIMEOUT_MS);
		await login(page);
		await resetRun(page);
		await selectEngine(page, 'LLM');

		// Первый тик — и сразу проверка, что отвечает fake, а не настоящая модель
		await runTicks(page, 1, 1);
		await page.goto('/journal?engine=LLM');
		const firstRow = page.getByRole('row').nth(1);
		await firstRow.getByText('Ответ модели').click();
		await expect(
			firstRow.locator('pre'),
			`В ответе модели нет «${FAKE_MARKER}»: dev-сервер запущен без LLM_CLIENT=fake — останови его и перезапусти e2e`,
		).toContainText(FAKE_MARKER);

		await page.goto('/simulator');
		await runTicks(page, 2, TICKS);

		// Журнал, фильтр «движок: LLM»: причина, метрики, сырой ответ, теневое решение rules
		await page.getByRole('link', { name: 'Журнал' }).click();
		await expect(page).toHaveURL(/\/journal/);
		await selectFilter(page, 'Движок', 'LLM');
		await expect(page).toHaveURL(/engine=LLM/);

		const row = page.getByRole('row').nth(1);
		await expect(row.getByText('LLM', { exact: true })).toBeVisible();
		await expect(row).toContainText(FAKE_MARKER);
		await row.getByText('Показать').click();
		await expect(row.getByText('CPO', { exact: true })).toBeVisible();
		await row.getByText('Ответ модели').click();
		await expect(row.locator('pre')).toContainText('"action"');
		await expect(row.getByRole('cell').nth(SHADOW_CELL_INDEX)).not.toHaveText(NO_VALUE);

		// «Плохая»: движок llm принял снижение ставки или паузу
		await selectFilter(page, 'Кампания', 'Плохая');
		await expect(page).toHaveURL(/campaign=/);
		await expect(acceptedRows(page, /Снижение ставки|Пауза/).first()).toBeVisible();

		// Обратно на rules: следующий тик пишет записи RULES
		await page.goto('/simulator');
		await selectEngine(page, 'Правила');
		await runTicks(page, TICKS + 1, TICKS + 1);

		await page.goto('/journal?engine=RULES');
		const rulesRow = page.getByRole('row').nth(1);
		await expect(rulesRow.getByRole('cell').first()).toHaveText(String(TICKS + 1));
		await expect(rulesRow.getByText('RULES', { exact: true })).toBeVisible();
		await expect(rulesRow.getByRole('cell').nth(SHADOW_CELL_INDEX)).toHaveText(NO_VALUE);
	});
});
