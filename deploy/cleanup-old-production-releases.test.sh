#!/bin/bash
# Safe fixture tests. Never touches /srv/tripetica/releases.
set -euo pipefail

ROOT=$(readlink -f "$(dirname "$0")")
HELPER="$ROOT/cleanup-old-production-releases.sh"
RETAIN="$ROOT/retain-production-releases-after-cutover.sh"
WORKDIR=$(mktemp -d /tmp/tripetica-release-retention-test.XXXXXX)
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

make_release() {
  local dir="$1"
  mkdir -p "$dir/app"
  echo "$dir" >"$dir/marker"
}

releases="$WORKDIR/releases"
mkdir -p "$releases"
A="$releases/A-old-rollback"
B="$releases/B-current"
C="$releases/C-new"
make_release "$A"
make_release "$B"
make_release "$C"
ln -sfn "$B" "$WORKDIR/current"

# 1. Successful C: keep C+B, delete A
ln -sfn "$C" "$WORKDIR/current"
printf '%s\n' "$B" >"$C/.deploy-previous-current"
"$HELPER" \
  --releases-root "$releases" \
  --current "$C" \
  --rollback "$B" \
  --current-symlink "$WORKDIR/current" \
  --dry-run | grep -q "would_delete $A" || fail "scenario 1 dry-run should select A"
"$HELPER" \
  --releases-root "$releases" \
  --current "$C" \
  --rollback "$B" \
  --current-symlink "$WORKDIR/current"
[[ -d "$A" ]] && fail "scenario 1 should delete A"
[[ -d "$B" && -d "$C" ]] || fail "scenario 1 should keep B and C"
[[ "$(readlink -f "$WORKDIR/current")" == "$C" ]] || fail "scenario 1 current changed"
pass "1 successful C keeps C+B and deletes A"

# 2. Build fail: helper is not invoked; A/B/C remain
make_release "$A"
ln -sfn "$B" "$WORKDIR/current"
if "$RETAIN" \
  --expected-current "$C" \
  --rollback "$B" \
  --releases-root "$releases" \
  --current-symlink "$WORKDIR/current" \
  --health-command true >/tmp/tripetica-retention-s2.out 2>/tmp/tripetica-retention-s2.err; then
  fail "scenario 2 should skip without --cutover-confirmed"
fi
[[ -d "$A" && -d "$B" && -d "$C" ]] || fail "scenario 2 deleted a release"
pass "2 build/cutover unconfirmed: no cleanup"

# 3. Health fail after cutover: no cleanup
ln -sfn "$C" "$WORKDIR/current"
if "$RETAIN" \
  --cutover-confirmed \
  --expected-current "$C" \
  --rollback "$B" \
  --releases-root "$releases" \
  --current-symlink "$WORKDIR/current" \
  --health-command false >/tmp/tripetica-retention-s3.out 2>/tmp/tripetica-retention-s3.err; then
  fail "scenario 3 should skip on health failure"
fi
[[ -d "$A" && -d "$B" && -d "$C" ]] || fail "scenario 3 deleted a release"
pass "3 health fail: no cleanup"

# 4. Live current mismatch: symlink still at B while caller claims C is current.
ln -sfn "$B" "$WORKDIR/current"
if "$HELPER" \
  --releases-root "$releases" \
  --current "$C" \
  --rollback "$B" \
  --current-symlink "$WORKDIR/current" >/tmp/tripetica-retention-s4.out 2>/tmp/tripetica-retention-s4.err; then
  fail "scenario 4 should abort on live current mismatch"
fi
[[ -d "$A" && -d "$B" && -d "$C" ]] || fail "scenario 4 deleted a release"
pass "4 current mismatch: abort"

# 5. Missing rollback
rm -rf "$A"
if "$HELPER" \
  --releases-root "$releases" \
  --current "$C" \
  --rollback "$A" \
  --current-symlink "$WORKDIR/current" \
  --no-live-check >/tmp/tripetica-retention-s5.out 2>/tmp/tripetica-retention-s5.err; then
  fail "scenario 5 should abort when rollback is missing"
fi
[[ -d "$B" && -d "$C" ]] || fail "scenario 5 deleted a kept release"
pass "5 missing rollback: abort"

# 6. Escape path via symlink candidate
make_release "$A"
outside="$WORKDIR/outside"
mkdir -p "$outside"
ln -sfn "$outside" "$releases/escaped"
ln -sfn "$C" "$WORKDIR/current"
if "$HELPER" \
  --releases-root "$releases" \
  --current "$C" \
  --rollback "$B" \
  --current-symlink "$WORKDIR/current" >/tmp/tripetica-retention-s6.out 2>/tmp/tripetica-retention-s6.err; then
  fail "scenario 6 should abort on escaped path"
fi
[[ -d "$A" && -d "$B" && -d "$C" && -d "$outside" ]] || fail "scenario 6 deleted unexpectedly"
[[ -e "$releases/escaped" ]] || fail "scenario 6 should not delete after abort"
pass "6 escaped path: abort"

# 7. current/rollback cannot be deleted even if listing is hostile
# Re-run successful path first to have a clean 3-dir set without escaped symlink.
rm -f "$releases/escaped"
ln -sfn "$C" "$WORKDIR/current"
# Passing current as rollback-equal is already abort; simulate delete-list protection
# by asking helper to keep C+B and verifying it refuses if we pass current==rollback.
if "$HELPER" \
  --releases-root "$releases" \
  --current "$C" \
  --rollback "$C" \
  --current-symlink "$WORKDIR/current" >/tmp/tripetica-retention-s7.out 2>/tmp/tripetica-retention-s7.err; then
  fail "scenario 7 should abort when current equals rollback"
fi
[[ -d "$A" && -d "$B" && -d "$C" ]] || fail "scenario 7 deleted a release"
pass "7 current/rollback identity: abort"

# Successful retain wrapper after health
"$RETAIN" \
  --cutover-confirmed \
  --expected-current "$C" \
  --rollback "$B" \
  --releases-root "$releases" \
  --current-symlink "$WORKDIR/current" \
  --health-command true
[[ ! -d "$A" ]] || fail "wrapper should delete A after confirmed cutover"
[[ -d "$B" && -d "$C" ]] || fail "wrapper should keep B and C"
pass "wrapper confirmed cutover + health deletes only A"

echo ALL_RETENTION_TESTS_PASSED
