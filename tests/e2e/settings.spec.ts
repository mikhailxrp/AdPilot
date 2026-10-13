import { expect, test, type Page } from '@playwright/test';
import { resetAgentConfig } from './helpers/agent-config';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const STEP_LABEL = 'Максимальный шаг, %';
const DEFAULT_STEP = '20';
const NEW_STEP = '15';
const INVALID_STEP = '51';
const SEED = '42';
const MAX_DRY_RUN_TICKS = 30;
const SCENARIO_TIMEOUT_MS = 240_000;
const BID_CELL_SELECTOR = 'td:nth-child(3)';
const PROMPT_MARKER = 'E2E-маркер Phase 4';
const ACTIVE_ACTIONS = /Снижение ставки|Повышение ставки|Повышение бюджета|Пауза/;

// Тесты меняют общий конфиг агента — выполняем по очереди
test.describe.configure({ mode: 'serial' });

/** На странице две формы со своим «Сохранить»: основная — та, где есть поле шага. */
async function saveAgentForm(page: Page): Promise<void> {
	await page
		.locator('form', { has: page.getByLabel(STEP_LABEL) })
		.getByRole('button', { name: 'Сохранить' })
		.click();
}

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

async function tick(page: Page, number: number): Promise<void> {
	await page.getByRole('button', { name: 'Один тик' }).click();
	await expect(page.getByText(new RegExp(`^Тик ${number} · seed `))).toBeVisible();
}

async function readBids(page: Page): Promise<string[]> {
	await page.goto('/campaigns');
	const bids = page.getByRole('table').getByRole('row').locator(BID_CELL_SELECTOR);
	await expect(bids.first()).toBeVisible();
	return bids.allTextContents();
}

function llmForm(page: Page) {
	return page.locator('form', { has: page.getByLabel('Системный промпт') });
}

/** Отпечаток версии промпта из подписи «Версия промпта <sha> · дата» в первой (новейшей) строке журнала. */
async function latestPromptVersion(page: Page): Promise<{ hash: string; text: string }> {
	await page.goto('/journal?engine=LLM');
	const summary = page.getByRole('row').nth(1).locator('summary', { hasText: 'Версия промпта' });
	const label = (await summary.textContent()) ?? '';
	const hash = /Версия промпта (\S+)/.exec(label)?.[1] ?? '';
	await summary.click();
	const text = (await summary.locator('xpath=..').locator('pre').textContent()) ?? '';
	return { hash, text };
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
		await saveAgentForm(page);

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
		await saveAgentForm(page);
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

test.describe('Phase 4: dry-run, проверка модели, версии промпта', () => {
	test.describe.configure({ mode: 'serial' });

	test.beforeEach(() => {
		resetAgentConfig();
	});

	test.afterAll(() => {
		resetAgentConfig();
	});

	test('тик в dry-run пишет записи с пометкой и не меняет ставки', async ({ page }) => {
		test.setTimeout(SCENARIO_TIMEOUT_MS);
		await login(page);
		await resetRun(page);
		const bidsBefore = await readBids(page);
		expect(bidsBefore.length).toBeGreaterThan(0);

		await page.goto('/settings');
		await page.getByRole('switch', { name: 'Dry-run' }).click();
		await saveAgentForm(page);
		await expect(page.getByRole('status').filter({ hasText: 'Сохранено' })).toBeVisible();

		// Тики идут, пока агент не «захочет» что-то изменить: иначе в журнале только HOLD / WAIT_DATA
		await page.goto('/simulator');
		const activeRow = page.getByRole('row').filter({ hasText: ACTIVE_ACTIONS }).filter({ hasText: 'dry-run' });
		let ticks = 0;
		for (let i = 1; i <= MAX_DRY_RUN_TICKS; i += 1) {
			await tick(page, i);
			ticks = i;
			if (i < 10) continue;
			await page.goto('/journal');
			if ((await activeRow.count()) > 0) break;
			await page.goto('/simulator');
		}
		await page.goto('/journal');
		await expect(
			activeRow.first(),
			`За ${ticks} тиков в dry-run нет ни одного решения с изменением`,
		).toBeVisible();

		expect(await readBids(page)).toEqual(bidsBefore);
	});

	test('«Проверить модель» показывает, что модель доступна', async ({ page }) => {
		await login(page);
		await page.goto('/settings');

		await llmForm(page).getByRole('button', { name: 'Проверить модель' }).click();

		await expect(page.getByRole('status').filter({ hasText: /^Модель доступна \(\d+ мс\)$/ })).toBeVisible();
	});

	test('правка промпта даёт новую версию в журнале, «вернуть по умолчанию» — другую', async ({ page }) => {
		test.setTimeout(SCENARIO_TIMEOUT_MS);
		await login(page);
		await resetRun(page);

		await page.getByRole('radiogroup', { name: 'Движок агента' }).getByRole('radio', { name: 'LLM' }).click();
		await expect(
			page.getByRole('radiogroup', { name: 'Движок агента' }).getByRole('radio', { name: 'LLM' }),
		).toBeChecked();

		await page.goto('/settings');
		const prompt = llmForm(page).getByLabel('Системный промпт');
		const builtIn = await prompt.inputValue();
		await prompt.fill(`${builtIn}
${PROMPT_MARKER}`);
		await llmForm(page).getByRole('button', { name: 'Сохранить' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Сохранено' })).toBeVisible();

		await page.goto('/simulator');
		await tick(page, 1);
		const edited = await latestPromptVersion(page);
		expect(edited.hash).not.toBe('');
		expect(edited.text).toContain(PROMPT_MARKER);

		await page.goto('/settings');
		await llmForm(page).getByRole('button', { name: 'Вернуть по умолчанию' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Промпт возвращён по умолчанию' })).toBeVisible();
		await expect(llmForm(page).getByLabel('Системный промпт')).not.toHaveValue(new RegExp(PROMPT_MARKER));

		await page.goto('/simulator');
		await tick(page, 2);
		const restored = await latestPromptVersion(page);
		expect(restored.hash).not.toBe(edited.hash);
		expect(restored.text).not.toContain(PROMPT_MARKER);
	});
});
