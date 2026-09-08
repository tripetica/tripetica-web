#!/bin/bash
# Grant tripetica-worker read access to a release's .env.production.local.
# Never makes the file world-readable.
set -euo pipefail

ENV_FILE="${1:-/srv/tripetica/current/.env.production.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "production env file is missing: $ENV_FILE" >&2
  exit 1
fi

chmod 600 "$ENV_FILE"
if id tripetica-prod >/dev/null 2>&1; then
  chown tripetica-prod:tripetica-prod "$ENV_FILE"
fi
if ! id tripetica-worker >/dev/null 2>&1; then
  echo "tripetica-worker user is missing" >&2
  exit 1
fi
setfacl -m u:tripetica-worker:r-- "$ENV_FILE"

other_mode=$(stat -c '%a' "$ENV_FILE")
if [[ "${other_mode: -1}" != "0" ]]; then
  echo "refusing world-accessible production env mode $other_mode" >&2
  exit 1
fi

echo "production_env_acl_ok"
