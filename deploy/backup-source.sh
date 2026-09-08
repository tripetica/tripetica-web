#!/bin/bash
# Canonical /root/tripetica-web source snapshot (code / design / architecture).
# Writes only to /var/backups/tripetica/source/. Retention = 1 verified archive.
# Never includes .env/secrets, database dumps, node_modules, or .next.
# Safe order: leave the current archive, write+verify a new one, then delete the old.
set -euo pipefail

CANON=/var/backups/tripetica/source
SRC_PARENT=/root
SRC_NAME=tripetica-web
PATTERN='tripetica-web-*.tar.gz'

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi
if [[ ! -d "$SRC_PARENT/$SRC_NAME" ]]; then
  echo "source tree missing: $SRC_PARENT/$SRC_NAME" >&2
  exit 1
fi

install -d -o root -g root -m 750 "$CANON"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="$CANON/tripetica-web-${stamp}.tar.gz"

remove_failed_new() {
  if [[ -n "${archive:-}" && -e "$archive" ]]; then
    echo "remove_failed_new $archive" >&2
    rm -f "$archive"
  fi
}

if ! tar -C "$SRC_PARENT" --exclude-vcs \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='out' \
  --exclude='coverage' \
  --exclude='tmp' \
  --exclude='.vercel' \
  --exclude='.cursor' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  --exclude='*.dump' \
  --exclude='*.pem' \
  --exclude='*.tsbuildinfo' \
  --exclude='next-env.d.ts' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.local.save' \
  --exclude='.env.development' \
  --exclude='.env.development.local' \
  --exclude='.env.development.migrate.local' \
  --exclude='.env.production' \
  --exclude='.env.production.local' \
  -czf "$archive" "$SRC_NAME"; then
  remove_failed_new
  echo "tar failed; previous source archive left in place" >&2
  exit 1
fi

chown root:root "$archive"
chmod 640 "$archive"

bytes=$(stat -c '%s' "$archive")
if [[ "$bytes" -lt 1048576 ]]; then
  echo "new source archive is empty or too small: $archive ($bytes bytes)" >&2
  remove_failed_new
  exit 1
fi
if ! gzip -t "$archive"; then
  echo "gzip integrity failed: $archive" >&2
  remove_failed_new
  exit 1
fi

list=$(mktemp)
trap 'rm -f "$list"' EXIT
if ! tar -tzf "$archive" >"$list"; then
  echo "tar list failed: $archive" >&2
  remove_failed_new
  exit 1
fi

required=(
  "$SRC_NAME/app/"
  "$SRC_NAME/components/"
  "$SRC_NAME/lib/"
  "$SRC_NAME/public/"
  "$SRC_NAME/db/migrations/"
  "$SRC_NAME/deploy/"
  "$SRC_NAME/scripts/"
  "$SRC_NAME/package.json"
  "$SRC_NAME/package-lock.json"
  "$SRC_NAME/tsconfig.json"
  "$SRC_NAME/next.config.ts"
  "$SRC_NAME/.env.example"
)
for path in "${required[@]}"; do
  if ! grep -F -q "$path" "$list"; then
    echo "required path missing from archive: $path" >&2
    remove_failed_new
    exit 1
  fi
done

if grep -E -q '(^|/)\.env(\.local|\.production|\.development)|(^|/)node_modules/|(^|/)\.next/|\.dump$|\.pem$' "$list"; then
  echo "archive contains excluded secrets, dumps, or build artifacts" >&2
  remove_failed_new
  exit 1
fi
if grep -F -q "$SRC_NAME/.env.local" "$list" || grep -F -q "$SRC_NAME/.env.production.local" "$list"; then
  echo "archive contains env secret files" >&2
  remove_failed_new
  exit 1
fi

sha=$(sha256sum "$archive" | awk '{print $1}')
members=$(wc -l <"$list" | tr -d ' ')
echo "source_backup_ok path=$archive bytes=$bytes members=$members sha256=$sha"

shopt -s nullglob
for old in "$CANON"/$PATTERN; do
  if [[ "$old" != "$archive" ]]; then
    echo "prune $old"
    rm -f "$old"
  fi
done
shopt -u nullglob

# Legacy mixed snapshot from 2026-08-27: delete only the source tar.gz, never the SQL dump.
legacy_source="/var/backups/tripetica/2026-08-27_04-01-45/tripetica-web.tar.gz"
if [[ -e "$legacy_source" ]]; then
  echo "prune $legacy_source"
  rm -f "$legacy_source"
fi

while IFS= read -r extra; do
  if [[ "$extra" != "$archive" ]]; then
    echo "prune $extra"
    rm -f "$extra"
  fi
done < <(find /var/backups/tripetica -type f -name 'tripetica-web*.tar.gz' ! -path "$archive")

echo "retained $archive"
