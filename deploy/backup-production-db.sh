#!/bin/bash
# Canonical production PostgreSQL backup.
# Writes only to /var/backups/tripetica/. Retention = 1 verified dump.
# Never copies dumps to /srv/tripetica/backups/.
# Safe order: leave the current dump, write+verify a new dump, then delete the old one.
set -euo pipefail

CANON=/var/backups/tripetica
SRV_DUP=/srv/tripetica/backups
DATABASE=tripetica
PATTERN='tripetica-*.dump'

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

install -d -o postgres -g postgres -m 750 "$CANON"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
dump="$CANON/tripetica-${stamp}.dump"

remove_failed_new() {
  if [[ -n "${dump:-}" && -e "$dump" ]]; then
    echo "remove_failed_new $dump" >&2
    rm -f "$dump"
  fi
}

if ! sudo -u postgres pg_dump -Fc -d "$DATABASE" -f "$dump"; then
  remove_failed_new
  echo "pg_dump failed; previous dump left in place" >&2
  exit 1
fi
chown postgres:postgres "$dump"
chmod 640 "$dump"

bytes=$(stat -c '%s' "$dump")
if [[ "$bytes" -lt 1024 ]]; then
  echo "new dump is empty or too small: $dump ($bytes bytes)" >&2
  remove_failed_new
  exit 1
fi
if ! pg_restore -l "$dump" >/dev/null; then
  echo "new dump is not readable by pg_restore -l: $dump" >&2
  remove_failed_new
  exit 1
fi
sha=$(sha256sum "$dump" | awk '{print $1}')
toc=$(pg_restore -l "$dump" | wc -l)
echo "backup_ok path=$dump bytes=$bytes toc_entries=$toc sha256=$sha"

shopt -s nullglob
for old in "$CANON"/$PATTERN; do
  if [[ "$old" != "$dump" ]]; then
    echo "prune $old"
    rm -f "$old"
  fi
done
if [[ -d "$SRV_DUP" ]]; then
  for copy in "$SRV_DUP"/$PATTERN; do
    echo "remove_duplicate $copy"
    rm -f "$copy"
  done
fi
shopt -u nullglob

echo "retained $dump"
