#!/bin/sh
# Один дамп БД в /backups и чистка старых.
# Запускается в контейнере backup (postgres:17-alpine, Node там нет): подключение — PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
# Ручной запуск: docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup sh /ops/backup.sh
set -eu
# Дамп содержит хеш пароля админа — читать может только владелец
umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
MINUTES_PER_DAY=1440

log() {
  echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

case "$KEEP_DAYS" in
  '' | *[!0-9]*)
    log "BACKUP_KEEP_DAYS должен быть целым числом дней, получено: '$KEEP_DAYS'" >&2
    exit 1
    ;;
esac

mkdir -p "$BACKUP_DIR"

final="$BACKUP_DIR/adpilot-$(date -u +%Y%m%d-%H%M%S).dump"
part="$final.part"

# Дамп пишется во временный файл: оборванный дамп не попадёт в список готовых
trap 'rm -f "$part"' EXIT

if ! pg_dump --format=custom --file="$part"; then
  log "pg_dump упал, дамп не создан" >&2
  exit 1
fi
mv "$part" "$final"
log "дамп создан: $final ($(wc -c <"$final") байт)"

# Чистка: файлы старше KEEP_DAYS. Самый свежий дамп не удаляется никогда —
# при KEEP_DAYS=0 остаётся он один, а долгий сбой бэкапов не стирает все копии.
# Имена содержат UTC-время, поэтому последний по алфавиту — самый свежий.
newest=$(ls -1 "$BACKUP_DIR"/adpilot-*.dump | tail -n 1)
max_age_min=$((KEEP_DAYS * MINUTES_PER_DAY))

is_expired() {
  [ "$KEEP_DAYS" -eq 0 ] || [ -n "$(find "$1" -mmin +"$max_age_min")" ]
}

for dump in "$BACKUP_DIR"/adpilot-*.dump; do
  if [ "$dump" != "$newest" ] && is_expired "$dump"; then
    rm -f "$dump"
    log "удалён старый дамп: $dump"
  fi
done
