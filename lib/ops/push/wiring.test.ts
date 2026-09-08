import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

test("process push fires only after a new reservation_searches insert", () => {
  const search = source("lib/booking/reservation-search.ts");
  const route = source("app/api/booking/transfer-search/route.ts");
  assert.match(search, /created = true/);
  assert.match(search, /return \{ id, created \}/);
  assert.match(route, /notifyOpsProcessCreated/);
  assert.match(route, /if \(created\)/);
  assert.doesNotMatch(source("lib/booking/edit-draft.ts"), /notifyOpsProcessCreated/);
  assert.doesNotMatch(search, /notifyOpsProcessCreated/);
});

test("reservation push fires after confirmed cash complete and paid callback", () => {
  const complete = source("app/api/booking/complete/route.ts");
  const callback = source("app/api/payments/turinvoice/callback/route.ts");
  const insert = source("lib/booking/complete-reservation.ts");
  assert.match(complete, /notifyOpsReservationConfirmed/);
  assert.match(callback, /notifyOpsReservationConfirmed/);
  assert.match(complete, /scheduleOpsPush\("reservation-confirmed"/);
  assert.doesNotMatch(insert, /notifyOpsReservationConfirmed/);
});

test("push migration is additive and does not rewrite booking tables", () => {
  const sql = source("db/migrations/030_ops_web_push.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ops_push_subscriptions/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ops_push_events/);
  assert.doesNotMatch(sql, /ALTER TABLE reservations/);
  assert.doesNotMatch(sql, /ALTER TABLE reservation_searches/);
  assert.doesNotMatch(sql, /DROP TABLE/);
});

test("partner application push fires after a successful register insert", () => {
  const register = source("lib/partner/register.ts");
  const actions = source("lib/partner/actions.ts");
  assert.match(actions, /notifyOpsPartnerApplicationCreated/);
  assert.match(actions, /scheduleOpsPush\("partner-application-created"/);
  assert.doesNotMatch(register, /notifyOpsPartnerApplicationCreated/);
  assert.match(source("lib/ops/push/dedupe.ts"), /partner_application_created/);
});

test("vehicle approval push reuses the existing ops push pipeline", () => {
  const actions = source("lib/partner/vehicle-actions.ts");
  assert.match(actions, /notifyOpsVehicleApprovalRequested/);
  assert.match(actions, /scheduleOpsPush\("partner-vehicle-approval-requested"/);
  assert.match(source("lib/ops/push/dedupe.ts"), /partner_vehicle_approval_requested/);
  assert.match(
    source("db/migrations/038_partner_vehicles.sql"),
    /partner_vehicle_approval_requested/,
  );
});

test("service worker handles push and notification click without a fetch cache", () => {
  const sw = source("public/sw.js");
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /addEventListener\("notificationclick"/);
  assert.match(sw, /openWindow/);
  assert.doesNotMatch(sw, /addEventListener\("fetch"/);
  assert.match(sw, /payload.kind === "partner"/);
  assert.match(sw, /payload.kind === "partner-job"/);
});
