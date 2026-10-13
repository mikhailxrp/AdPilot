import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3000);
const DEV_BASE_URL = `http://localhost:${PORT}`;
// Smoke против готового prod-стека (локальный Traefik или VPS): адрес снаружи, свой сервер не поднимаем
const SMOKE_BASE_URL = process.env.E2E_BASE_URL || undefined;
const BASE_URL = SMOKE_BASE_URL ?? DEV_BASE_URL;

export default defineConfig({
	testDir: './tests/e2e',
	// Против прода — только smoke: dev-спеки лезут в БД и меняют конфиг агента
	testMatch: SMOKE_BASE_URL ? 'prod-smoke.spec.ts' : undefined,
	fullyParallel: true,
	// Тесты меняют один общий активный прогон симулятора — файлы не должны идти параллельно
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: 'list',
	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
		// Prod-стек за локальным Traefik отдаёт самоподписанный сертификат
		ignoreHTTPSErrors: !!SMOKE_BASE_URL,
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: SMOKE_BASE_URL
		? undefined
		: {
				command: 'npm run dev',
				url: BASE_URL,
				reuseExistingServer: !process.env.CI,
				// Движок llm в e2e — fake-модель: без сети и расходов, детерминированно. Уже запущенный сервер
				// (reuseExistingServer) этот env не получает — tests/e2e/llm.spec.ts это проверяет.
				env: { LLM_CLIENT: 'fake' },
			},
});
