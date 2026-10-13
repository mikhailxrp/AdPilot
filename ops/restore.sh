#!/bin/sh
# Восстановление РАБОЧЕЙ БД из дампа: данные в ней будут заменены содержимым дампа.
# Сначала на хосте остановить web и worker (отсюда docker недоступен):
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml stop web worker
# Затем:
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup sh /ops/restore.sh [--yes] /backups/adpilot-<дата>.dump
# После: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
set -eu

STOP_CMD="docker compose -f docker-compose.yml -f docker-compose.prod.yml stop web worker"

fail() {
  echo "ОШИБКА: $*" >&2
  exit 1
}

assume_yes=0
if [ "${1:-}" = "--yes" ]; then
  assume_yes=1
  shift
fi

dump="${1:-}"
[ -n "$dump" ] || fail "укажи дамп: restore.sh [--yes] /backups/adpilot-<дата>.dump"
[ -s "$dump" ] || fail "файл дампа не найден или пустой: $dump"
pg_restore --list "$dump" >/dev/null 2>&1 || fail "файл не читается как дамп pg_dump: $dump"

# Пока web или worker держат соединения, восстановление ломает им запросы на лету
others=$(psql -X -q -t -A -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()")
if [ "$others" -gt 0 ]; then
  fail "к БД $PGDATABASE подключено клиентов: $others. Останови web и worker на хосте: $STOP_CMD"
fi

if [ "$assume_yes" -ne 1 ]; then
  echo "Данные в БД $PGDATABASE будут ЗАМЕНЕНЫ содержимым $dump."
  printf 'Для продолжения введи yes: '
  read -r answer || answer=""
  [ "$answer" = "yes" ] || fail "отменено"
fi

# --single-transaction: восстановление атомарное, при ошибке рабочая БД остаётся как была
pg_restore --clean --if-exists --exit-on-error --single-transaction --no-owner --dbname="$PGDATABASE" "$dump" \
  || fail "pg_restore не выполнился, рабочая БД не изменена"

echo "OK: БД $PGDATABASE восстановлена из $dump. Запусти сервисы: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
