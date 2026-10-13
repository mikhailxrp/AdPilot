#!/bin/sh
# Проверка, что дамп восстанавливается: дамп → временная БД → сверка счётчиков с рабочей → удаление временной БД.
# Рабочая БД не меняется. Без аргумента берётся последний дамп.
# Запуск: docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup sh /ops/restore-check.sh [dump]
# exit 0 — дамп хороший, exit 1 — любой сбой.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
CHECK_DB="adpilot_restore_check"
# Таблицы с одной строкой конфига и таблицы, которые только дополняются
CONFIG_TABLE="agent_configs"
CONFIG_ROWS=1

fail() {
  echo "ОШИБКА: $*" >&2
  exit 1
}

dump="${1:-}"
if [ -z "$dump" ]; then
  dump=$(ls -1 "$BACKUP_DIR"/adpilot-*.dump 2>/dev/null | tail -n 1)
  [ -n "$dump" ] || fail "в $BACKUP_DIR нет дампов adpilot-*.dump"
fi
[ -s "$dump" ] || fail "файл дампа не найден или пустой: $dump"

# Содержимое проверяется pg_restore --list: нечитаемый или не-дамп файл отсекается сразу
pg_restore --list "$dump" >/dev/null 2>&1 || fail "файл не читается как дамп pg_dump: $dump"

drop_check_db() {
  dropdb --if-exists --force "$CHECK_DB" >/dev/null 2>&1 || true
}
# Временная БД удаляется при любом исходе, включая Ctrl+C
trap drop_check_db EXIT
trap 'exit 1' INT TERM

drop_check_db
createdb "$CHECK_DB"
echo "Восстанавливаю $dump во временную БД $CHECK_DB…"
# --exit-on-error: обрезанный дамп падает здесь, а не «восстанавливается наполовину»
pg_restore --exit-on-error --no-owner --dbname="$CHECK_DB" "$dump" || fail "pg_restore не смог развернуть дамп (файл повреждён или обрезан)"

count_rows() {
  psql -X -q -t -A -d "$1" -c "SELECT count(*) FROM \"$2\""
}

bad=0
# Заголовок с ручными пробелами: printf считает ширину в байтах, и кириллица в %-20s съезжает
echo "таблица                  дамп   рабочая  результат"

# check_table <таблица> <equal|atmost|config>
check_table() {
  table="$1"
  rule="$2"
  restored=$(count_rows "$CHECK_DB" "$table")
  live=$(count_rows "$PGDATABASE" "$table")
  case "$rule" in
    equal) [ "$restored" -eq "$live" ] && result="ok" || result="РАСХОЖДЕНИЕ: должно совпадать" ;;
    atmost) [ "$restored" -le "$live" ] && result="ok" || result="РАСХОЖДЕНИЕ: в дампе больше, чем в рабочей" ;;
    config) [ "$restored" -eq "$CONFIG_ROWS" ] && result="ok" || result="РАСХОЖДЕНИЕ: ожидается $CONFIG_ROWS строка" ;;
  esac
  [ "$result" = "ok" ] || bad=1
  printf '%-20s %8s %10s  %s\n' "$table" "$restored" "$live" "$result"
}

check_table _prisma_migrations equal
check_table users equal
check_table "$CONFIG_TABLE" config
check_table decisions atmost
check_table tick_stats atmost
check_table prompt_versions atmost

[ "$bad" -eq 0 ] || fail "счётчики дампа не сходятся с рабочей БД"
echo "OK: дамп восстанавливается, счётчики сходятся"
