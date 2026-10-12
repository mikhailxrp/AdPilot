# Development Log

Короткая запись в конце каждой сессии. Новые записи — сверху.

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
