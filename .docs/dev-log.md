# Development Log

Короткая запись в конце каждой сессии. Новые записи — сверху.

---

## 2026-10-12 (Phase 1, таск 6 — фаза закрыта)

**Сделано:** Phase 1, таск 6 «Seed прогона, навигация, e2e фазы» ✅, **Phase 1 «Мок и метрики» завершена**. `prisma/seed.ts` после админа создаёт активный прогон (seed 42, 4 пресета) через `createRun`, если `ACTIVE`-прогона нет; повторный запуск ничего не добавляет. `components/layouts/AdminNav.tsx` (Client, `usePathname`, `aria-current`) + тест, подключён в `app/(app)/layout.tsx`. В `tests/e2e/simulator.spec.ts`: переход по ссылке из шапки, API без/с неверным токеном → 401, с токеном — 4 кампании и `reports.get` без скрытых полей. `.docs/database.md` — раздел про seed. `type-check`/`lint`/`test` (121)/`build`/`test:e2e` (10, включая Phase 0) зелёные. Вручную: seed дважды — прогон один; после архивации прогона seed создаёт новый (seed 42, 4 кампании, тик 0).

**Дальше:** Phase 2 «Агент на правилах и журнал» — спланировать (`phase-2.md`): worker-контейнер, `AdsProvider` + `MockProvider`, движок `rules`, guardrails, журнал решений, `/journal`.

**Заметки:**

- `docker-compose.yml` не менялся: у `web` уже `env_file: .env`, `MOCK_API_TOKEN` попадает туда сам; `migrate` уже запускает `prisma db seed`.
- В e2e API-тесты читающие (`campaigns.get`, `reports.get`); мутирующие методы (`add`, `bids.set`) не включены, чтобы не плодить кампании в общем прогоне.
- Не проверено: шапка на 375px и консоль браузера без ошибок (пункты DoD руками); 409 и нулевой расход приостановленной кампании на следующем тике (долги таска 5) — см. DoD таска 5.
- API-тесты e2e берут `MOCK_API_TOKEN` из `.env`; без него `beforeAll` падает с понятной ошибкой.
- `TASK.md`, `.docs/phases/` и `.docs/database.md` в `.gitignore`, в коммит не попадают.

---

## 2026-10-12 (Phase 1, таск 5)

**Сделано:** Phase 1, таск 5 «Эндпоинты мока Директа» ✅. Route Handlers `app/api/mock/direct/json/v5/{campaigns,bids,reports}/route.ts` (`POST { method, params }`: `add`/`get`/`update`/`suspend`/`resume`, `bids.set`, `reports.get`); `lib/mock/auth.ts` (Bearer `MOCK_API_TOKEN`, сравнение хешей через `timingSafeEqual`, пустой токен → 401), `dto.ts` (копейки → микроединицы, ответы только из явных полей, формат ошибки Директа), `service.ts` (Prisma, `MockApiError` 400/404/409), `handler.ts` (общий каркас: токен → JSON → Zod → выполнение → `revalidatePath('/simulator')`); `lib/validations/mock.ts` (суммы в микроединицах, кратные 10 000). `MOCK_API_TOKEN` в `.env.example` и PRD, там же таблица запросов/ответов. Тесты: `mock.test.ts`, `auth.test.ts`, `dto.test.ts` (в т.ч. «скрытых полей в ответе нет»). `type-check`/`lint`/`test` (119)/`build` зелёные. Вручную через curl: 401 (нет/неверный токен), 400, 404, цепочка add → bids.set → update → suspend → get → resume, `reports.get` без скрытых полей.

**Дальше:** Phase 1, таск 6 «Seed прогона, навигация, e2e фазы» (`prisma/seed.ts`, ссылка на `/simulator` в шапке, `MOCK_API_TOKEN` в `docker-compose.yml`, e2e фазы с проверкой API: 401 без токена, статистика с токеном).

**Заметки:**

- Не проверено вживую: 409 (нет активного прогона), нулевой расход приостановленной кампании на следующем тике (покрыто тестами модели таска 4), видимость изменений на `/simulator`, пункты `dod-global.md`. Эти галочки в DoD таска оставлены пустыми.
- Проверка «дубликат названия → 400» в `service.ts` вживую не подтверждена: curl на Windows исказил кириллицу в теле. Повторять через `--data-binary @file.json` (UTF-8).
- В dev-прогон при проверке попали 2 тестовые кампании с искажёнными именами (в т.ч. «Тест API»); уйдут в архив при сбросе на `/simulator`.
- Новая кампания через `campaigns.add` получает скрытые параметры пресета «новая»; клиент их задать не может. Названия кампаний в прогоне уникальны (иначе совпал бы поток случайных чисел).
- В коде Директа `error_code` числовой; в моке он равен HTTP-статусу.
- Ответы мока (`Id`, `Name`…) — PascalCase, как в Директе; в БД и коде — camelCase, конвертация только в `dto.ts` и схемах.

---

## 2026-10-12 (Phase 1, таск 4)

**Сделано:** Phase 1, таск 4 «Сервис симулятора + страница `/simulator`» ✅. `lib/simulator/service.ts` — `createRun`, `resetRun` (старый `ACTIVE` → `ARCHIVED`, Serializable), `runTick` (тик занимается через `updateMany where currentTick`, `spentToday` из `TickStats`); `lib/simulator/stats.ts` (`sumTickStats`, `spentToday`) и `queries.ts` (`getActiveRunView` без `CampaignTruth`); `lib/validations/simulator.ts` (`resetSchema`, `SEED_MAX`); `actions/simulator.ts` (`tickAction`, `resetAction`, `requireAdmin()` в каждом); страница `/simulator` с `loading.tsx`/`error.tsx`, `SimulatorView`, `CampaignsTable`, `SimulatorControls`; shadcn `table`. Тесты: `simulator.test.ts`, `stats.test.ts`, `tests/e2e/simulator.spec.ts` (гость, сброс + 3 тика + воспроизводимость, невалидный seed). `type-check`/`lint`/`test` (72)/`build`/`test:e2e` (7) зелёные.

**Дальше:** Phase 1, таск 5 «Эндпоинты мока Директа» (`app/api/mock/direct/…`, `lib/mock/auth.ts`, `dto.ts`, `lib/validations/mock.ts`, `MOCK_API_TOKEN`).

**Заметки:**

- После новой миграции нужен `npx prisma generate` **и перезапуск `next dev`**: singleton Prisma в `globalThis` держит старый клиент, и на странице падает `Cannot read properties of undefined (reading 'findFirst')`.
- `resetSchema` принимает `string | number` (форма вводит строку); `z.coerce` не использован: пустая строка превращалась бы в 0.
- Страница без собственного `Suspense`: границей служит `loading.tsx`; `next build` проходит.
- В e2e таблицы сравниваются через `textContent` (не `innerText` — `toHaveText` сравнивает `textContent`). Тесты симулятора `serial`: меняют общий активный прогон.
- Ссылки на `/simulator` в шапке пока нет — таск 6.

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
