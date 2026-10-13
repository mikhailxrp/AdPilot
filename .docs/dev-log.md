# Development Log

Короткая запись в конце каждой сессии. Новые записи — сверху.

---

## 2026-10-13 (Phase 5, таск 6 — фаза закрыта)

**Сделано:** Phase 5, таск 6 «README по развёртыванию и документация фазы» ✅. **Phase 5 «VPS» завершена.**

- `README.md`: раздел «Развёртывание на VPS» — требования (Docker, 2 ГБ RAM или своп, A-запись, работающий Traefik), где взять `TRAEFIK_*`, заполнение `.env`, первый запуск и обновление, логи и `/api/health`, бэкап (`ls`, `backup.sh`, `restore-check.sh`, дампы root/600, вынос за пределы сервера), восстановление (страховочный дамп → `stop web worker` → `restore.sh` → `up -d`), smoke против домена с предупреждением о смене данных, локальная проверка через `traefik-local`, известные ограничения. «Технологии» дополнены `backup` и Traefik.
- `.docs/prd.md`: «Деплой», «Отличия от стека» (Traefik вместо своего proxy, три compose-файла, shell в `ops/`), «Роли и доступ» (`/api/health`, мок снаружи 404), требование 9 (все пункты `[x]`), переменные окружения, роадмап Phase 5. `_status.md` и `phase-5.md` — ✅.
- Тесты: Vitest и новые e2e не требуются (документация). `type-check`, `lint`, `test` (554), `build` зелёные.
- **E2E фазы пройден локально** (prod-стек за `traefik-local`, `DOMAIN=localhost`, `LLM_CLIENT=fake`, отдельный проект `-p adpilot-check` со свежей БД, таймер выключен): `test:smoke` — 5 из 5; `/api/health` 200; сервис `backup` сам снял первый дамп, `backup.sh` вручную — второй; `restore-check.sh` — exit 0, временной БД после проверки нет; `restore.sh` отказывает при запущенных web и worker, после `stop web worker` возвращает удалённую запись `decisions` (11 → 12), `up -d` перезапускает `migrate` (миграции и seed идут при каждом `up`); порты web и db prod-стека на хосте не опубликованы (`localhost:3000` не отвечает). После проверки стек, volume и Traefik удалены; `npm run test:e2e` на dev-стеке — 38 passed, 5 skipped (smoke).

**Итог фазы:** одна команда `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` поднимает web, worker, db, migrate и backup; панель отдаётся Traefik-ом по HTTPS на `DOMAIN`, мок и БД снаружи закрыты, `.env` проверяется до миграций, бэкапы идут по таймеру, восстановление проверяется скриптом. Деплой на реальный VPS админ делает сам по README — на реальном сервере он не проверялся (в том числе версия Traefik и выпуск сертификата Let's Encrypt).

**Риски и долги (в Phase 5 не закрывались):**

- **Нет ограничения попыток входа** на публичном домене: `/login` можно перебирать, защита — только длинный `ADMIN_PASSWORD`. В README — совет про `ratelimit` / `ipallowlist` в Traefik.
- Публичный `/api/health` не ограничен по частоте (лёгкий `SELECT 1`, при сбое пишет стек в лог).
- `worker` ждёт `web` по `service_started`, а не `service_healthy`.
- `check-env` не проверяет `YANDEX_API_KEY` / `YANDEX_FOLDER_ID` / `ADMIN_EMAIL` на заглушки и не сверяет хост в `AUTH_URL` с `DOMAIN`.
- Страховочный дамп перед `restore.sh` не делается автоматически — в README это ручной шаг.
- Автоматической отправки бэкапов за пределы сервера нет — только инструкция `rsync`.
- `npm audit` (5 high) по-прежнему не разбирали.

**Дальше:** Phase 6 «Песочница Директа» (опционально) — `DirectSandboxProvider`, dry-run по умолчанию включён; либо выкладка на реальный VPS по README.

**Заметки:**

- Проверочный prod-стек поднимался без правок `.env`: отдельный проект `-p adpilot-check` (свой volume), второй `--env-file` с `DOMAIN` / `TRAEFIK_*` / `AUTH_URL` и override-файл с `env_file: LLM_CLIENT=fake`. Этот приём описан в README (локальная проверка).
- Шелл-скрипты запускались как `sh /ops/…` через `docker compose exec -T`, в Git Bash — с `MSYS_NO_PATHCONV=1` (в README на это есть заметка).
- Проверочные дампы удалены из `./backups`, оставлен дамп из таска 5. Dev-контейнеры `web` / `worker` как были остановлены до проверки, так и остались; dev-`db` работает.

---

## 2026-10-13 (Phase 5, таск 5)

**Сделано:** Phase 5, таск 5 «Smoke e2e против prod-стека» ✅.

- `tests/e2e/prod-smoke.spec.ts` (5 тестов, serial, без доступа к БД): гость на `/dashboard` → `/login`; админ из `ADMIN_EMAIL` / `ADMIN_PASSWORD` — сброс с seed 42, три «Один тик» без «агент не отработал», в `/journal` есть записи, на `/dashboard` «Расход» не `0,00 ₽`; `/api/health` — 200 `{status:'ok'}` без редиректа; `POST /api/mock/...` без токена — **404, а не 401** (значит, отсёк роутер Traefik, а не приложение); `http://` → редирект на `https://`. Без `E2E_BASE_URL` спека пропускается (`test.skip`).
- `playwright.config.ts`: при заданном `E2E_BASE_URL` — `baseURL` оттуда, `ignoreHTTPSErrors`, `webServer` отключён, `testMatch` только `prod-smoke.spec.ts` (dev-спеки читают БД и меняют конфиг агента). Без переменной конфиг ведёт себя как раньше. `package.json`: `test:smoke`.
- Тесты: Vitest не требуется (TS-логики нет). `type-check`, `lint`, `test` (554), `build` зелёные.
- Вручную (prod-стек за `traefik-local`, `DOMAIN=localhost`, переменные передавались через окружение shell, `.env` не менялся): `E2E_BASE_URL=https://localhost npm run test:smoke` — 5 из 5 за 7 с; `restore-check.sh` на живом `backup` — exit 0 (дамп 4520 `decisions` / рабочая 4532: разница — 3 тика smoke после дампа); порты 3000 и 5434 на хосте закрыты. Потом prod-стек и Traefik остановлены, dev-стек поднят заново; `npm run test:e2e` — 38 passed, 5 skipped (smoke).

**Дальше:** Phase 5, таск 6 «README по развёртыванию и документация фазы» (`README.md`, `prd.md`, `_status.md`, итог фазы и риск «нет ограничения попыток входа» в `dev-log`).

**Заметки:**

- Smoke **меняет данные целевого стека**: «Сбросить» архивирует активный прогон и создаёт новый, тики идут тем движком, что выбран в `/simulator` (на VPS с LLM — платные вызовы). Конфиг агента smoke не трогает — БД ему недоступна. Предупреждение — в README (таск 6).
- Первая `up --build` prod-стека упала на `next build` внутри Docker (три образа собирались параллельно, причину не выяснили); повторная сборка прошла без ошибок. В README — требование «2 ГБ RAM или своп» и совет собрать образы по одному.
- Из Git Bash на Windows `docker compose exec backup sh /ops/…` ломается: путь `/ops` превращается в `C:/Program Files/Git/ops` — нужен `MSYS_NO_PATHCONV=1`. В README команды давать для Linux-сервера.
- Имя проекта `adpilot` у dev- и prod-стека одно, поэтому на одной машине они не живут одновременно: перед prod-проверкой dev-стек останавливается. Том `db_data` общий, поэтому данные dev-БД сохраняются при переключении.
- Dev-`web` в Docker занимает порт 3000, и `playwright` переиспользовал бы его без `LLM_CLIENT=fake` — перед `test:e2e` Docker-`web` и `worker` останавливаются.

---

## 2026-10-13 (Phase 5, таск 4)

**Сделано:** Phase 5, таск 4 «Бэкап и проверка восстановления» ✅.

- `docker-compose.prod.yml`, сервис `backup` (`postgres:17-alpine`): цикл `backup.sh` → `sleep ${BACKUP_INTERVAL_SEC:-86400}`; монтирования `./ops:/ops:ro` и `./backups:/backups`; стартует после `migrate` (`service_completed_successfully`) и `db` (`service_healthy`); без портов, вне сети `traefik`, без `env_file` — только `PGHOST` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` и `BACKUP_*`. Сбой одного дампа не останавливает цикл (пишется в лог), мусор в `BACKUP_INTERVAL_SEC` роняет контейнер, а не гонит дампы без паузы.
- `ops/backup.sh`: `pg_dump -Fc` во временный `.part` → `mv` в `adpilot-<UTC>.dump`, `umask 077` (права 600); чистка по `BACKUP_KEEP_DAYS`, **самый свежий дамп не удаляется никогда** (при `0` остаётся один); нечисловое `BACKUP_KEEP_DAYS` — exit 1.
- `ops/restore-check.sh [dump]`: `pg_restore --list` → `pg_restore --exit-on-error` во временную БД `adpilot_restore_check` → сверка счётчиков (`_prisma_migrations`, `users` равны рабочей; `agent_configs` = 1; `decisions`, `tick_stats`, `prompt_versions` не больше рабочей) → удаление временной БД в `trap EXIT`. Печатает таблицу, любой сбой — exit 1.
- `ops/restore.sh [--yes] <dump>`: отказывается, если к рабочей БД подключён кто-то ещё (подсказывает `docker compose … stop web worker`), спрашивает `yes`, затем `pg_restore --clean --if-exists --exit-on-error --single-transaction` — восстановление атомарное, при ошибке рабочая БД не меняется.
- `.gitignore` (`/backups`), `.dockerignore` (`backups` — `COPY . .` иначе утащил бы дампы в образ builder), `.gitattributes` (`*.sh text eol=lf` — при `core.autocrlf=true` на Windows `.sh` выкачались бы с CRLF и не запустились в Alpine), `.env.example` (`BACKUP_INTERVAL_SEC`, `BACKUP_KEEP_DAYS`).
- Тесты: Vitest и e2e не требуются (shell и Compose, TS-логики нет); `type-check`, `lint`, `test`, `build` зелёные. Вручную — в одноразовом контейнере Postgres с копией данных dev-БД (4520 `decisions`, 4864 `tick_stats`): `sh -n` для всех трёх скриптов; дамп с правами 600; цикл из отрендеренной команды compose даёт 3 дампа за 9 с, при остановленной БД — лог ошибки и живой цикл; чистка с `KEEP_DAYS=0` и со старыми mtime; `restore-check` — exit 0 и нет временной БД; обрезанный, пустой и несуществующий файл — exit 1; `restore.sh` отказывает при активном клиенте и без подтверждения, возвращает удалённую строку `decisions` (4519 → 4520), на обрезанном дампе падает без изменения БД.

**Дальше:** Phase 5, таск 5 «Smoke e2e против prod-стека» (`tests/e2e/prod-smoke.spec.ts`, `playwright.config.ts` с `E2E_BASE_URL`, `test:smoke`).

**Заметки:**

- Сам prod-стек за Traefik в этом таске не поднимали: имя проекта `adpilot` совпадает с dev-стеком, `up` пересоздал бы его контейнеры. Скрипты и цикл проверены в изолированном контейнере; «сервис `backup` реально снял дамп в prod-стеке» и `restore-check` на нём — в e2e фазы (таски 5–6, с отдельным `-p`, как в таске 3).
- `docker compose config` выводит `$$` вместо `$` в команде — это экранирование для повторного ввода, в контейнер уходит `$BACKUP_INTERVAL_SEC`. При эмуляции команды вручную `$$` нужно заменить на `$`.
- Скрипты запускаются как `sh /ops/x.sh`: exec-бит на bind mount с Windows не сохраняется. `printf` в busybox считает ширину в байтах — заголовок таблицы в `restore-check.sh` выровнен пробелами вручную.
- Дампы на хосте принадлежат root (контейнер `backup` работает от root) с правами 600 — читать и копировать их на VPS нужно через `sudo`; в README (таск 6).
- Образ `postgres:17-alpine` закреплён на мажоре, как у `db`: `pg_restore` новее сервера читает дамп, а `pg_dump` старее — нет; при смене версии `db` менять и `backup`.
- Страховочный дамп перед `restore.sh` не делается (вне scope): перед восстановлением на сервере стоит вручную сделать свежий дамп текущего состояния.

---

## 2026-10-13 (Phase 5, таск 3)

**Сделано:** Phase 5, таск 3 «Traefik: labels, сеть, локальный Traefik» ✅.

- `docker-compose.prod.yml`: `web` в двух сетях — внутренней `default` и внешней `traefik` (`name: ${TRAEFIK_NETWORK}`, `external: true`); `db`, `worker`, `migrate` во внешнюю не подключены. Labels: `traefik.enable`, `traefik.docker.network`, роутер `adpilot` с правилом `Host(DOMAIN) && !PathPrefix(/api/mock)`, `entrypoints=${TRAEFIK_ENTRYPOINT}`, `tls=true`, `tls.certresolver=${TRAEFIK_CERTRESOLVER:-}`, порт сервиса 3000. `DOMAIN`, `TRAEFIK_NETWORK`, `TRAEFIK_ENTRYPOINT` обязательные (`${VAR:?}`), `DOMAIN` для `web` и `migrate` — из одного якоря `x-domain`.
- `docker-compose.traefik-local.yml` (проект `traefik-local`): `traefik:v3.6` на 80/443, docker provider с `exposedbydefault=false`, редирект `web` → `websecure`, самоподписанный сертификат, dashboard выключен; создаёт сеть `${TRAEFIK_NETWORK}`, prod-стек подключается к ней как к внешней — так же, как на VPS.
- `productionEnvSchema`: поле `DOMAIN` — только имя хоста, без схемы, порта, пути и пробелов. `scripts/check-env.ts` не менялся. `.env.example`: `DOMAIN`, `TRAEFIK_NETWORK`, `TRAEFIK_ENTRYPOINT`, `TRAEFIK_CERTRESOLVER` с пояснениями и значениями для локальной проверки.
- Тесты: `production-env.test.ts` (27) — `DOMAIN` задан / пуст / со схемой / с путём / с портом / с пробелом, `localhost`, сбор всех ошибок. E2E не требуется (инфраструктура), сквозной сценарий — таск 5. `type-check`, `lint`, `test` (554), `build` зелёные.
- Вручную (prod-стек за локальным Traefik, `DOMAIN=localhost`, отдельный проект `adpilot-check`): `check-env` проходит, `web` `healthy`; `http://` → 301 на `https://`; гость на `/dashboard` → `/login`; `/api/mock/...` снаружи — 404 (в том числе с сессией админа), из `worker` по `web:3000` — 200; все cookie Auth.js с `Secure`; вход и два «Один тик» через `https://localhost` проходят; у `web` и `db` нет опубликованных портов. `config` без `DOMAIN` / `TRAEFIK_NETWORK` / `TRAEFIK_ENTRYPOINT` падает с понятным сообщением.

**Дальше:** Phase 5, таск 4 «Бэкап и проверка восстановления» (`ops/backup.sh`, `ops/restore.sh`, `ops/restore-check.sh`, сервис `backup` в `docker-compose.prod.yml`, `/backups` в `.gitignore`, `BACKUP_*` в `.env.example`).

**Заметки:**

- Пустой `TRAEFIK_CERTRESOLVER` (label `tls.certresolver=` без значения) не ломает роутер — отдельная переменная для локального запуска не понадобилась.
- Локальный Traefik взят `v3.6`, а не `v3.4` из доки: более ранние v3 не работали с Docker 29 (минимальная версия API выросла). Версия Traefik на сервере по-прежнему допущение — правило с `!PathPrefix` работает и в v2, и в v3.
- Имя entrypoint в `docker-compose.traefik-local.yml` зашито (`websecure`) — в локальном `.env` `TRAEFIK_ENTRYPOINT` должен совпадать. Порядок: сначала `traefik-local`, потом prod-стек (сеть внешняя и должна существовать).
- Prod-стек локально проверялся без правок `.env`: отдельный проект (`-p adpilot-check`, свой volume), второй `--env-file` и override с дополнительным `env_file` для `migrate` / `web` / `worker` со «взрослыми» секретами. Dev-стек (порты 3000 / 5434, volume `adpilot_db_data`) не затронут. Этот приём можно перенести в README (таск 6).
- Хост в `AUTH_URL` и `DOMAIN` между собой не сверяются — осознанно вне scope, разное значение даёт неверные редиректы Auth.js; кандидат на отдельное правило схемы.
- В моём `.env` пока нет `DOMAIN` и `TRAEFIK_*` — для dev не нужны, для запуска prod-файла нужно добавить.
- Таймер worker-а в проверке не включали: мок из `worker` проверен прямым запросом к `web:3000`, ручной «Один тик» — через Traefik.

---

## 2026-10-13 (Phase 5, таск 2)

**Сделано:** Phase 5, таск 2 «Healthcheck и проверка env» ✅.

- `GET /api/health` (`app/api/health/route.ts`, `lib/health.ts`): `SELECT 1` к БД, 200 `{"status":"ok"}` / 503 `{"status":"error"}`, `Cache-Control: no-store`, таймаут пинга 3 с, подробности ошибки — только в `console.error`. Явный `await connection()` (при `cacheComponents` GET-хендлер без runtime-данных мог бы отрендериться при сборке и застыть на «ok»); БД импортируется внутри пинга — без `DATABASE_URL` ответ 503, а не 500.
- `healthcheck` у `web` в базовом `docker-compose.yml` (`wget` на `127.0.0.1:3000/api/health`): `web` показывается как `healthy`, в том числе в dev.
- `lib/validations/production-env.ts` + `scripts/check-env.ts`: `AUTH_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD`, `MOCK_API_TOKEN` не пустые и не содержат `change-me`; `AUTH_SECRET` ≥ 32 символов; `AUTH_URL` — URL с `https://`. Скрипт печатает все проблемы списком, значений секретов — никогда.
- `docker-compose.prod.yml`: `migrate` запускает `check-env` → `migrate deploy` → `db seed`; плохой `.env` → `migrate` падает, `web` и `worker` не стартуют. `AUTH_URL` для `web` и `migrate` — из одного YAML-якоря `x-auth-url`.
- Тесты: `lib/health.test.ts`, `lib/validations/production-env.test.ts`, `tests/e2e/health.spec.ts`. Вручную: 503 при остановленной `db` (тело без деталей), prod-`migrate` падает на `http://` в `AUTH_URL`, коротком `AUTH_SECRET`, `change-me`, пустом секрете; валидный набор проходит, миграции и seed идемпотентны. `type-check`, `lint`, `test`, `build`, `test:e2e` (38) зелёные.

**Дальше:** Phase 5, таск 3 «Traefik: labels, сеть, локальный Traefik» (`DOMAIN`, `TRAEFIK_*`, роутер без `/api/mock`, `docker-compose.traefik-local.yml`; в `productionEnvSchema` добавить `DOMAIN`).

**Заметки:**

- `migrate` читал `AUTH_URL` только из `env_file`, а `web` — из подстановки Compose: значение, переданное через shell, `check-env` не видел. Теперь `AUTH_URL` для обоих идёт из `x-auth-url`.
- Проверка `DOMAIN` перенесена в таск 3: переменной нет в Compose и `.env.example` до него, иначе prod-стек сломался бы между тасками.
- Команда `migrate` в prod-файле повторяет базовую с `check-env` в начале (Compose заменяет `command` целиком) — шаги нужно менять в обоих файлах, в базовом оставлен комментарий.
- По ревью оставлено осознанно: проверка секретов не ловит остальные `change-me` (`YANDEX_API_KEY`, `YANDEX_FOLDER_ID`, `ADMIN_EMAIL`) и слабые, но «настоящие» пароли — вне списка фазы; `worker` по-прежнему ждёт `web` по `service_started`, а не `service_healthy` — вне scope таска, можно поднять отдельно; публичный `/api/health` не ограничен по частоте (один лёгкий `SELECT 1`, при сбое пишет стек в лог) — риск рядом с «нет ограничения попыток входа».
- Перед `test:e2e` остановлены `web` и `worker` (порт 3000); после прогона подняты обратно.

---

## 2026-10-13 (Phase 5, таск 1)

**Сделано:** Phase 5, таск 1 «Прод-Compose: base / override / prod» ✅.

- `docker-compose.yml`: `name: adpilot`, у `web` и `db` убраны `ports` — в базовом файле портов нет.
- `docker-compose.override.yml` (новый): `3000:3000` и `5434:5432`, подхватывается автоматически — `docker compose up` для разработки работает как раньше.
- `docker-compose.prod.yml` (новый): ротация логов `json-file` (10 МБ × 3) у `migrate`, `web`, `worker`, `db` через один `x-logging`; `AUTH_URL: ${AUTH_URL:?…}` у `web`. Запуск на VPS — с явными `-f`, override не подхватывается.
- `.dockerignore`: `docker-compose*.yml`; `.env.example`: раздел «Прод (VPS)».
- Проверено: prod-`config` без портов и с `logging`; без `AUTH_URL` падает с понятным текстом; `docker compose up --build` собрал образы, данные БД (volume `adpilot_db_data`) на месте; `type-check`, `lint`, `test` (523), `build`, `test:e2e` (37) зелёные.

**Дальше:** Phase 5, таск 2 «Healthcheck и проверка env» (`/api/health`, `lib/validations/production-env.ts`, `scripts/check-env.ts`, `healthcheck` у web).

**Заметки:**

- `npm ci` в Docker падал: `package-lock.json` без `@emnapi/core` и `@emnapi/runtime` — локальный npm 11.6 считал lock целым, npm 11.19 из `node:24-alpine` — нет. Lock пересобран через `npm install --package-lock-only` внутри `node:24-alpine`; `package.json` не менялся. Вне scope таска, но без этого образы не собирались.
- Порты нельзя «убрать в prod»: Compose при слиянии файлов `ports` только добавляет — поэтому порты вынесены в override.
- Перед `test:e2e` остановлены контейнеры `web` и `worker` (порт 3000), иначе Playwright переиспользует сервер без `LLM_CLIENT=fake`; после прогона подняты обратно.
- Локальный npm (11.6) и npm в образе (11.19) расходятся — при странных ошибках `npm ci` в Docker сначала сверять версии.

---

## 2026-10-13 (Phase 4, таск 8)

**Сделано:** Phase 4, таск 8 «E2E фазы и документация» ✅ — Phase 4 завершена.

- `panel.spec.ts`: сквозной сценарий — сброс seed 42 → 20 тиков → `/dashboard` (итоги без «нет данных», последнее решение с тиком 20) → `/campaigns` → «Плохая» → три графика и журнал только этой кампании.
- `settings.spec.ts`: новая группа с `resetAgentConfig()` перед каждым тестом и в `afterAll`. (1) dry-run: тики идут, пока в журнале не появится запись с изменением и бейджем «dry-run», ставки на `/campaigns` до и после совпадают. (2) «Проверить модель» → «Модель доступна (N мс)». (3) маркер в промпте + `llm` → тик → версия в журнале с маркером; «Вернуть по умолчанию» → тик → другой отпечаток, без маркера.
- Документация: требование 7 в `prd.md` отмечено, `phase-4.md` и `_status.md` — Phase 4 ✅.

**Дальше:** Phase 5 «VPS» (продовый Compose, HTTPS, backup БД, README по развёртыванию); при желании — `phase-4-report.md`.

**Заметки:**

- Перед `test:e2e` остановлен чужой dev-сервер на :3000 (без `LLM_CLIENT=fake`); Playwright поднял свой.
- Маркер промпта — константа, поэтому повторные прогоны не плодят строки в `prompt_versions`.
- В хелпере `readBids` нужно дождаться строк таблицы до `allTextContents()` — он не ждёт сам.

---

## 2026-10-13 (Phase 4, таск 7)

**Сделано:** Phase 4, таск 7 «LLM в `/settings`: модель, проверка, температура, промпт; версия в `/journal`» ✅.

- `lib/validations/llm-settings.ts`: схема формы LLM поверх строк — URI `gpt://<каталог>/<модель>[/версия]`, температура 0–1 (запятая или точка), промпт не пустой и ≤ `LLM_PROMPT_MAX_LENGTH` (20 000). Пустые URI и температура → `null`; текст, равный встроенному промпту, → `null` (хранится «встроенный», а не его копия, поэтому правка `LLM_SYSTEM_PROMPT` в коде по-прежнему даёт новую версию). `checkModelSchema` — URI и температура без промпта.
- `lib/llm/check-model.ts`: один короткий запрос без JSON-схемы → `{ ok, ms }` или `{ ok: false, code, message, ms }`; неизвестная ошибка → `code: 'unknown'`.
- `lib/agent/config.ts`: `updateLlmSettings` (пишет только три поля LLM) и `resetLlmSystemPrompt` (промпт → `null`). `actions/settings.ts`: `updateLlmSettingsAction`, `resetPromptAction`, `checkModelAction` — Zod → `requireAdmin` → операция; проверка модели ничего не пишет ни в конфиг, ни в журнал, без ключей Yandex возвращает понятное сообщение.
- `LlmSettingsForm` (Client Component, вторая форма на `/settings` со своим «Сохранить», shadcn `textarea` добавлен): «Проверить модель» идёт по значениям формы до сохранения, «Вернуть по умолчанию» сразу пишет `null`, у промпта предупреждение про `npm run eval:llm`.
- Журнал: `promptVersion { id, sha256, text, createdAt }` в `JOURNAL_ROW_SELECT`; в `JournalTable` — «Версия промпта <sha256[:8]> · дата» и `<details>` с текстом (и `/journal`, и `/campaigns/[id]`). У `rules` и старых записей блока нет.
- Тесты: `llm-settings.test.ts`, `check-model.test.ts`, `LlmSettingsForm.test.tsx`, `JournalTable.test.tsx` (+2). `type-check`/`lint`/`test` (523)/`build` зелёные; `settings.spec.ts` 4/4.
- Миграции нет: поля добавлены в таске 6. `.docs/database.md` обновлён.

**Дальше:** Phase 4, таск 8 «E2E фазы и документация».

**Заметки:**

- На странице две формы с кнопкой «Сохранить»: в `settings.spec.ts` кнопка ищется внутри формы с полем шага (`saveAgentForm`). В `llm.spec.ts` селектор ответа модели сужен до `details` «Ответ модели» — в строке появился второй `<pre>` с текстом промпта.
- `llm.spec.ts` (тест на seed 42, 25 тиков) снова упал по той же причине, что в тасках 5–6: Playwright переиспользовал dev-сервер без `LLM_CLIENT=fake`. После правки селектора повторно не гонялся — перед `test:e2e` останавливать свой dev-сервер.
- Текст версии промпта выбирается в каждую строку журнала (страница — до `JOURNAL_PAGE_SIZE` строк); если страница станет тяжёлой — ленивая подгрузка по клику.
- Сквозной сценарий «правка промпта → тик → новая версия → сброс → другая версия» и «Проверить модель» на `fake` — таск 8.
- Не проверено руками на dev-БД: что сохранение одной формы не затрагивает поля другой (покрыто только раздельной записью в `updateLlmSettings` / `updateAgentConfig`).

---

## 2026-10-13 (Phase 4, таск 6)

**Сделано:** Phase 4, таск 6 «Промпт и параметры LLM в БД, версия в `Decision`» ✅.

- Миграция `20261013085546_prompt_versions`: таблица `prompt_versions` (`text`, `sha256 @unique`, только дополняется); в `AgentConfig` — `llmSystemPrompt`, `llmModelUri`, `llmTemperature` (все nullable); в `Decision` — `promptVersionId` (FK, `RESTRICT`). Старые записи не тронуты.
- `agentConfigSchema` = `agentConfigBaseSchema` (поля формы `/settings`) + три поля LLM (`null` по умолчанию, температура 0–1, пустой промпт отклоняется). Форма и `updateAgentConfig` работают с `AgentConfigBaseInput` — сохранение формы не затирает параметры LLM.
- `lib/agent/prompt-versions.ts` (`resolveSystemPrompt`, `promptSha256`) и `prompt-versions-db.ts` (`ensurePromptVersion` — upsert по sha256).
- Движок `llm` получает `systemPrompt` (по умолчанию встроенный) и отдаёт его полем `AgentEngine.systemPrompt`; версия считается по этому тексту. `tick.ts` делает upsert версии в `runCycle`, `cycle.ts` пишет `promptVersionId` во все решения тика; у `rules` — `null`. `TickDeps.createEngine(name)` → `createEngine(config)`.
- Модель и температура: конфиг → env → константа (`createLLMClientFromEnv(env, { modelUri, temperature })`, опция `temperature` у `YandexLLMClient`). Fake-движок тоже берёт промпт из конфига.
- Тесты: +20 (конфиг, версии, промпт, движок, клиент, цикл, `tick-core`); `type-check`/`lint`/`test` (490)/`build` зелёные. Руками на dev-БД: один текст → одна версия, другой текст → новая; у старых решений версии нет.
- `journal.spec.ts` зелёный.

**Дальше:** Phase 4, таск 7 «LLM в `/settings`: модель, проверка, температура, промпт; версия в `/journal`».

**Заметки:**

- `llm.spec.ts` не подтверждён: у запущенного dev-сервера нет `LLM_CLIENT=fake` (та же причина, что в таске 5) — тест упал и повторно не гонялся. Сквозной путь «тик `llm` → `promptVersionId` в БД» покрыт unit-тестами цикла и ручной проверкой `ensurePromptVersion`, но не e2e; полный e2e — таск 8. Перед `test:e2e` останавливать свой dev-сервер.
- Первый прогон e2e упал и на `journal.spec.ts`: dev-сервер держал старый Prisma-клиент без `promptVersionId`. После перезапуска сервера — зелёный. После `prisma generate`/миграции dev-сервер надо перезапускать.
- `ensurePromptVersion` вынесена из `prompt-versions.ts` в `prompt-versions-db.ts`: `lib/db.ts` бросает без `DATABASE_URL`, тесты чистых функций идут без БД.
- Формат URI модели и максимальная длина промпта не проверяются — таск 7.
- Случайно запущенный `prettier --write` переформатировал ~170 файлов (в проекте нет конфига prettier, форматирование ручное); лишнее откатили, изменения только по задаче.

---

## 2026-10-13 (Phase 4, таск 5)

**Сделано:** Phase 4, таск 5 «`/settings`: пороги, лимиты, dry-run, движок, таймер» ✅.

- `agentConfigFormSchema` (`lib/validations/agent-config-form.ts`) поверх `AGENT_CONFIG_BOUNDS`: числа строками, лимит дневного бюджета — рубли (запятая или точка) → копейки; дефолтов нет — отсутствующее поле отклоняется, а не сбрасывается. Дробные копейки — ошибка «Не больше 2 знаков после запятой», не округление. `toAgentConfigFormValues` — копейки → рубли строкой без float.
- `updateAgentConfig()` в `lib/agent/config.ts`; `actions/settings.ts` — `updateAgentConfigAction`: та же схема формы → `requireAdmin()` → запись → `revalidatePath` для `/settings`, `/simulator`, `/dashboard`, `/campaigns`, `/campaigns/[id]`.
- Страница `app/(app)/settings/` (`page`, `loading`, `error`) и `AgentConfigForm` (Client Component: react-hook-form + shadcn `Field`, `Switch`, `RadioGroup`; группы «Режим», «Пороги решений», «Лимиты»; «Сохранено» через `role="status"`). Пункт «Настройки» в `AdminNav`.
- Тесты: `agent-config-form.test.ts` (28), `AgentConfigForm.test.tsx` (5), `AdminNav.test.tsx` (+1), `settings.spec.ts` (4: гость → `/login`, ссылка в шапке, невалидный шаг, сохранение шага + dry-run + движка и проверка на `/simulator`; `afterAll` → `resetAgentConfig()`).
- `type-check`/`lint`/`test` (470)/`build` зелёные; `test:e2e` — 32/33.

**Дальше:** Phase 4, таск 6 «Промпт и параметры LLM в БД, версия в `Decision`».

**Заметки:**

- В action уходят сырые значения формы (`form.getValues()`), а не результат схемы: сервер проверяет ровно то, что ввёл пользователь, той же схемой. `agentConfigSchema` с дефолтами для этого не подходит.
- Ошибка схемы в action возвращается общим сообщением формы, а не у поля: `ActionResult` без `fieldErrors`, у поля её показывает клиентская валидация.
- `llm.spec.ts` упал не из-за таска: Playwright переиспользовал уже запущенный `npm run dev` без `LLM_CLIENT=fake`, и тест ушёл в настоящую модель (один платный запрос). Второй dev-сервер в той же папке Next не запускает (`E2E_PORT` не помогает) — перед `test:e2e` останавливать свой dev-сервер. Повторный прогон `llm.spec.ts` не делался.
- `sonner` не ставился: «Сохранено» — строка в форме, как в `SimulatorControls`.
- Переключатели таймера и движка на `/simulator` пишут в ту же строку конфига — побеждает последнее сохранение.
- `ENGINE_LABELS` продублирован в `AgentConfigForm` (есть в `EngineToggle`) — `EngineToggle` вне scope таска.

---

## 2026-10-13 (Phase 4, таск 4)

**Сделано:** Phase 4, таск 4 «`/dashboard`» ✅.

- `buildDashboardSummary` (`lib/dashboard/summary.ts`, чистая функция): итоги прогона — расход, заказы, средний CPO = общий расход / общие заказы (взвешенный, не среднее CPO кампаний); по кампаниям — цель, допустимый CPO (`allowedCpo`), CPO за прогон и статус «в цели» / «в допуске» / «выше допуска» / «нет данных».
- `getDashboardView()` (`lib/dashboard/queries.ts`): `getActiveRunView()` + последние `DASHBOARD_RECENT_DECISIONS` (10) решений прогона с `campaign { id, name }` для ссылки; нет прогона → `null`.
- Страница `app/(app)/dashboard/` (`page`, `loading`, `error`): шапка «Тик N · seed S», `SummaryCards` (shadcn `card`), `CampaignCpoTable` (ссылки на `/campaigns/[id]`, `Badge` статуса), `RecentDecisions` (компактный список + «Весь журнал» → `/journal`); без прогона — ссылка на `/simulator`. `<Suspense>` вокруг заглушки заменён на `loading.tsx`.
- `components/features/DashboardStub.tsx` удалён.
- Тесты: `summary.test.ts` (9), `SummaryCards.test.tsx` (2), `CampaignCpoTable.test.tsx` (3), `RecentDecisions.test.tsx` (3), `panel.spec.ts` (+2: seed 42 → тик → итоги, 4 кампании, решения тика 1, переход в журнал; 0 тиков → «нет данных» и «Решений ещё нет»).
- `type-check`/`lint`/`test` (436)/`build` зелёные; `panel.spec.ts` + `auth.spec.ts` — 11/11. Скриншоты 375px и 1280px — без горизонтального скролла страницы (таблица на 375px прокручивается внутри себя, как на `/campaigns`).

**Дальше:** Phase 4, таск 5 «`/settings`: пороги, лимиты, dry-run, движок, таймер».

**Заметки:**

- Статус CPO сравнивается в целых числах (копейки × проценты), как в `decideByRules`: на границе допуска дашборд и агент не разойдутся из-за дробей.
- CPO кампании на дашборде — за весь прогон (как колонка CPO на `/campaigns`), а не по окну агента; окно — на графике `/campaigns/[id]`. Поэтому колонка подписана «CPO за прогон».
- Добавлена колонка «Допустимый CPO» (в плане не было) — без неё статус не объясним.
- Тёмная тема включается классом `.dark`, а не `prefers-color-scheme` — скриншот с `colorScheme: 'dark'` вышел светлым; отдельно `.dark` и консоль браузера не проверялись. Цвета — только токены темы и варианты `Badge`.
- Полный `test:e2e` не прогонялся — только `panel` и `auth`.

---

## 2026-10-13 (Phase 4, таск 3)

**Сделано:** Phase 4, таск 3 «Графики на `/campaigns/[id]`» ✅.

- shadcn `chart` (`components/ui/chart.tsx`, Recharts 3.8).
- `TickChart` (Client Component): линейный график по тикам — ось Y и tooltip через `formatRub`, `null` — разрыв линии (`connectNulls={false}`), ориентиры `ReferenceLine` с `ifOverflow="extendDomain"` и легенда под графиком; `<figure>` + `<figcaption>`, `role="img"` + `aria-label`. Маркеры точек — до 48 точек, иначе линия из одной точки не видна.
- `CampaignCharts` (синхронный Server Component, секция «Графики»): ставка, расход, «CPO за N тиков» с линиями «Цель CPO» и «Допустимый CPO (+N%)»; 0 тиков → «Тиков ещё не было»; заказов в окне не было → подпись «CPO появится после первого заказа в окне». Сетка: один столбец → `lg:grid-cols-3`.
- `allowedCpo` в `lib/agent/engines/rules.ts` экспортирована — график и правила считают допуск одной функцией.
- Страница подключает `CampaignCharts` между сводкой и «Данные по тикам»; `loading.tsx` — скелетон трёх графиков.
- Тесты: `CampaignCharts.test.tsx` (4, `TickChart` замокан), `rules.test.ts` (+2, `allowedCpo`), `panel.spec.ts` (три графика с линией и легендой ориентиров; +1 сценарий «0 тиков → текст вместо графиков»).
- `type-check`/`lint`/`test` (419)/`build` зелёные; `panel.spec.ts` — 6/6. Скриншоты 1280px, 375px (без горизонтального скролла) и `.dark` — читаются; консоль браузера без ошибок и предупреждений.

**Дальше:** Phase 4, таск 4 «`/dashboard`».

**Заметки:**

- Цвета — `--foreground` / `--muted-foreground` / `--destructive`, а не `--chart-*`: в теме они серые, `--chart-1` (oklch 0.87) не виден на белом. `globals.css` не менялся; если понадобятся цветные серии (дашборд), сначала поправить `--chart-*` в `:root` и `.dark`.
- Функции нельзя передать из Server в Client Component, поэтому форматирование (`formatRub`) — внутри `TickChart`, а `CampaignCharts` передаёт только данные в копейках.
- Recharts в jsdom не измеряет контейнер и ничего не рисует — сам график проверяется только e2e.
- Полный `test:e2e` не прогонялся — только `panel.spec.ts` (остальные сценарии таск не трогает).

---

## 2026-10-13 (Phase 4, таск 2)

**Сделано:** Phase 4, таск 2 «`/campaigns/[id]`: ряды по тикам и журнал кампании» ✅.

- `buildCampaignSeries` (`lib/campaigns/series.ts`, чистая функция): точка на каждый тик `1..currentTick` — ставка, расход, CPO по окну `windowTicks`; пропущенный тик → `null`, в окне нет заказов → `null`. Окно — тот же `aggregateWindow` + `cpo`, что у агента.
- `getCampaignDetail(id)` (`lib/campaigns/queries.ts`): любая кампания, в том числе архивного прогона; прогон, тики, итоги и метрики; `CampaignTruth` не выбирается.
- `getCampaignJournal(campaignId)` в `journal-queries.ts`: последние `JOURNAL_PAGE_SIZE` записей кампании любого прогона; общий `select`, порядок и преобразование записи вынесены и используются `/journal` тоже.
- Страница `app/(app)/campaigns/[id]/` (`page`, `loading`, `error`, `not-found`): `CampaignSummary` (состояние, бейдж «архив», «Тик N · seed S», 9 карточек), `<details>` «Данные по тикам» с `TickSeriesTable`, журнал кампании через существующий `JournalTable`; несуществующий id → «Кампания не найдена».
- Попутно: `aggregateWindow` принимает `WindowRow` (`MetricsInput` + `tick`) — подходят строки `TickStats`; `STATE_LABELS` вынесены в `lib/campaigns/state-labels.ts`.
- Тесты: `series.test.ts` (6), `CampaignSummary.test.tsx` (4), `TickSeriesTable.test.tsx` (2), `panel.spec.ts` (+3: гость → `/login`; «Плохая» — сводка, тики, только её журнал, после нового сброса — бейдж «архив»; несуществующий id).
- `type-check`/`lint`/`test` (413)/`build` зелёные; `test:e2e` — 25/26, упал только `llm.spec` (см. заметки).

**Дальше:** Phase 4, таск 3 «Графики на `/campaigns/[id]`».

**Заметки:**

- `next build` упал на `/campaigns/[id]`: с `cacheComponents` `usePathname` в `AdminNav` (layout) на маршруте с неизвестным `[id]` требует `<Suspense>`. `AdminNav` обёрнут в `<Suspense fallback={null}>` в `app/(app)/layout.tsx`, как `AdminHeader`. Любой будущий динамический маршрут под `(app)` без этого не собрался бы.
- Окно CPO на странице — текущий `AgentConfig.windowTicks`, в том числе для архивного прогона: история окна не хранится.
- `not-found` при `loading.tsx` отдаётся со статусом 200 (стриминг уже начался) — e2e проверяет текст, а не код ответа.
- `llm.spec` снова упал из-за запущенного dev-сервера без `LLM_CLIENT=fake` (один тик настоящей модели). Перед e2e — останавливать `npm run dev`.

---

## 2026-10-13 (Phase 4, таск 1)

**Сделано:** Phase 4, таск 1 «Навигация + `/campaigns`» ✅. Phase 4 начата (🔄).

- `/campaigns` (`app/(app)/campaigns/`: `page`, `loading`, `error`): `requireAdmin()` → `getActiveRunView()` → `CampaignsList`; без активного прогона — «Прогона нет» со ссылкой на `/simulator`.
- `CampaignsList` (Server Component): название → `/campaigns/<id>`, состояние, ставка, бюджет/сутки, цель CPO, расход, заказы, CPC / CTR / CR / CPO; без данных — «нет данных».
- `AdminNav`: пункт «Кампании», активность по префиксу (`/campaigns/[id]` подсвечивает «Кампании», `/campaigns-archive` — нет); `flex-wrap` — 4 пункта не помещались в 375px.
- Тесты: `CampaignsList.test.tsx` (4), `AdminNav.test.tsx` (+3), `tests/e2e/panel.spec.ts` (гость → `/login`; seed 42 → тик → 4 кампании, ссылка «Плохая»).
- `type-check`/`lint`/`test` (401)/`build` зелёные; `test:e2e` — 21/21 без `llm.spec`.

**Дальше:** Phase 4, таск 2 «`/campaigns/[id]`: ряды по тикам и журнал кампании».

**Заметки:**

- Отклонения от `phase-4.md` (согласованы, план фазы поправлен): новый `lib/campaigns/queries.ts` не создавали — `getActiveRunView()` уже отдаёт кампании с итогами и метриками без `CampaignTruth`, файл появится в таске 2 с `getCampaignDetail(id)`; пункт «Настройки» перенесён в таск 5, чтобы в меню не было ссылки на 404.
- До таска 2 ссылки из `/campaigns` ведут на 404 — так задумано.
- `llm.spec` не прогнан: был запущен dev-сервер без `LLM_CLIENT=fake`, тест упал на защитной проверке (успел сходить в настоящую модель). Второй `next dev` в той же папке не стартует («Another next dev server is already running»), `E2E_PORT` не помогает. Перед e2e фазы — останавливать dev-сервер.
- С `cacheComponents` после клиентского перехода предыдущая страница остаётся в DOM скрытой (Activity): `getByText` находит два элемента. В e2e — `.filter({ visible: true })`.
- `.dark` в проекте включается классом, а не `prefers-color-scheme` — тёмную тему через `emulateMedia` не проверить.

---

## 2026-10-13 (Phase 3, таск 7)

**Сделано:** Phase 3, таск 7 «E2E фазы и документация» ✅ — **Phase 3 завершена**.

- `createFakeLlmEngine` (`lib/agent/engines/llm-fake.ts`): при `LLM_CLIENT=fake` «модель» отвечает решением `decideByRules` в формате модели (рубли, `reason` с пометкой `fake: `). Ответ идёт через настоящий `createLlmEngine`: промпт, Zod-разбор, рубли → копейки, guardrails, `rawResponse` в журнале. Выбор — в `tick.ts` через новый `llmClientKindFromEnv()`.
- `playwright.config.ts`: `webServer.env.LLM_CLIENT = 'fake'`.
- `tests/e2e/llm.spec.ts`: seed 42 → движок LLM → 25 тиков → на `/journal` (фильтр «Движок: LLM») причина, метрики, ответ модели, «rules решил бы»; по «Плохой» принято `LOWER_BID`/`PAUSE`; обратно на «Правила» → тик 26 пишет `RULES`; гость на `/journal` и `/simulator` → `/login`. После сценария конфиг агента сбрасывается (`afterAll`).
- PRD: отмечены пункты Phase 3 в требованиях 4, 5, 6, 8.
- `type-check`/`lint`/`test` (38 файлов, 394)/`build`/`test:e2e` (21) зелёные.

**Дальше:** Phase 4 «Панель» — спланировать `phase-4.md`.

**Заметки:**

- `reuseExistingServer`: уже запущенный `next dev` не получает `LLM_CLIENT=fake`, а второй dev-сервер в той же папке Next 16 запустить не даёт. Перед `npm run test:e2e` останавливать свой `npm run dev`. Если забыть, `llm.spec.ts` падает после первого тика с подсказкой (в ответе нет `fake:`). Цена ошибки — один тик настоящей модели (4 запроса).
- Fake совпадает с `rules`, поэтому в e2e расхождений движков нет. Фильтр «Только расхождения» покрыт unit-тестами таска 5.
- Галочки PRD для Phase 0–2 не проставлены (в PRD не было отмечено ничего) — отдельно при желании.

---

## 2026-10-13 (Phase 3, таск 6.1)

**Сделано:** Phase 3, таск 6.1 «Правка промпта по итогам оценки» ✅ — две итерации промпта и смена модели по умолчанию на `aliceai-llm/latest`.

- Допустимый CPO готовым числом был в промпте уже с таска 2 — модель всё равно сравнивала неверно. Поэтому сравнения делает код: блок «Сравнения (посчитаны кодом)» (`comparisonLines` в `llm-prompt.ts`) — клики vs минимум, вывод по CPO (или расход vs допустимый CPO, если заказов нет), доля дневного бюджета за сутки и «выбран / не выбран».
- Сравнения — те же целочисленные формулы, что в `decideByRules`; порог бюджета — `BUDGET_LIMITED_PCT` из `rules.ts`. На всех 6 оценочных сценариях строки «Сравнения» ведут к действию `rules`.
- В `LLM_SYSTEM_PROMPT` — порядок решений «сверху вниз, первое подходящее».
- `type-check`/`lint`/`test` (387)/`build` зелёные.

**Итерация 1** (отдельные строки «CPO выше цели» и «CPO в пределах допустимого», правило 6 «в пределах допустимого → HOLD»), `eval:llm` ×3: **5 из 6 (83 %)** в каждом.

- Модель читает «Сравнения» верно — причины цитируют их («CPO выше цели 1000 руб., но в пределах допустимого 1200 руб.»), арифметической ошибки «1100 > 1200» больше нет.
- `healthy` всё равно `LOWER_BID` (19,99 ₽ ×2, 16,00 ₽ ×1): модель реагирует на «выше цели», хотя сама пишет «в пределах допустимого».
- Побочный плюс: в `degraded` и `bad-high-cpo` теперь полный шаг 16,00 ₽, а не снижение на 1 копейку.

**Итерация 2:** один вывод по CPO вместо двух строк — «CPO выше цели, но в пределах допустимого — в норме, ставку не снижать» / «CPO не выше цели — в норме» / «CPO выше допустимого»; у `LOWER_BID` в списке действий — «только если CPO выше допустимого или заказов нет»; явная фраза «цель — ориентир, граница — допустимый CPO».

**Итерация 2, `yandexgpt/latest`, ×3: 5 из 6 (83 %)** в каждом. `healthy` перестал снижать ставку, но стал `RAISE_BUDGET → 3 600 ₽` с причиной «CPO в норме, бюджет не выбран (50 %)» — модель цитирует «не выбран» и всё равно повышает. Вывод: систематическая слабость модели (детерминированно, ошибка переезжает между действиями при каждой правке), а не формулировки.

**Итерация 2, другие модели:**

- `qwen3.6-35b-a3b/latest` — HTTP 500 от AI Studio на каждый запрос. Предположительно не переваривает `response_format: json_schema` со `strict` (режимы `json_object` / `text` не проверялись).
- `aliceai-llm/latest`, ×3: **6/6, 5/6, 6/6**. Остальные 5 сценариев стабильны. Единственный промах — `healthy` → `RAISE_BUDGET` с причиной «есть потенциал для увеличения охвата». Обоснования точнее, чем у `yandexgpt` (цитирует все цифры). Минус: в `bad-high-cpo` и `degraded` снова снижение на 1 копейку (19,99 ₽), у `yandexgpt` после правки было 16,00 ₽.

**Решение (пользователь):** модель по умолчанию — `aliceai-llm/latest` (`DEFAULT_MODEL` в `lib/llm/client-from-env.ts`, тест, `.env.example`, PRD). Критерий DoD смягчён: `healthy` проходит в большинстве прогонов (2 из 3), а не во всех. `type-check`/`lint`/`test` (387)/`build` зелёные.

**Дальше:** Phase 3, таск 7 «E2E фазы и документация» (`tests/e2e/llm.spec.ts`, `LLM_CLIENT=fake` в Playwright, fake отвечает решением `rules`).

**Заметки:**

- Промах `healthy` у `aliceai-llm` — уже не ошибка чтения цифр, а «инициатива» модели (повысить бюджет при CPO в норме). В работе безопасно: guardrails держат шаг и потолок бюджета, расхождение с `rules` видно в журнале.
- Снижение на 1 копейку (19,99 ₽) у `aliceai-llm` вернулось; оценка этого не ловит. Кандидат в Phase 4: проверка «значение осмысленное» в оценке или правило про шаг в промпте.
- Модели без `json_schema` (`qwen3.6-35b-a3b` → HTTP 500) сейчас не подключить: режим вывода задан в коде. Если понадобятся — `LLM_RESPONSE_FORMAT` в env.
- Каждая правка промпта у `yandexgpt` переносила ошибку на другое действие — подгонять формулировки под одну модель бесполезно; оценку перепрогонять при каждой смене модели или текста промпта.

---

## 2026-10-13 (Phase 3, таск 6)

**Сделано:** Phase 3, таск 6 «Оценочные сценарии» ✅.

- `lib/agent/eval/scenarios.ts`: 6 фиксированных снимков («плохая» ×2, «мало данных», «поднять бюджет», «капризная», «в норме») с допустимыми действиями; `EVAL_CONFIG` задан явно, а не из `agentConfigSchema` — смена дефолтов не меняет сценарии.
- `lib/agent/eval/run-eval.ts`: `runEval(engine, scenarios, config)` — балл, если действие из `allowed` **и** предложение проходит `checkProposal`. Отказ движка и значение за лимитом — промах с причиной, прогон не падает.
- `scripts/eval-llm.ts`, `npm run eval:llm` — таблица «сценарий / ответ / допустимо?» и итоговый процент; с `LLM_CLIENT=fake` работает без сети.
- Тесты (`run-eval.test.ts`, 8): `rules` — 100 %; fake «всегда HOLD» — 2 из 6; не-JSON, недоступная модель, шаг больше `maxStepPct`, пустой набор. `type-check`/`lint`/`test` (377)/`build` зелёные.

**Прогон на настоящей модели** (`yandexgpt/latest`, `json_schema`, 4 запуска): **5 из 6 (83 %)** в каждом.

- Стабильно проходят `bad-no-orders` (`PAUSE` или `LOWER_BID` — оба допустимы), `bad-high-cpo`, `low-data`, `budget-limited`, `degraded`.
- Стабильный промах в `healthy`: модель предлагает `LOWER_BID → 19,99 ₽` вместо `HOLD`. CPO 1 100 ₽ выше цели 1 000 ₽, но в допуске 20 % (до 1 200 ₽); в причине модель пишет «1100.00 > 1200.00» — неверное сравнение, допуск она не учла (гипотеза по тексту ответов).
- В `degraded` и `healthy` снижение на 1 копейку (19,99 ₽): guardrails пропускают, по смыслу бесполезно.

**Дальше:** Phase 3, таск 6.1 «Правка промпта по итогам оценки» (готовый допустимый CPO в промпте, перепрогон `eval:llm`), затем таск 7 «E2E фазы и документация».

**Заметки:**

- Промах `healthy` повторяется в каждом запуске — это слабость промпта/модели, а не случайность. В работе не опасно (лимиты шага и бюджета держат guardrails), но в журнале это будет расхождение с `rules`.
- Правка промпта в таск 6 не входила (out of scope) — вынесена в 6.1.
- Редактирование текста промпта из `/settings` — Phase 4 (записано в `prd.md`, требование 7). Нужна версия промпта в `Decision` (миграция), иначе по записи журнала непонятно, по какому тексту решала модель; оценочные сценарии надо перепрогонять при каждой смене текста.

---

## 2026-10-12 (Phase 3, таск 5)

**Сделано:** Phase 3, таск 5 «Сравнение движков в журнале» ✅.

- Миграция `20261012204809_decision_shadow`: nullable `shadowAction`, `shadowAfter` (копейки), `shadowReason` в `Decision`; старые записи не тронуты, `database.md` обновлён.
- `lib/agent/cycle.ts`: `CycleParams.shadowEngine: AgentEngine | null`; `decideShadow` спрашивает теневой движок на том же снимке и пишет его **предложение** (до guardrails, не применяется). Сбой или отказ тени → `shadow*` = `null`, основное решение пишется и применяется как обычно.
- `lib/agent/tick.ts`: `shadowEngineFor(engine)` — при `LLM` тень `rulesEngine`, при `RULES` — `null` (модель не вызывается). Цикл конкретных движков не знает.
- `lib/validations/journal.ts`: `diverged=1` в URL (мусор → без фильтра), `buildJournalHref` его сохраняет — пагинация не менялась.
- `lib/agent/journal-queries.ts`: фильтр «разошлись» — `shadowAction` не `null` и `action ≠ shadowAction` через field reference (`db.decision.fields.shadowAction`, без preview-флага в Prisma 7), в `AND`, чтобы не перетереть фильтр по действию. Проверено на БД в откатываемой транзакции.
- `/journal`: колонка «rules решил бы» (действие, ₽, причина; у `RULES` — «—»), бейдж «Разошлись», `<details>` «Ответ модели» с `rawResponse` (показ сырого ответа не был закреплён ни за одним таском — сделан здесь), `Switch` «Только расхождения».
- Вне таска: на `/simulator` кнопка «Сбросить» сжималась во время тика — `@container` в shadcn `FieldGroup` обнуляет min-content формы. Форме дано `shrink-0 sm:w-xs`.
- `type-check`/`lint`/`test` (369)/`build` зелёные.

**Дальше:** Phase 3, таск 6 «Оценочные сценарии».

**Заметки:**

- Расхождение считается только по действию: тот же `LOWER_BID` с разной ставкой — не «разошлись».
- `FakeLLMClient` из env всё ещё отвечает `HOLD` — для e2e таска 7 он должен отвечать решением `rules`, тогда фильтр «разошлись» в e2e будет пуст (это ожидаемо).
- `/journal` в браузере проверял пользователь; агент не мог войти — доступ к `.env` с учётными данными закрыт.

---

## 2026-10-12 (Phase 3, таск 4)

**Сделано:** Phase 3, таск 4 «Переключатель `rules` | `llm` на `/simulator`» ✅.

- `lib/validations/agent-config.ts`: `engineToggleSchema` `{ engine: 'RULES' | 'LLM' }` без дефолта — значение обязано прийти явно, как у `timerToggleSchema`.
- `actions/simulator.ts`: `setEngineAction` — `safeParse` → `requireAdmin()` → `agentConfig.update({ engine })` → `revalidatePath('/simulator')`. В плане фазы `requireUser` заменён на `requireAdmin` (другой функции в проекте нет).
- `components/features/simulator/EngineToggle.tsx`: Client Component, радиогруппа «Правила» / «LLM» на shadcn `radio-group` (Base UI) + `FieldSet`/`FieldLegend`. Пока идёт запрос — заблокирована; отказ сервера → выбор прежний, ошибка `role="alert"`. В `SimulatorView` — рядом с блоком управления.
- Радиогруппа, а не Switch: движок — выбор одного из двух, а не «вкл/выкл». Настроенность LLM при переключении не проверяется — это уже делает тик (`TickError` до тика мира).
- `tests/e2e/simulator.spec.ts`: тест «переключатель движка сохраняется после перезагрузки» (в `finally` возвращает `RULES`); в `beforeAll` добавлен `resetAgentConfig()` — тесты переключателей ждут дефолты.
- `type-check`/`lint`/`test` (356)/`build`/`test:e2e` (19) зелёные.

**Дальше:** Phase 3, таск 5 «Сравнение движков в журнале».

**Заметки:**

- Полный тик на `LLM` через UI в этой сессии не прогонялся: e2e проверяет только сохранение выбора, сквозной тик на `llm` — таск 7 (`LLM_CLIENT=fake`). В `.env` уже `LLM_CLIENT=yandex` — ручной тик пойдёт в настоящую модель (платно).
- Вёрстку на 375px глазами не проверял: на `lg:` переключатель встаёт рядом с блоком управления, ниже — под ним.
- Worker локально не запущен (в Docker поднята только `db`): тики идут кнопкой «Один тик»; таймер работает только при `npm run worker` или `docker compose up`.

---

## 2026-10-12 (Phase 3, таск 3)

**Сделано:** Phase 3, таск 3 «Движок `llm` в цикле агента» ✅.

- `lib/agent/types.ts`: `decide` возвращает `EngineDecision` — `{ ok: true, proposal, rawResponse }` или `{ ok: false, rejectReason, rawResponse }`. Отказ движка — значение, а не исключение; `rulesEngine` отдаёт `ok: true`, `rawResponse: null`.
- `lib/agent/engines/llm.ts`: `createLlmEngine(client)` — `buildLlmPrompt` → `complete` с `LLM_DECISION_JSON_SCHEMA` → `parseLlmDecision`. `LLMClientError` → отказ «Модель недоступна: …» без `rawResponse`; прочие ошибки пробрасываются (баг → `failures` цикла).
- `lib/agent/cycle.ts`: отказ движка → запись `HOLD` + `REJECTED`, `reason` «Модель не дала решения», конкретная причина в `rejectReason`, сырой ответ в `rawResponse`; guardrails не вызываются, кампания не меняется. Валидное предложение идёт через те же guardrails, что у `rules`.
- `lib/agent/tick-core.ts` / `tick.ts`: заглушка `UNSUPPORTED_ENGINE_MESSAGE` убрана; `TickDeps.createEngine(name)` вызывается до тика мира — LLM не настроен → `TickError` «Движок LLM не настроен: …», время не идёт.
- `docker-compose.yml` не менялся: у `web` и `worker` уже `env_file: .env`.
- Настоящая модель через движок (`yandexgpt/latest`, `json_schema`): «плохая» → `LOWER_BID` 20 → 16 ₽, «в норме» → `HOLD` с `value: null` — nullable в `json_schema` работает, запасной `json_object` не нужен.
- `type-check`/`lint`/`test` (348)/`build`/`test:e2e` (18) зелёные.

**Дальше:** Phase 3, таск 4 «Переключатель `rules` | `llm` на `/simulator`».

**Заметки:**

- В локальном `.env` `LLM_CLIENT=yandexgpt` — допустимы только `yandex` | `fake`; до исправления тик на LLM падает с «Движок LLM не настроен». Ключ уже переименован в `YANDEX_API_KEY`.
- Полный тик на LLM через UI не прогонялся (переключателя нет до таска 4) — проверено вызовом движка напрямую и unit-тестами цикла.
- В проекте нет конфига Prettier: `npx prettier --write` форматирует двойными кавычками и пробелами — не запускать без `--use-tabs --single-quote --print-width 120` (и то меняет перенос объектов).
- `FakeLLMClient` из env по-прежнему отвечает `HOLD` — ответ решением `rules` нужен к таску 7.

---

## 2026-10-12 (Phase 3, таск 2)

**Сделано:** Phase 3, таск 2 «Схема ответа, промпт и разбор (чистые функции)» ✅.

- `lib/validations/llm-decision.ts`: `llmDecisionSchema` `{ action, value (рубли | null), reason (≤ 500) }` и `LLM_DECISION_JSON_SCHEMA` через `z.toJSONSchema` — схема для модели и проверка ответа из одного источника.
- `lib/agent/engines/llm-prompt.ts`: `buildLlmPrompt(snapshot, config)` → `{ system, user }`. Модель получает готовые метрики, цель, лимиты и границы новых значений (`valueBounds` — те же формулы, что в guardrails); деньги — рубли числами `1234.50`, без `formatRub`.
- `lib/agent/engines/llm-parse.ts`: `parseLlmDecision(content)` → `Proposal` в копейках или отказ с причиной, исключений не бросает. Снимает ```` ```json ```` -обёртку; для `LOWER_BID`/`RAISE_BID`/`RAISE_BUDGET` `value` обязателен и > 0; у `HOLD`/`WAIT_DATA`/`PAUSE` `value` отбрасывается. Лимиты — по-прежнему guardrails.
- `lib/metrics/money.ts`: `kopecksToRub`, `rubToKopecks` (`format.ts` не трогали).
- `type-check`/`lint`/`test` (337)/`build` зелёные.

**Дальше:** Phase 3, таск 3 «Движок `llm` в цикле агента».

**Заметки:**

- `z.toJSONSchema` даёт для `value` `"type": ["number", "null"]` (не `anyOf`); на настоящей модели в `json_schema` не проверялось — проверить в таске 3 через `llm:check` или первый тик; запасной вариант — `json_object`.
- Cooldown в промпте есть только как лимит: `decide` не получает `lastChangeTick`, модель может предложить изменение во время паузы — его отклонят guardrails.
- Переименование `AI_YANDEX_KEY` → `YANDEX_API_KEY` в локальном `.env` по-прежнему нужно до таска 3.

---

## 2026-10-12 (Phase 3, таск 1)

**Сделано:** Phase 3, таск 1 «`LLMClient` + проверка модели Yandex AI Studio» ✅.

- `lib/llm/`: интерфейс `LLMClient` (`complete({ system, user, jsonSchema? })` → `{ content, raw }`), `LLMClientError` с кодами `unauthorized` / `rate_limited` / `bad_request` / `unavailable` / `invalid_response`.
- `YandexLLMClient` — обычный `fetch` к `https://llm.api.cloud.yandex.net/v1/chat/completions`, без пакета `openai`; «конверт» ответа проверяется Zod; режимы `json_schema` (по умолчанию) / `json_object` / `text`. `FakeLLMClient` — ответчик + запомненные запросы. `createLLMClientFromEnv()` — `LLM_CLIENT=yandex|fake`.
- `npm run llm:check [modelUri] [режим]` — ручной запрос к настоящей модели. Прогон: `yandexgpt/latest` и `yandexgpt-lite/latest` × `json_schema`/`json_object` — все 4 ответа прошли схему, ~1–1,5 с, ~120 токенов. Выбрано `yandexgpt/latest` + `json_schema` (lite обосновывает хуже). Записано в `prd.md`, открытый вопрос закрыт.
- `type-check`/`lint`/`test` (305)/`build` зелёные.

**Дальше:** Phase 3, таск 2 «Схема ответа, промпт и разбор (чистые функции)».

**Заметки:**

- Ключ принимается как `Authorization: Bearer <key>`, каталог — в `OpenAI-Project`.
- `LLM_MODEL_URI` должен быть полным URI (`gpt://<folder>/yandexgpt/latest`); короткое `yandexgpt/latest` → 400 «Failed to parse model URI». Пусто — URI собирается из `YANDEX_FOLDER_ID`.
- В локальном `.env` ключ записан как `AI_YANDEX_KEY`, а код читает `YANDEX_API_KEY` — переименовать до таска 3 (worker).
- Гарантия соответствия схеме в режиме `json_schema` не проверялась на «плохих» ответах — Zod-проверка в таске 2 обязательна.

---

## 2026-10-12 (Phase 2, таск 7)

**Сделано:** Phase 2, таск 7 «Подбор порогов, сквозной сценарий, e2e фазы» ✅. **Phase 2 завершена.**

- `lib/agent/scenario.test.ts`: seed 42, 4 пресета, мир в памяти (`simulateTick` с теми же входами, что `runTick()`) + `runAgentCycle` с `MemoryProvider`/`MemoryJournal`. За 25 тиков «плохая» урезана, «хорошая» только усилена, «новую» не трогают; одинаковый seed → одинаковый журнал.
- Пороги: `windowTicks` 6 → 16, остальное без изменений. При окне 6 «плохая» не набирала 30 кликов и расход без заказов не доходил до допустимого CPO — агент вечно ждал; «хорошая» усиливалась только на 28-м тике. Перебор окна 6–24 × minClicks 10–40 × cooldown 3/6 и 8 seed: при 10–12 «хорошую» ошибочно урезают в часы, когда дневной бюджет кончился; 18 ломается на seed 42; 14–16 устойчиво. На seed 42: «плохая» на паузе с 8-го тика, «хорошей» бюджет поднят на 16, 19, 22.
- `tests/e2e/journal.spec.ts` — e2e фазы (25 тиков через UI, ~15 с). `beforeAll` сбрасывает конфиг агента к дефолтам через `tests/e2e/helpers/` (seed существующий конфиг не трогает).
- `prd.md`: пороги записаны в требование 5, открытый вопрос закрыт.
- `type-check`/`lint`/`test` (284)/`build`/`test:e2e` (18) зелёные.

**Дальше:** отчёт по Phase 2 (`phase-2-report.md`) и план Phase 3 «LLM-движок».

**Заметки:**

- Сгенерированный Prisma-клиент (ESM, `import.meta`) не импортируется в Playwright-тест (CommonJS) — хелпер запускает скрипт через `npx tsx`.
- e2e перетирает локальные пороги конфига на дефолты; до `/settings` (Phase 4) их всё равно негде менять.
- Локальная БД со старым конфигом (`windowTicks = 6`) обновится при первом `npm run test:e2e`; вручную — `npx tsx tests/e2e/helpers/reset-agent-config.ts`.
- «Капризной» к 30-му тику снижают ставку не на всех окнах — оценочные сценарии Phase 3.

---

## 2026-10-12 (Phase 2, таск 6)

**Сделано:** Phase 2, таск 6 «Страница `/journal`» ✅.

- `lib/validations/journal.ts`: `journalFiltersSchema` (невалидные параметры URL откатываются к «без фильтра» / странице 1 через `.catch`), `buildJournalHref`, `parseDecisionMetrics` (JSON `metrics` разбирается Zod, битая запись даёт `null`).
- `lib/agent/journal-queries.ts`: `getJournalPage` (активный прогон, новые сверху, `JOURNAL_PAGE_SIZE = 50`, номер страницы прижимается к последней) и `listJournalCampaigns`. `lib/agent/action-labels.ts` — подписи действий для таблицы и фильтров.
- `app/(app)/journal/` (`page.tsx` с `requireAdmin()`, `loading.tsx`, `error.tsx`) и `components/features/journal/`: `JournalTable` (метрики в `<details>`), `JournalFilters` (shadcn `select`, Client Component, `router.replace`), `JournalPagination`. Пункт «Журнал» в `AdminNav`. Добавлены shadcn `select`, `badge`.
- `playwright.config.ts`: `workers: 1` — тесты разных файлов сбрасывают один общий прогон симулятора и при параллельном запуске мешали друг другу.
- `type-check`/`lint`/`test` (279)/`build`/`test:e2e` (16) зелёные.

**Дальше:** Phase 2, таск 7 «Подбор порогов, сквозной сценарий, e2e фазы» (`scenario.test.ts`, `journal.spec.ts` на 25 тиков, пороги в `agent-config.ts` и seed).

**Заметки:**

- Журнал показывает только активный прогон; после сброса записи архивных прогонов в интерфейсе не видны (в БД остаются).
- Файл e2e назван `journal-page.spec.ts`, чтобы `journal.spec.ts` остался за сценарием фазы в таске 7.

---

## 2026-10-12 (Phase 2, таск 5)

**Сделано:** Phase 2, таск 5 «Worker-контейнер + "один тик" через агента» ✅.

- `lib/agent/tick-core.ts` (`runTickWith`, зависимости внедряются) и `lib/agent/tick.ts` (`runAgentTick` с реальными зависимостями): замок → конфиг → проверка движка и прогона → тик мира → цикл агента. Сбой цикла тик мира не откатывает (`cycleError`). `lib/agent/tick-lock.ts`: `pg_try_advisory_xact_lock` в транзакции с `timeout` 60 с, занят — «Тик уже выполняется».
- `lib/agent/config.ts`: `getAgentConfig()`. `lib/agent/worker-loop.ts` + `worker/index.ts`: конфиг читается каждый круг, SIGTERM доделывает тик и закрывает `db`.
- `actions/simulator.ts`: `tickAction` через агента (итог: решения / сбои / `cycleError`), `setTimerAction`; `timerToggleSchema` в `agent-config.ts`. `SimulatorControls`: переключатель таймера (shadcn `switch`) и итог агента.
- Docker: target `worker` в `Dockerfile` (node как PID 1, `--import tsx`), сервис `worker` в Compose с `MOCK_API_URL=http://web:3000/...`, `stop_grace_period: 30s`.
- `type-check`/`lint`/`test` (257)/`build`/`test:e2e` (12) зелёные. Вручную в Docker: таймер включён → тики растут и пишутся решения; выключен → стоят; `docker compose stop worker` → «Worker остановлен», код 0 за 0,6 с; три одновременных `runAgentTick` → один тик, два `busy`.

**Дальше:** Phase 2, таск 6 «Страница `/journal`» (`journal-queries.ts`, фильтры из `searchParams`, `JournalTable`, ссылка в `AdminNav`).

**Заметки:**

- Ядро вынесено в `tick-core.ts`: `tick.ts` импортирует `lib/db`, который падает без `DATABASE_URL`, и тест ядра не должен зависеть от БД.
- `SimulatorView` теперь читает конфиг: без строки `agent_configs` (seed не запускали) `/simulator` показывает `error.tsx`.
- Старый dev-сервер держит в `globalThis` Prisma-клиент без новых моделей — после смены схемы его надо перезапускать (иначе `db.agentConfig` — `undefined`).
- Docker-проверка оставила `timer_enabled = false`, `tick_interval_sec = 5` в БД — таймер выключен, интервал можно вернуть на 60 вручную.
- SIGTERM на Windows без Docker не проверить (Node там завершается без обработчика); проверено в контейнере.

---

## 2026-10-12 (Phase 2, таск 4)

**Сделано:** Phase 2, таск 4 «Цикл агента и запись в журнал» ✅.

- `lib/agent/cycle.ts`: `runAgentCycle({ provider, journal, engine, config, runId })` — один `listCampaigns` и один `getReport` за цикл, потом по каждой кампании: снимок → движок → guardrails → запись в журнал → применение (`LOWER_BID`/`RAISE_BID` → `setBid`, `RAISE_BUDGET` → `setDailyBudget`, `PAUSE` → `suspend`). Применяется только `ACCEPTED` при выключенном dry-run. Возвращает `CycleResult` (тик, решения, сбои по кампаниям).
- `lib/agent/types.ts`: `AgentEngine`, `AgentEngineName`, `CHANGE_ACTIONS`, `DecisionMetrics`, `JournalEntry`, `Journal`. `lib/agent/engines/rules.ts`: `rulesEngine` — обёртка над `decideByRules`.
- `lib/agent/journal.ts`: `prismaJournal` (`record`, `setApplyError`, `lastChangeTicks` через `groupBy` + `_max(tick)`). `lib/agent/memory-journal.ts`: журнал в памяти с той же логикой.
- `lib/ads/memory-provider.ts`: `AdsProvider` в памяти, сбои через `provider.failures`, `addRows` / `setTick` для сквозного сценария.
- `type-check`/`lint`/`test` (236)/`build` зелёные. E2E не запускался: цикл ни к чему не подключён. `prismaJournal` unit-тестами не покрыт (тестовой БД нет), его проверит e2e фазы в таске 7.

**Дальше:** Phase 2, таск 5 «Worker-контейнер + "один тик" через агента» (`lib/agent/tick.ts` с advisory lock, `worker/index.ts`, `tickAction`, переключатель таймера, сервис `worker` в Compose).

**Заметки:**

- Журнал, провайдер и движок приходят в цикл зависимостями: в `cycle.ts` нет Prisma и `fetch`. `engine` в записи — `engine.name` реального движка.
- `runId` передаёт вызывающий (`tick.ts`): в `AdsProvider` нет понятия «прогон». Для таска 5: взять `ACTIVE`-прогон; конфиг читать из `agent_configs` (понятная ошибка, если строки нет — её создаёт только seed).
- Отчёт запрашивается целиком, без `fromTick`: окно и сутки вырезает `aggregateWindow`. Если отчёт разрастётся — сузить запрос до последних `TICKS_PER_DAY` тиков.
- Ошибка `listCampaigns` / `getReport` — цикл бросает, журнал не пишется; `tick.ts` решает, что делать. Сбой одной кампании (движок, `record`, `setApplyError`) попадает в `failures` и `console.error`, остальные кампании обрабатываются.
- `lastChangeTick` считается по журналу: dry-run, `REJECTED`, `HOLD` / `WAIT_DATA` и записи с `applyError` паузу между изменениями не запускают — кампания не менялась.
- Сверх плана: `AgentEngineName` (тип из `AGENT_ENGINES`) и `CycleConfig = RulesConfig + dryRun`. В `Journal.record` возвращается `{ id }`, он нужен для `setApplyError`.
- Если `record` упал, записи нет, а кампания не меняется. Если упал сам `setApplyError` после неудачного применения, ошибка уходит в `failures`, а в журнале остаётся запись без `applyError`.

---

## 2026-10-12 (Phase 2, таски 2–3)

**Сделано:**

- Phase 2, таск 2 «`AdsProvider` + `MockProvider`» ✅.
  - `lib/ads/types.ts`: интерфейс `AdsProvider` (кампании, отчёт, ставка, бюджет, пауза/возобновление), деньги в копейках, `AdsProviderError` с кодами `unauthorized` / `not_found` / `conflict` / `bad_request` / `unavailable` / `invalid_response`.
  - `lib/ads/mock-provider.ts`: HTTP-клиент мока (`MOCK_API_URL` + Bearer `MOCK_API_TOKEN`), копейки ↔ микроединицы, таймаут `REQUEST_TIMEOUT_MS`, фабрика `createMockProviderFromEnv()`.
  - `lib/ads/mock-responses.ts`: Zod-схемы ответов мока.
  - `MOCK_API_URL` добавлен в `.env.example` и `prd.md`.
  - Вручную на живом моке: `listCampaigns()` вернул 4 кампании, с неверным токеном — `unauthorized`.
- Phase 2, таск 3 «Движок `rules` + guardrails» ✅.
  - `lib/agent/types.ts`: `DECISION_ACTIONS`, `Proposal`, `CampaignSnapshot`, `RulesConfig`.
  - `lib/agent/window.ts`: `aggregateWindow`, `buildSnapshot` (окно, метрики через `computeMetrics()`, расход за 24 тика).
  - `lib/agent/engines/rules.ts`: `decideByRules`. Правила по порядку: пауза → мало кликов → нет заказов → CPO выше допуска → бюджет выбран → не трогать; причина с цифрами.
  - `lib/agent/guardrails.ts`: `checkProposal` (ACCEPTED / REJECTED + `rejectReason`), `beforeValue`.
- `type-check`/`lint`/`test` (214)/`build` зелёные. E2E не запускался: UI нет.

**Дальше:** Phase 2, таск 4 «Цикл агента и запись в журнал» (`lib/agent/cycle.ts`, `lib/agent/journal.ts`, `lib/ads/memory-provider.ts`): статистика → метрики → решение → guardrails → журнал → применение.

**Заметки:**

- `fetch` передаётся в `MockProvider` через конструктор: глобальный не подменяем. Повторов (retry) нет: упавший запрос повторит следующий тик, ошибка применения уйдёт в `applyError`.
- `import 'server-only'` в провайдере не ставим: worker работает на чистом Node.
- Guardrails **отклоняют** значение за лимитом, а не подрезают: в журнале видно, что предлагал движок.
- `RAISE_BID` в правилах нет (его нет в списке PRD); guardrails его проверяют, он нужен LLM.
- «Бюджет выбран» — расход за последние 24 тика ≥ `BUDGET_LIMITED_PCT` (90%) бюджета. Округление в безопасную сторону: `ceil` при снижении, `floor` при повышении.
- Сверх плана: `buildSnapshot` (пригодится циклу в таске 4) и `HOLD`, если ставку снизить или бюджет поднять уже некуда. Без этого guardrails отклоняли бы «пустое» изменение.
- Для таска 4: `lastChangeTick` (тик последнего применённого изменения кампании) считается из журнала и передаётся в `checkProposal`.
- Для таска 7: при `windowTicks = 6` «плохая» тратит в окне ~1 080 ₽ при допустимых 1 200 ₽ и до `PAUSE` не дойдёт, пороги нужно подбирать.

---

## 2026-10-12 (Phase 2, таск 1)

**Сделано:** Phase 2, таск 1 «Схема агента: `AgentConfig` и `Decision`» ✅. Миграция `20261012155128_agent`: enum-ы `agent_engine`, `decision_action`, `decision_verdict`, таблицы `agent_configs` (одна строка, `id = "default"`) и `decisions` (индексы `(run_id, tick)`, `campaign_id`; связи с кампанией и прогоном — `onDelete: Restrict`). `lib/validations/agent-config.ts` — `agentConfigSchema` (единственный источник дефолтов), `AGENT_CONFIG_BOUNDS`, `AGENT_CONFIG_ID`, `AGENT_ENGINES` + тест. `prisma/seed.ts` — `ensureAgentConfig()` (`upsert`, `update: {}`). `.docs/database.md` — раздел «Агент (Phase 2)». `type-check`/`lint`/`test` (147)/`build` зелёные; e2e не запускался — UI нет. Вручную: seed дважды — в `agent_configs` одна строка с дефолтами; изменённый `min_clicks` повторный seed не затёр.

**Дальше:** Phase 2, таск 2 «`AdsProvider` + `MockProvider`» (`lib/ads/types.ts`, `lib/ads/mock-provider.ts` по HTTP с `MOCK_API_URL` + `MOCK_API_TOKEN`, микроединицы ↔ копейки, типизированные ошибки 401/404/409).

**Заметки:**

- Сверх списка фазы добавлено поле `windowTicks` (окно агрегации, дефолт 6): нужно таску 3, а БД в фазе меняется только в таске 1.
- В Prisma у порогов, `engine`, `dryRun`, `timerEnabled` нет `@default` — значения берутся из `agentConfigSchema.parse({})`. Конфиг создаёт только seed; без него строки нет (учесть в таске 4/5: понятная ошибка, если конфига нет).
- `before` / `after` — копейки; поле задаётся действием (`*_BID` → ставка, `RAISE_BUDGET` → бюджет, остальные → `null`). У `REJECTED` в `after` — предложение движка.
- `rawResponse` — `String?`, а не `Json`: сырой ответ LLM может быть невалидным JSON.
- Zod-enum движка — свой список `['RULES', 'LLM']` без импорта из `generated/prisma` (схему подключит клиентская форма `/settings`); расхождение с Prisma поймает type-check в seed.
- Стартовые пороги временные, подбираются в таске 7.
- После миграции — перезапустить `next dev` (singleton Prisma держит старый клиент).

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
