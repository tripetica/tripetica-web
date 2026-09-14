#!/bin/bash
# Prepare an immutable production release directory. Does not switch current.
#
# Release retention (do not run cleanup from this script):
#   1. Record PREVIOUS_CURRENT now (today's live current = tomorrow's rollback).
#   2. Build/test/env the candidate while A (old rollback) + B (current) + C stay.
#   3. After successful cutover + health/smoke only, run:
#        deploy/retain-production-releases-after-cutover.sh \
#          --cutover-confirmed --expected-current <C>
#      That keeps C + B and deletes older releases. Never call it on build/health failure.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: deploy/prepare-release.sh <source-tree> <release-dir>" >&2
  exit 1
fi

SOURCE=$(readlink -f "$1")
RELEASE=$(readlink -f "$2")
CURRENT_ENV=/srv/tripetica/current/.env.production.local
ACL_SCRIPT=$(readlink -f "$(dirname "$0")/apply-production-env-acl.sh")

if [[ ! -d "$SOURCE" ]]; then
  echo "source tree is missing" >&2
  exit 1
fi
if [[ ! -f "$CURRENT_ENV" ]]; then
  echo "current production env is missing" >&2
  exit 1
fi
if [[ -e "$RELEASE" ]]; then
  echo "release directory already exists: $RELEASE" >&2
  exit 1
fi

install -d -o root -g root -m 755 "$RELEASE"
rsync -a \
  --exclude '.git/' \
  --exclude '.next/' \
  --exclude 'node_modules/' \
  --exclude '.env.local' \
  --exclude '.env.local.save' \
  --exclude '.env.development.local' \
  --exclude '.env.development.migrate.local' \
  --exclude '.env.production.local' \
  --exclude '.cursor/' \
  --exclude 'tmp/' \
  --exclude '.deploy-previous-current' \
  "$SOURCE/" "$RELEASE/"

PREVIOUS_CURRENT=$(readlink -f /srv/tripetica/current)
if [[ ! -d "$PREVIOUS_CURRENT" ]]; then
  echo "cannot record previous current: $PREVIOUS_CURRENT" >&2
  exit 1
fi
printf '%s\n' "$PREVIOUS_CURRENT" >"$RELEASE/.deploy-previous-current"
chmod 644 "$RELEASE/.deploy-previous-current"

install -o tripetica-prod -g tripetica-prod -m 600 "$CURRENT_ENV" "$RELEASE/.env.production.local"
"$ACL_SCRIPT" "$RELEASE/.env.production.local"

if [[ -e "$RELEASE/.env.local" || -e "$RELEASE/.env.development.local" ]]; then
  echo "DEV env files leaked into the release" >&2
  exit 1
fi
if [[ ! -f "$RELEASE/scripts/expire-stale-payment-pending.ts" ]]; then
  echo "payment-pending expire script is missing from the release" >&2
  exit 1
fi
if [[ ! -f "$RELEASE/scripts/fx-scheduled-refresh.ts" ]]; then
  echo "FX scheduled script is missing from the release" >&2
  exit 1
fi

echo "previous_current $PREVIOUS_CURRENT"
echo "release_prepared $RELEASE"
