import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  computeJobReleaseTimes,
  effectiveVisibleMaxRank,
} from "@/lib/partner/job-visibility";

function source(path: string) {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

test("partner job push reuses visibility release times and does not invent a clock", () => {
  const created = new Date("2026-09-07T04:00:00.000Z");
  const pickup = new Date("2026-09-07T08:00:00.000Z");
  const releases = computeJobReleaseTimes(created, pickup);
  assert.equal(releases.primary.getTime(), created.getTime());
  assert.equal(
    effectiveVisibleMaxRank({ now: created, pickupAt: pickup, createdAt: created }),
    0,
  );
  assert.equal(
    effectiveVisibleMaxRank({
      now: new Date(releases.level1.getTime() - 1),
      pickupAt: pickup,
      createdAt: created,
    }),
    0,
  );
  assert.equal(
    effectiveVisibleMaxRank({
      now: releases.level1,
      pickupAt: pickup,
      createdAt: created,
    }),
    1,
  );
  const notify = source("lib/partner/push/notify-job-release.ts");
  assert.match(notify, /effectiveVisibleMaxRank/);
  assert.match(notify, /accepted_partner_id/);
  assert.match(notify, /claimPartnerPushEvent/);
  assert.doesNotMatch(notify, /TARGET_LEVEL_1_BEFORE_START_MS/);
});

test("partner push tables are additive and separate from ops push", () => {
  const sql = source("db/migrations/040_partner_web_push.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS partner_push_subscriptions/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS partner_push_events/);
  assert.match(sql, /partner_job_released/);
  assert.match(sql, /partner_id/);
  assert.match(sql, /partner_user_id/);
  assert.doesNotMatch(sql, /ALTER TABLE reservations/);
  assert.doesNotMatch(sql, /ops_push_subscriptions/);
  assert.doesNotMatch(sql, /DROP TABLE/);
});

test("reservation confirm schedules partner job push without replacing ops push", () => {
  const complete = source("app/api/booking/complete/route.ts");
  const callback = source("app/api/payments/turinvoice/callback/route.ts");
  assert.match(complete, /notifyOpsReservationConfirmed/);
  assert.match(complete, /notifyPartnerJobVisibility/);
  assert.match(callback, /notifyOpsReservationConfirmed/);
  assert.match(callback, /notifyPartnerJobVisibility/);
  assert.doesNotMatch(source("lib/booking/complete-reservation.ts"), /notifyPartnerJobVisibility/);
});

test("service worker keeps ops kinds and adds partner-job click routing", () => {
  const sw = source("public/sw.js");
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /payload.kind === "partner"/);
  assert.match(sw, /payload.kind === "partner-job"/);
  assert.match(sw, /\/tr\/partner\/jobs/);
  assert.match(sw, /\/tr\/ops/);
  assert.doesNotMatch(sw, /addEventListener\("fetch"/);
});

test("accept confirmation uses a positive green tone only for partner jobs", () => {
  assert.match(source("components/ops/ops-confirm-dialog.tsx"), /confirmTone/);
  assert.match(source("components/partner/job-list.tsx"), /confirmTone="positive"/);
  assert.match(source("components/partner/job-detail.tsx"), /confirmTone="positive"/);
  assert.match(source("app/globals.css"), /\.ops-btn-positive/);
  assert.doesNotMatch(
    source("components/partner/driver-detail.tsx"),
    /confirmTone="positive"/,
  );
});

test("proxy and login keep partner return URLs inside the portal", () => {
  assert.match(source("proxy.ts"), /searchParams\.set\("next", pathname\)/);
  assert.match(source("lib/partner/actions.ts"), /safePartnerReturnPath/);
  assert.match(source("components/partner/login-form.tsx"), /name="next"/);
});
