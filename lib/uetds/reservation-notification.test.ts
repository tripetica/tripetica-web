import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UETDS_EMPTY_IDENTITY_PREFILL, prefillUetdsDraftFromReservation } from "@/lib/uetds/prefill";
import { uetdsReservationNotifyPath } from "@/lib/uetds/reservation-notification-state";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("existing reservation U-ETDS opens edit not a second new form", () => {
  assert.equal(
    uetdsReservationNotifyPath({
      panel: "ops",
      reservationId: "res-1",
      existingId: "uetds-1",
    }),
    "/ops/uetds/notifications/uetds-1?editMethod=1",
  );
  assert.equal(
    uetdsReservationNotifyPath({
      panel: "partner",
      reservationId: "res-1",
    }),
    "/partner/uetds/notifications/new?reservation=res-1",
  );
  assert.match(source("lib/uetds/reservation-notification.ts"), /status = ANY/);
  assert.match(source("lib/uetds/reservation-notification.ts"), /partner_id = \$3/);
  assert.match(source("lib/uetds/reservation-notification.ts"), /UETDS_ACTIVE_NOTIFICATION_STATUSES/);
});

test("060 grants production app SELECT on uetds_notifications created without GRANT in 055", () => {
  const created = source("db/migrations/055_uetds_notifications.sql");
  const grants = source("db/migrations/060_uetds_notifications_app_grants.sql");
  assert.match(created, /CREATE TABLE IF NOT EXISTS uetds_notifications/);
  assert.doesNotMatch(created, /GRANT /);
  assert.match(grants, /REVOKE ALL ON TABLE uetds_notifications FROM PUBLIC/);
  assert.match(grants, /GRANT SELECT, INSERT, UPDATE ON TABLE uetds_notifications TO tripetica_app/);
  assert.match(grants, /GRANT SELECT, INSERT, UPDATE ON TABLE uetds_notifications TO tripetica_dev_app/);
  assert.doesNotMatch(grants, /DELETE FROM|UPDATE uetds_notifications SET|DROP TABLE/i);
  const partnerDetail = source("app/[locale]/partner/(panel)/accepted/[id]/page.tsx");
  const opsDetail = source("app/[locale]/ops/(panel)/reservations/[id]/page.tsx");
  assert.match(partnerDetail, /findActiveUetdsNotificationForReservation\(\{\s*reservationId: job\.id,\s*partnerId: actor\.partnerId,/);
  assert.match(opsDetail, /findActiveUetdsNotificationForReservation\(\{\s*reservationId: item\.id\s*\}\)/);
  assert.doesNotMatch(partnerDetail, /try\s*\{[\s\S]*findActiveUetdsNotificationForReservation/);
  assert.doesNotMatch(opsDetail, /try\s*\{[\s\S]*findActiveUetdsNotificationForReservation/);
});

test("reservation identity prefill copies real values and fills empty with 11111111111", () => {
  const draft = prefillUetdsDraftFromReservation({
    reservationId: "11111111-1111-1111-1111-111111111111",
    pickupName: "Istanbul Airport (IST)",
    dropoffName: "Sisli",
    pickupAt: "2026-09-21T11:30:00.000Z",
    passengerCount: 5,
    serviceType: "transfer",
    tourCode: null,
    notes: null,
    driverId: "d1",
    vehicleId: "v1",
    driverKind: "registered",
    vehicleKind: "registered",
    passengers: [
      { firstName: "P1", lastName: "A", countryCode: "TR", identityNumber: "ABC123", gender: "male" },
      { firstName: "P2", lastName: "B", countryCode: "DE", identityNumber: "  ", gender: "female" },
      { firstName: "P3", lastName: "C", countryCode: "TR", identityNumber: "XYZ789", gender: "male" },
    ],
  });
  assert.equal(draft.passengers.length, 5);
  assert.equal(draft.passengers[0]?.identityNumber, "ABC123");
  assert.equal(draft.passengers[1]?.identityNumber, UETDS_EMPTY_IDENTITY_PREFILL);
  assert.equal(draft.passengers[2]?.identityNumber, "XYZ789");
  assert.equal(draft.passengers[3]?.identityNumber, UETDS_EMPTY_IDENTITY_PREFILL);
  assert.equal(draft.passengers[4]?.identityNumber, UETDS_EMPTY_IDENTITY_PREFILL);
  assert.notEqual(draft.passengers[0]?.identityNumber, UETDS_EMPTY_IDENTITY_PREFILL);
});
