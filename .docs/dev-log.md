# Development Log

Короткая запись в конце каждой сессии. Новые записи — сверху.

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
