#!/bin/bash
# Ensure the production env has exactly one durable UETDS_CREDENTIALS_KEY.
# Never prints the value. Never overwrites an existing key.
# Never copies DEV keys. Generates only when no key and no sealed ciphertext exist.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: deploy/ensure-production-uetds-credentials-key.sh <env-file>" >&2
  exit 1
fi

TARGET=$(readlink -f "$1")
CURRENT_ENV=/srv/tripetica/current/.env.production.local
ACL_SCRIPT=$(readlink -f "$(dirname "$0")/apply-production-env-acl.sh")

if [[ ! -f "$TARGET" ]]; then
  echo "env file is missing" >&2
  exit 1
fi

has_key() {
  awk -F= '$1=="UETDS_CREDENTIALS_KEY" { found=1 } END { exit found ? 0 : 1 }' "$1"
}

if has_key "$TARGET"; then
  echo "UETDS_CREDENTIALS_KEY=present"
  exit 0
fi

if [[ -f "$CURRENT_ENV" ]] && has_key "$CURRENT_ENV"; then
  awk -F= '$1=="UETDS_CREDENTIALS_KEY" { print }' "$CURRENT_ENV" >>"$TARGET"
  "$ACL_SCRIPT" "$TARGET"
  echo "UETDS_CREDENTIALS_KEY=present"
  exit 0
fi

sealed=$(sudo -u postgres psql -d tripetica -X -v ON_ERROR_STOP=1 -At -c \
  "SELECT COUNT(*) FROM uetds_companies WHERE (test_password_sealed IS NOT NULL AND length(btrim(test_password_sealed)) > 0) OR (live_password_sealed IS NOT NULL AND length(btrim(live_password_sealed)) > 0);")
if [[ "${sealed}" != "0" ]]; then
  echo "UETDS_CREDENTIALS_KEY=missing_with_ciphertext" >&2
  exit 1
fi

umask 077
printf 'UETDS_CREDENTIALS_KEY=%s\n' "$(openssl rand -hex 32)" >>"$TARGET"
"$ACL_SCRIPT" "$TARGET"
echo "UETDS_CREDENTIALS_KEY=created"
