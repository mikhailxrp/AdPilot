# Development Log

Короткая запись в конце каждой сессии. Новые записи — сверху.

---

## 2026-10-12 (Phase 1, таск 3)

**Сделано:** Phase 1, таск 3 «Ядро симулятора (чистые функции)» ✅. `lib/simulator/rng.ts` — `createRng` (mulberry32), `hashSeed` (FNV-1a), `deriveTickSeed(runSeed, tick, campaignKey)`; `lib/simulator/model.ts` — `simulateTick` (пауза/нет денег → показы с шумом ±10 % → клики → обрезка бюджетом → заказы → расход), `expectedImpressions`, `effectiveCr`, `dayStartTick`, `TICKS_PER_DAY = 24`; `lib/simulator/presets.ts` — 4 кампании `good`/`bad`/`new`/`moody` (капризная портится с тика 15). Тесты: `rng.test.ts`, `model.test.ts`, `presets.test.ts`. `type-check`/`lint`/`test` (55 тестов)/`build` зелёные; e2e не запускался — UI нет.

**Дальше:** Phase 1, таск 4 «Сервис симулятора + страница `/simulator`» (`lib/simulator/service.ts`, `lib/validations/simulator.ts`, `actions/simulator.ts`, страница с таблицей и `SimulatorControls`).

**Заметки:**

- Seed тика выводится из ключа пресета (`campaignKey`), а не из `cuid`: после сброса id новые, цифры при том же seed должны совпасть. В схеме БД поля с ключом нет — сервис таска 4 сопоставляет кампанию с пресетом по `name`.
- Тики нумеруются с 1 (`currentTick = 0` — ничего не было). `spentToday` сервис считает суммой `cost` из `TickStats` с `dayStartTick(tick)` по `tick - 1`.
- Модель сама обрабатывает `SUSPENDED`, `bid ≤ 0` и остаток бюджета меньше ставки (тик из нулей) — в сервисе отдельной ветки не нужно.
- Клик стоит ровно `bid` (аукционной скидки нет). При обрезке бюджетом показы уменьшаются пропорционально кликам.
- «Ставка выше → показов не меньше» гарантировано только при запасе бюджета: шум — первое число генератора, но бюджет может срезать показы.
- Тест «капризной»: до порога всего 14 тиков, поэтому сравниваются тики 14 и 15 на 200 seed, а не 200 тиков до/после.

---

## 2026-10-12 (Phase 1, таск 2)

**Сделано:** Phase 1, таск 2 «Расчёт метрик» ✅. `lib/metrics/metrics.ts` — `cpc`, `cpm`, `ctr`, `cr`, `cpo`, `computeMetrics` (копейки и доли, без округления, деление на ноль → `null`); `lib/metrics/format.ts` — `formatRub`, `formatPercent`, `NO_DATA` («нет данных») через `Intl.NumberFormat('ru-RU')`. Тесты: `metrics.test.ts` (ручной пример, нулевые показы/клики/заказы, всё по нулям, дробный CPC), `format.test.ts` (`null`, копейки → рубли, доля → проценты, `0` ≠ «нет данных»). `type-check`/`lint`/`test` (24 теста)/`build` зелёные; e2e не запускался — UI нет.

**Дальше:** Phase 1, таск 3 «Ядро симулятора (чистые функции)» (`lib/simulator/rng.ts`, `presets.ts`, `model.ts` + тесты).

**Заметки:**

- Расход без заказов → CPO = `null`, а не «бесконечность»: сигнал «тратит без заказов» движок Phase 2 берёт из сырых `cost > 0 && orders === 0`.
- Метрики за период считать по суммам `TickStats` (сначала сложить, потом делить), а не усреднять по тикам — в таске 4.
- `Intl` для ru-RU ставит неразрывные пробелы (U+00A0) между разрядами и перед `₽`/`%` — учитывать в e2e при сравнении текста.

---

## 2026-10-12 (Phase 1, таск 1)

**Сделано:** спланирована Phase 1 «Мок и метрики» (`phase-1.md`, 6 тасков; в `_status.md` фаза 🔄). Phase 1, таск 1 «Схема симулятора + сверка с API Директа» ✅. В `prisma/schema.prisma` — enum-ы `RunStatus`, `CampaignState`, модели `SimulationRun`, `Campaign`, `CampaignTruth` (1:1), `TickStats` с уникальным `(campaignId, tick)` и каскадным удалением; миграция `20261012101104_simulator`. `.docs/database.md` и раздел «Мок Директа» в `.docs/prd.md` обновлены (таблица соответствия мока и Директа v5, отличия мока, допущение снято). В живой БД проверены уникальный индекс и каскад (в транзакции с откатом). `type-check`/`lint`/`test`/`build` и `test:e2e` (4 теста) зелёные.

**Дальше:** Phase 1, таск 2 «Расчёт метрик» (`lib/metrics/metrics.ts` + тесты, `lib/metrics/format.ts`; деление на ноль → `null`, «нет данных»).

**Заметки:**

- Решения фазы: доступ к API мока — Bearer `MOCK_API_TOKEN`; 1 тик = 1 час, 24 тика = сутки; сброс архивирует прогон (`ARCHIVED`), а не удаляет; деньги — `Int` копейки; генератор инициализируется от (seed, тик, кампания).
- Директ v5 (сверено через Context7): `POST /json/v5/{service}` с `{ method, params }`, деньги в микроединицах (× 1 000 000). Копейки → микро = × 10 000, перевод в DTO мока (таск 5).
- Отличия мока: отчёты синхронные JSON (в Директе асинхронный TSV), `Id` — строка cuid, состояния только `ON`/`SUSPENDED`.
- «Только один `ACTIVE`-прогон» в БД не закреплён индексом — обеспечит сервис в транзакции (таск 4).
- `@map` на значениях enum в Prisma 7 меняет их рантайм-значения — не используем, только `@@map` на имени enum.
- `TASK.md`, `.docs/prd.md`, `.docs/database.md` в `.gitignore` — правки документации в Git не попадают.

---

## 2026-10-12 (таск 5, конец Phase 0)

**Сделано:** Phase 0, таск 5 «Docker Compose (web + db) + e2e» ✅ — **Phase 0 «Фундамент» завершена**. `Dockerfile` (multi-stage: deps → builder → runner, `output: 'standalone'`, пользователь не root), `.dockerignore`, в `docker-compose.yml` сервисы `migrate` (одноразовый: `prisma migrate deploy` + seed из стадии `builder`) и `web` (стартует после успешного `migrate`), `AUTH_TRUST_HOST` и `AUTH_URL` в Compose и `.env.example`, раздел «Запуск» в README, `tests/e2e/auth.spec.ts` (гость → `/login`, неверный пароль, вход, выход). Проверено на чистом томе: `docker compose up --build` поднимает всё без ручных шагов, повторный запуск не дублирует админа, в образе нет `.env`. `type-check`/`lint`/`test`/`build` и `test:e2e` (4 теста) зелёные.

**Дальше:** Phase 1 «Мок и метрики» — спланировать `phase-1.md` (схема БД, симулятор с seed, тестовые кампании, расчёт CPC/CPM/CTR/CR/CPO с тестами, `/simulator`).

**Заметки:**

- `package-lock.json` был собран на Windows без `@emnapi/*` — `npm ci` в Linux-образе падал; lock пересобран в Linux-контейнере (только дополнен, версии те же).
- В standalone-режиме URL строится из `HOSTNAME=0.0.0.0`: без `AUTH_URL` гость редиректился на `http://0.0.0.0:3000/login`. На VPS `AUTH_URL` — свой домен.
- `migrate` собирается из стадии `builder`: в standalone-образе нет Prisma CLI и `tsx`.
- В `playwright.config.ts` порт берётся из `E2E_PORT` (по умолчанию 3000); `.env` подгружается через `dotenv/config`, учётка админа в тестах — `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- В e2e пароль ищется через `getByLabel('Пароль', { exact: true })`: иначе совпадает ещё и кнопка «показать пароль».
- `npm audit` (5 high) по-прежнему не разбирали.

---

## 2026-10-12 (сессия 3)

**Сделано:** Phase 0, таск 3 «Auth.js + seed админа + proxy» ✅. `lib/auth.ts` (Auth.js v5, Credentials, JWT, callbacks `authorized` и `session`), `app/api/auth/[...nextauth]/route.ts`, `lib/access.ts` (`requireAdmin()`), `proxy.ts` с `matcher`, `lib/validations/auth.ts` + тесты (4 шт.), `prisma/seed.ts` (`bcryptjs`, upsert) и seed в `prisma.config.ts`, `.docs/database.md` обновлён. Вручную проверено: гость → редирект на `/login`, верный пароль даёт сессию с `id`, неверный — `CredentialsSignin`, seed не дублирует админа. `type-check`/`lint`/`test`/`build` зелёные.

**Дальше:** Phase 0, таск 4 «Страница входа и защищённая зона» (`/login`, `LoginForm`, `app/(app)/layout.tsx` с `requireAdmin()` и выходом, заглушка `/dashboard`, редирект с `/`).

**Заметки:**

- `next-auth` закреплён точно на `5.0.0-beta.32` (на npm `latest` = v4, v5 только в `beta`).
- `zod` не был в `package.json` (приходил транзитивно) — добавлен явно.
- В v5 без `session`-callback в сессии нет `user.id` → `requireAdmin()` всегда редиректил бы; callback кладёт `token.sub` в `session.user.id`. `types/next-auth.d.ts` не понадобился.
- `requireAdmin()` отдельным тестом не покрыт, проверится e2e в таске 5; страницы с ним появятся в таске 4.
- `/login` пока даёт 404 (страницы нет до таска 4) — так задумано.
- Тесты шли на временных значениях `AUTH_SECRET`/`ADMIN_*` из командной строки; затем seed запущен на значениях из `.env`.

---

## 2026-10-12 (сессия 2)

**Сделано:** Phase 0, таск 2 «PostgreSQL + Prisma 7» ✅. Сервис `db` в `docker-compose.yml` (postgres:17-alpine, healthcheck, volume, хост-порт 5434), схема `User`, миграция `init`, `prisma.config.ts`, `lib/db.ts` (singleton + `@prisma/adapter-pg`), `.env.example`, `postinstall: prisma generate`, `.docs/database.md` обновлён. Данные переживают перезапуск контейнера, `lib/db.ts` проверен реальным запросом, `type-check`/`lint`/`test`/`build` зелёные.

**Дальше:** Phase 0, таск 3 «Auth.js + seed админа + proxy» (`lib/auth.ts`, `lib/access.ts`, `proxy.ts`, `prisma/seed.ts`, Zod-схема входа, `bcryptjs`, `tsx`).

**Заметки:**

- Prisma закреплена на `^7.10.0`: на npm `latest` = `8.0.0-rc` с другим форматом конфига.
- Секреты в одном `.env` (его читают Compose, `dotenv/config` и Next.js), `.env.local` не используем — PRD важнее CLAUDE.md.
- Postgres на хосте — порт 5434 (`DATABASE_URL=...@localhost:5434/...`), внутри сети Compose будет `db:5432` (таск 5).
- Unit-тестов нет осознанно: своей логики нет, вход в БД проверит e2e в таске 5. `lib/db.ts` проверен одноразовым временным тестом (удалён).
- Имя БД в `.env` с заглавными (`AdPilot`) — работает, но Postgres чувствителен к регистру.
- Seed в `prisma.config.ts` добавится в таске 3.

---

## 2026-10-12

**Сделано:** Phase 0, таск 1 «Инструменты и UI-база» ✅. Спланирована Phase 0 (`phase-0.md`, 5 тасков). Подключены Vitest (jsdom) и Playwright (Chromium, `webServer`), скрипты `type-check`/`test`/`test:watch`/`test:e2e`, `shadcn init`, smoke-тесты (`cn()` и главная страница). `type-check`, `lint`, `test`, `build`, `test:e2e` — зелёные.

**Дальше:** Phase 0, таск 2 «PostgreSQL + Prisma 7» (Docker `db`, схема `User`, `lib/db.ts`, миграция `init`).

**Заметки:**

- `@types/node` поднят `^20` → `^24`: Vitest 5 не ставился с `^20` (peer dependency), Node у нас 24.
- `vite-tsconfig-paths` не нужен: Vite 8 умеет алиасы сам (`resolve.tsconfigPaths: true`).
- `shadcn init` создал `components/ui/button.tsx` — удалён как вне scope (вернём в таске 4). Зависимости `@base-ui/react`, `class-variance-authority` остались.
- `cn()` теперь из официального пакета `cn` (`shadcn-ui/cn`), а не `clsx` + `tailwind-merge`.
- Tailwind подключён через `@tailwindcss/turbopack`, `postcss.config.mjs` shadcn не потребовал.
- `npm audit` показывает 5 high-уязвимостей — не разбирали, вернуться отдельно.
