#!/bin/bash
# Canonical secrets/config snapshot, separate from source code and GitHub.
# Writes only to /var/backups/tripetica/secrets/. Retention = 1 verified archive.
# No encryption key exists off-box; store root-only (mode 600) instead of a local-only password.
# Never prints secret values. Safe order: leave current archive, write+verify, then delete old.
set -euo pipefail

CANON=/var/backups/tripetica/secrets
PATTERN='tripetica-secrets-*.tar'
umask 077

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

install -d -o root -g root -m 700 "$CANON"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="$CANON/tripetica-secrets-${stamp}.tar"
stage=$(mktemp -d /var/tmp/tripetica-secrets-stage.XXXXXX)
stage_root="$stage/tripetica-secrets-${stamp}"

cleanup_stage() {
  rm -rf "$stage"
}

remove_failed_new() {
  cleanup_stage
  if [[ -n "${archive:-}" && -e "$archive" ]]; then
    echo "remove_failed_new $archive" >&2
    rm -f "$archive"
  fi
}

trap cleanup_stage EXIT

mkdir -m 700 "$stage_root"
manifest="$stage_root/MANIFEST.txt"

# Paths only. Do not echo file contents.
candidates=(
  /root/tripetica-web/.env.development.local
  /root/tripetica-web/.env.development.migrate.local
  /root/tripetica-web/.env.local
  /root/tripetica-web/.env.local.save
  /srv/tripetica/current/.env.production.local
)

copied=0
{
  echo "created_utc=$stamp"
  echo "host=$(hostname -s)"
  echo "note=filenames and sizes only; values are not recorded here"
  echo
} >"$manifest"

for src in "${candidates[@]}"; do
  if [[ ! -f "$src" ]]; then
    echo "skip_missing $src" >&2
    continue
  fi
  bytes=$(stat -c '%s' "$src")
  if [[ "$bytes" -eq 0 ]]; then
    echo "skip_empty $src" >&2
    continue
  fi
  dest_name=$(echo "$src" | sed 's#^/##; s#/#__#g')
  install -o root -g root -m 600 "$src" "$stage_root/$dest_name"
  copied=$((copied + 1))
  {
    echo "file=$src"
    echo "member=$dest_name"
    echo "bytes=$bytes"
    echo "mode=$(stat -c '%a' "$src")"
    echo "owner=$(stat -c '%U:%G' "$src")"
    echo
  } >>"$manifest"
done

if [[ "$copied" -lt 1 ]]; then
  echo "no secret/config files copied" >&2
  remove_failed_new
  exit 1
fi
if [[ ! -f "$stage_root/srv__tripetica__current__.env.production.local" ]]; then
  echo "production env file was not copied" >&2
  remove_failed_new
  exit 1
fi

chmod 600 "$manifest"
if ! tar -C "$stage" --numeric-owner -cf "$archive" "$(basename "$stage_root")"; then
  remove_failed_new
  echo "secrets tar failed; previous secrets archive left in place" >&2
  exit 1
fi

chown root:root "$archive"
chmod 600 "$archive"

bytes=$(stat -c '%s' "$archive")
if [[ "$bytes" -lt 256 ]]; then
  echo "new secrets archive is empty or too small: $archive ($bytes bytes)" >&2
  remove_failed_new
  exit 1
fi

verify=$(mktemp -d /var/tmp/tripetica-secrets-verify.XXXXXX)
chmod 700 "$verify"
if ! tar -C "$verify" -xf "$archive"; then
  rm -rf "$verify"
  echo "secrets tar extract failed: $archive" >&2
  remove_failed_new
  exit 1
fi

extracted_root="$verify/$(basename "$stage_root")"
if [[ ! -d "$extracted_root" ]]; then
  rm -rf "$verify"
  echo "secrets archive layout unexpected" >&2
  remove_failed_new
  exit 1
fi

mismatch=0
while IFS= read -r member; do
  orig=${member##*/}
  orig=${orig//__/\/}
  orig="/$orig"
  if [[ ! -f "$orig" ]]; then
    continue
  fi
  if ! cmp -s "$member" "$orig"; then
    mismatch=1
    break
  fi
done < <(find "$extracted_root" -type f ! -name 'MANIFEST.txt')

rm -rf "$verify"
if [[ "$mismatch" -ne 0 ]]; then
  echo "secrets archive does not match source files" >&2
  remove_failed_new
  exit 1
fi

sha=$(sha256sum "$archive" | awk '{print $1}')
echo "secrets_backup_ok path=$archive bytes=$bytes files=$copied sha256=$sha"

shopt -s nullglob
for old in "$CANON"/$PATTERN; do
  if [[ "$old" != "$archive" ]]; then
    echo "prune $old"
    rm -f "$old"
  fi
done
shopt -u nullglob

echo "retained $archive"
