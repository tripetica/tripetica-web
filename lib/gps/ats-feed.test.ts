import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAtsDistrict } from "@/lib/gps/ats-district";
import { mobileAtsBlockReason, physicalAtsEligible, selectAtsFeed } from "@/lib/gps/ats-feed";

const start = Date.parse("2026-10-10T08:28:00.000Z");
const end = Date.parse("2026-10-10T11:28:00.000Z");
const measuredAt = "2026-10-10T07:31:58.000Z";

const open = {
  source: "mobile" as const,
  gpsAtsEnabled: true,
  mobileEnabled: true,
  subscriptionOpen: true,
  measuredAt,
  nowMs: start + 21 * 60 * 1000,
  tripStartMs: start,
  tripEndMs: end,
  vehicleMatches: true,
  driverMatches: true,
  companyMatches: true,
};

test("the selected ministry source is the only feed, with no device fallback", () => {
  assert.equal(selectAtsFeed({ ...open, source: "physical", nowMs: start + 20 * 60 * 1000 }), "physical");
  assert.equal(selectAtsFeed({ ...open, source: "mobile", gpsAtsEnabled: true }), "mobile");
  assert.equal(selectAtsFeed({ ...open, source: "none" }), "none");
  assert.equal(selectAtsFeed({ ...open, source: "physical", gpsAtsEnabled: false }), "none");
  assert.equal(selectAtsFeed({ ...open, source: "mobile", mobileEnabled: false }), "none");
});

test("mobile GPS uses the phone fix from inside the start window without a device switch", () => {
  assert.equal(selectAtsFeed(open), "mobile");
  assert.equal(mobileAtsBlockReason(open), null);
});

test("a fix sixty-one minutes before the start is not sent", () => {
  const input = { ...open, measuredAt: "2026-10-10T07:26:59.000Z" };
  assert.equal(selectAtsFeed(input), "none");
  assert.equal(mobileAtsBlockReason(input), "fix_before_window");
  assert.equal(selectAtsFeed({ ...open, measuredAt: "2026-10-10T07:28:00.000Z" }), "mobile");
});

test("Mobil GPS service off is a recorded block, not a device-switch block", () => {
  assert.equal(mobileAtsBlockReason({ ...open, mobileEnabled: false }), "mobile_service_off");
});

test("a phone fix an hour before the start stays eligible during the trip", () => {
  const tripStart = Date.parse("2026-10-10T08:56:00.000Z");
  const input = {
    ...open,
    measuredAt: "2026-10-10T07:56:00.000Z",
    nowMs: Date.parse("2026-10-10T09:10:00.000Z"),
    tripStartMs: tripStart,
    tripEndMs: Date.parse("2026-10-10T10:55:00.000Z"),
  };
  assert.equal(selectAtsFeed(input), "mobile");
});

test("stored phone coordinates for the open fleet resolve a district", () => {
  assert.equal(resolveAtsDistrict(41.07219, 28.92029).ok, true);
  assert.equal(resolveAtsDistrict(41.25865, 28.74148).ok, true);
  assert.equal(resolveAtsDistrict(41.09811, 28.86339).ok, true);
});

test("a live device is the physical ATS source without a switch row", () => {
  assert.equal(physicalAtsEligible({
    deviceActive: true,
    liveSource: true,
    assignedToVehicle: true,
    explicitSwitchOff: false,
  }), true);
  assert.equal(physicalAtsEligible({
    deviceActive: true,
    liveSource: false,
    assignedToVehicle: true,
    explicitSwitchOff: false,
  }), false);
  assert.equal(physicalAtsEligible({
    deviceActive: true,
    liveSource: true,
    assignedToVehicle: true,
    explicitSwitchOff: true,
  }), false);
});

test("closing the month or the Mobil GPS service blocks the next cycle", () => {
  assert.equal(mobileAtsBlockReason({ ...open, subscriptionOpen: false }), "subscription_closed");
  assert.equal(mobileAtsBlockReason({ ...open, mobileEnabled: false }), "mobile_service_off");
});

test("a subscription opened during the trip uses the stored fix on the next cycle", () => {
  assert.equal(selectAtsFeed({ ...open, nowMs: start + 40 * 60 * 1000 }), "mobile");
});

test("mobile ATS is not limited to one plate and a failed slot does not block the next one", () => {
  const source = readFileSync(new URL("./ats-mobile-dispatch.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /34EGP847|34BGN938|34BZC564|gps_ats_settings/);
  assert.match(source, /ON CONFLICT \(vehicle_id, period_slot\)/);
  assert.match(source, /gps_mobile_ats_submission_notifications/);
  assert.equal(source.split("postAtsKonumBildir(").length - 1, 1);
  assert.doesNotMatch(source, /WHERE status = 'failed'/);
  const history = readFileSync(new URL("./ats-history.ts", import.meta.url), "utf8");
  assert.match(history, /gps_mobile_ats_submission_notifications/);
  assert.match(history, /NOT EXISTS/);
  const migration = readFileSync(new URL("../../db/migrations/093_mobile_ats_submission_notifications.sql", import.meta.url), "utf8");
  assert.match(migration, /PRIMARY KEY \(submission_id, notification_id\)/);
  assert.doesNotMatch(migration, /DELETE FROM gps_mobile_ats_submissions|UPDATE gps_mobile_ats_submissions/);
});

test("physical ATS reads the live device only when that source is selected", () => {
  const source = readFileSync(new URL("./ats-run.ts", import.meta.url), "utf8");
  assert.match(source, /device\.live_source = TRUE/);
  assert.match(source, /ats_ministry_source = 'physical'/);
  assert.match(source, /chooseAtsFixForTrips/);
  assert.match(source, /gps_ats_submission_notifications/);
  assert.doesNotMatch(source, /settings\.enabled = TRUE/);
  assert.doesNotMatch(source, /gps_mobile_positions|source_mobile|Mobil GPS/);
});
