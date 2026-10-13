import { expect, test, type Page } from '@playwright/test';

// Smoke фазы 5 против prod-стека: локального за docker-compose.traefik-local.yml или домена на VPS.
//   E2E_BASE_URL=https://localhost npm run test:smoke
// Нужны ADMIN_EMAIL и ADMIN_PASSWORD (из .env или окружения); БД и MOCK_API_TOKEN не нужны.
// Внимание: «Сбросить» архивирует активный прогон целевого стека и создаёт новый (журнал только дополняется),
// а тики идут движком, выбранным в /simulator — при LLM на VPS они сходят в платную модель.

const BASE_URL = process.env.E2E_BASE_URL ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const SEED = '42';
const TICKS = 3;
const SMOKE_TIMEOUT_MS = 120_000;
const MOCK_CAMPAIGNS_PATH = '/api/mock/direct/json/v5/campaigns';
const REDIRECT_STATUSES = [301, 302, 307, 308];

test.skip(!BASE_URL, 'E2E_BASE_URL не задан — smoke запускается только против prod-стека');

// Тесты меняют общий активный прогон — выполняем по очереди
test.describe.configure({ mode: 'serial' });

async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(ADMIN_EMAIL);
	await page.getByLabel('Пароль', { exact: true }).fill(ADMIN_PASSWORD);
	await page.getByRole('button', { name: 'Войти' }).click();
	await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('prod-стек: smoke', () => {
	test.beforeAll(() => {
		if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
			throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD должны быть заданы в .env или окружении');
		}
	});

	test('гость на /dashboard уходит на /login', async ({ page }) => {
		await page.goto('/dashboard');

		await expect(page).toHaveURL(/\/login/);
	});

	test('админ: сброс, три тика, записи в журнале и расход на дашборде', async ({ page }) => {
		test.setTimeout(SMOKE_TIMEOUT_MS);
		await login(page);
		await page.goto('/simulator');

		await page.getByLabel('Seed').fill(SEED);
		await page.getByRole('button', { name: 'Сбросить' }).click();
		await expect(page.getByText(/^Тик 0 · seed /)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Сбросить' })).toBeEnabled();

		for (let tick = 1; tick <= TICKS; tick += 1) {
			await page.getByRole('button', { name: 'Один тик' }).click();
			await expect(page.getByText(new RegExp(`^Тик ${tick} · seed `))).toBeVisible();
		}
		await expect(page.getByText(/агент не отработал/)).toHaveCount(0);

		await page.goto('/journal');
		// строка заголовка + хотя бы одно решение
		await expect(page.getByRole('row')).not.toHaveCount(1);
		await expect(page.getByRole('row').nth(1)).toBeVisible();

		await page.goto('/dashboard');
		const summary = page.getByRole('region', { name: 'Итоги прогона' });
		// Первая карточка — «Расход»; \s ловит неразрывный пробел перед «₽»
		await expect(summary.locator('p').first()).not.toHaveText(/^0,00\s/);
	});

	test('/api/health открыт гостю и отдаёт ok без редиректа', async ({ request }) => {
		const response = await request.get('/api/health', { maxRedirects: 0 });

		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual({ status: 'ok' });
	});

	test('мок Директа снаружи закрыт роутером: 404, а не 401', async ({ request }) => {
		const response = await request.post(MOCK_CAMPAIGNS_PATH, {
			data: { method: 'get', params: {} },
			maxRedirects: 0,
		});

		expect(response.status()).toBe(404);
	});

	test('http:// редиректит на https://', async ({ request }) => {
		const httpUrl = new URL(BASE_URL);
		httpUrl.protocol = 'http:';

		const response = await request.get(httpUrl.toString(), { maxRedirects: 0 });

		expect(REDIRECT_STATUSES).toContain(response.status());
		expect(response.headers()['location']).toMatch(/^https:\/\//);
	});
});
