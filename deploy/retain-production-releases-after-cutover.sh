#!/bin/bash
# Post-cutover release retention. Call ONLY after current already points at the
# new release AND smoke/health succeeded. Does not switch current, restart
# services, migrate, or roll back if cleanup fails.
#
# Usage:
#   deploy/retain-production-releases-after-cutover.sh \
#     --cutover-confirmed \
#     --expected-current /srv/tripetica/releases/NEW \
#     [--rollback /srv/tripetica/releases/PREV] \
#     [--releases-root /srv/tripetica/releases] \
#     [--current-symlink /srv/tripetica/current] \
#     [--health-command "systemctl is-active tripetica-prod.service"] \
#     [--dry-run]
set -euo pipefail

usage() {
  echo "usage: deploy/retain-production-releases-after-cutover.sh --cutover-confirmed --expected-current DIR [--rollback DIR] [--releases-root DIR] [--current-symlink PATH] [--health-command CMD] [--dry-run]" >&2
}

CUTOVER_CONFIRMED=0
EXPECTED_CURRENT=""
ROLLBACK=""
RELEASES_ROOT=/srv/tripetica/releases
CURRENT_SYMLINK=/srv/tripetica/current
HEALTH_COMMAND="systemctl is-active tripetica-prod.service"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cutover-confirmed)
      CUTOVER_CONFIRMED=1
      shift
      ;;
    --expected-current)
      EXPECTED_CURRENT="${2:-}"
      shift 2
      ;;
    --rollback)
      ROLLBACK="${2:-}"
      shift 2
      ;;
    --releases-root)
      RELEASES_ROOT="${2:-}"
      shift 2
      ;;
    --current-symlink)
      CURRENT_SYMLINK="${2:-}"
      shift 2
      ;;
    --health-command)
      HEALTH_COMMAND="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

HELPER=$(readlink -f "$(dirname "$0")/cleanup-old-production-releases.sh")

skip() {
  echo "release_retention_skipped: $*" >&2
  echo "no_releases_deleted" >&2
  exit 2
}

if [[ "$CUTOVER_CONFIRMED" -ne 1 ]]; then
  skip "cutover not confirmed (build/test/cutover/health must succeed first)"
fi
if [[ -z "$EXPECTED_CURRENT" ]]; then
  usage
  exit 2
fi

expected=$(readlink -f "$EXPECTED_CURRENT" || true)
live=$(readlink -f "$CURRENT_SYMLINK" || true)
if [[ -z "$expected" || ! -d "$expected" ]]; then
  skip "expected current is missing: $EXPECTED_CURRENT"
fi
if [[ -z "$live" || "$live" != "$expected" ]]; then
  skip "live current is not the expected new release: live=${live:-missing} expected=$expected"
fi

if [[ -z "$ROLLBACK" ]]; then
  previous_file="$expected/.deploy-previous-current"
  if [[ ! -f "$previous_file" ]]; then
    skip "rollback not provided and $previous_file is missing"
  fi
  ROLLBACK=$(tr -d '\n' <"$previous_file")
fi

if ! bash -c "$HEALTH_COMMAND"; then
  skip "health/smoke command failed; rollback capability left intact"
fi

args=(
  --releases-root "$RELEASES_ROOT"
  --current "$expected"
  --rollback "$ROLLBACK"
  --current-symlink "$CURRENT_SYMLINK"
)
if [[ "$DRY_RUN" -eq 1 ]]; then
  args+=(--dry-run)
fi

if ! "$HELPER" "${args[@]}"; then
  echo "release_retention_failed; production current left running; no service rollback performed" >&2
  exit 1
fi
