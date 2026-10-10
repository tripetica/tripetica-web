import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAtsDistrict } from "@/lib/gps/ats-district";
import { mobileAtsBlockReason, physicalAtsEligible, selectAtsFeed } from "@/lib/gps/ats-feed";

const start = Date.parse("2026-10-10T08:28:00.000Z");
const end = Date.parse("2026-10-10T11:28:00.000Z");
const measuredAt = "2026-10-10T07:31:58.000Z";

const open = {
  physicalDeviceOnVehicle: false,
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

test("a vehicle with its own device stays on the physical feed", () => {
  assert.equal(selectAtsFeed({ ...open, physicalDeviceOnVehicle: true, nowMs: start + 20 * 60 * 1000 }), "physical");
});

test("mobile GPS uses the phone fix from inside the start window without a device switch", () => {
  assert.equal(selectAtsFeed(open), "mobile");
  assert.equal(mobileAtsBlockReason(open), null);
});

test("a fix older than two hours before the start is not sent", () => {
  const input = { ...open, measuredAt: "2026-10-10T06:00:00.000Z" };
  assert.equal(selectAtsFeed(input), "none");
  assert.equal(mobileAtsBlockReason(input), "fix_before_window");
});

test("Mobil GPS service off is a recorded block, not a device-switch block", () => {
  assert.equal(mobileAtsBlockReason({ ...open, mobileEnabled: false }), "mobile_service_off");
});

test("a phone fix an hour before the start stays eligible during the trip", () => {
  const tripStart = Date.parse("2026-10-10T08:56:00.000Z");
  const input = {
    ...open,
    measuredAt: "2026-10-10T07:51:53.000Z",
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
  assert.doesNotMatch(source, /WHERE status = 'failed'/);
});

test("physical ATS follows the live device rather than a required switch", () => {
  const source = readFileSync(new URL("./ats-run.ts", import.meta.url), "utf8");
  assert.match(source, /device\.live_source = TRUE/);
  assert.doesNotMatch(source, /settings\.enabled = TRUE/);
  assert.doesNotMatch(source, /gps_mobile|source_mobile|Mobil GPS/);
});
