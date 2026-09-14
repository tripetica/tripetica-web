#!/bin/bash
# Fail-safe retention helper for immutable production releases.
# Keep only CURRENT + ROLLBACK under a releases root. Never switches current,
# never restarts services, never touches backups/repo/env.
#
# Usage:
#   deploy/cleanup-old-production-releases.sh \
#     --releases-root /srv/tripetica/releases \
#     --current /srv/tripetica/releases/NEW \
#     --rollback /srv/tripetica/releases/PREV \
#     [--current-symlink /srv/tripetica/current] \
#     [--dry-run] [--no-live-check]
set -euo pipefail

usage() {
  echo "usage: deploy/cleanup-old-production-releases.sh --releases-root DIR --current DIR --rollback DIR [--current-symlink PATH] [--dry-run] [--no-live-check]" >&2
}

RELEASES_ROOT=""
CURRENT=""
ROLLBACK=""
CURRENT_SYMLINK=""
DRY_RUN=0
LIVE_CHECK=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --releases-root)
      RELEASES_ROOT="${2:-}"
      shift 2
      ;;
    --current)
      CURRENT="${2:-}"
      shift 2
      ;;
    --rollback)
      ROLLBACK="${2:-}"
      shift 2
      ;;
    --current-symlink)
      CURRENT_SYMLINK="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --no-live-check)
      LIVE_CHECK=0
      shift
      ;;
    -h|--help)
      usage
      exit 1
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

abort() {
  echo "release_retention_abort: $*" >&2
  echo "no_releases_deleted" >&2
  exit 2
}

if [[ -z "$RELEASES_ROOT" || -z "$CURRENT" || -z "$ROLLBACK" ]]; then
  usage
  exit 2
fi

if [[ ! -d "$RELEASES_ROOT" ]]; then
  abort "releases root is not a directory: $RELEASES_ROOT"
fi

releases_root=$(readlink -f "$RELEASES_ROOT")
current=$(readlink -f "$CURRENT" || true)
rollback=$(readlink -f "$ROLLBACK" || true)

if [[ -z "$current" || ! -d "$current" ]]; then
  abort "current release is missing or not a directory: $CURRENT"
fi
if [[ -z "$rollback" || ! -d "$rollback" ]]; then
  abort "rollback release is missing or not a directory: $ROLLBACK"
fi
if [[ "$current" == "$rollback" ]]; then
  abort "current and rollback resolve to the same path: $current"
fi
if [[ "$current" != "$releases_root"/* ]]; then
  abort "current is outside releases root: $current"
fi
if [[ "$rollback" != "$releases_root"/* ]]; then
  abort "rollback is outside releases root: $rollback"
fi

protected_prefix_ok() {
  local path="$1"
  case "$path" in
    /var/backups|/var/backups/*|/root/tripetica-web|/root/tripetica-web/*|/etc|/etc/*)
      return 1
      ;;
  esac
  return 0
}

if ! protected_prefix_ok "$current" || ! protected_prefix_ok "$rollback" || ! protected_prefix_ok "$releases_root"; then
  abort "refusing protected path as current/rollback/releases-root"
fi

if [[ "$LIVE_CHECK" -eq 1 ]]; then
  if [[ -z "$CURRENT_SYMLINK" ]]; then
    abort "live check requires --current-symlink"
  fi
  if [[ ! -L "$CURRENT_SYMLINK" && ! -e "$CURRENT_SYMLINK" ]]; then
    abort "current symlink is missing: $CURRENT_SYMLINK"
  fi
  live=$(readlink -f "$CURRENT_SYMLINK" || true)
  if [[ -z "$live" || "$live" != "$current" ]]; then
    abort "live current mismatch: symlink=$CURRENT_SYMLINK resolved=${live:-missing} expected=$current"
  fi
fi

mapfile -t all_releases < <(find "$releases_root" -mindepth 1 -maxdepth 1 \( -type d -o -type l \) | sort)
DELETE=()
for dir in "${all_releases[@]}"; do
  resolved=$(readlink -f "$dir" || true)
  if [[ -z "$resolved" || ! -d "$resolved" ]]; then
    abort "cannot resolve release directory: $dir"
  fi
  if [[ "$resolved" != "$releases_root"/* ]]; then
    abort "release path escaped releases root: $dir -> $resolved"
  fi
  if ! protected_prefix_ok "$resolved"; then
    abort "refusing protected release path: $resolved"
  fi
  if [[ "$resolved" == "$current" || "$resolved" == "$rollback" ]]; then
    continue
  fi
  DELETE+=("$resolved")
done

for candidate in "${DELETE[@]+"${DELETE[@]}"}"; do
  if [[ "$candidate" == "$current" || "$candidate" == "$rollback" ]]; then
    abort "current or rollback entered the delete list: $candidate"
  fi
  if [[ "$candidate" != "$releases_root"/* ]]; then
    abort "delete candidate is outside releases root: $candidate"
  fi
  if ! protected_prefix_ok "$candidate"; then
    abort "delete candidate is a protected path: $candidate"
  fi
done

echo "release_retention_current=$current"
echo "release_retention_rollback=$rollback"
echo "release_retention_delete_count=${#DELETE[@]}"

if [[ "${#DELETE[@]}" -eq 0 ]]; then
  echo "release_retention_ok nothing_to_delete"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  for candidate in "${DELETE[@]}"; do
    echo "would_delete $candidate"
  done
  echo "release_retention_dry_run_ok"
  exit 0
fi

deleted=0
for candidate in "${DELETE[@]}"; do
  if [[ "$candidate" == "$current" || "$candidate" == "$rollback" ]]; then
    abort "current or rollback entered the delete list immediately before rm: $candidate"
  fi
  if [[ "$candidate" != "$releases_root"/* ]]; then
    abort "delete candidate left releases root immediately before rm: $candidate"
  fi
  echo "deleting $candidate"
  rm -rf --one-file-system -- "$candidate"
  if [[ -e "$candidate" ]]; then
    echo "release_retention_error: failed to remove $candidate" >&2
    echo "production current was not changed; no service rollback performed" >&2
    exit 1
  fi
  deleted=$((deleted + 1))
done

remaining=0
for dir in "$releases_root"/*; do
  [[ -d "$dir" ]] || continue
  remaining=$((remaining + 1))
done
if [[ "$remaining" -ne 2 ]]; then
  echo "release_retention_error: expected 2 remaining releases, found $remaining" >&2
  echo "production current was not changed; no service rollback performed" >&2
  exit 1
fi
if [[ ! -d "$current" || ! -d "$rollback" ]]; then
  echo "release_retention_error: current or rollback missing after cleanup" >&2
  echo "production current was not changed; no service rollback performed" >&2
  exit 1
fi

echo "release_retention_ok deleted=$deleted"
