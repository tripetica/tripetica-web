import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planMobileAts, planMobileAtsReplay } from "@/lib/gps/mobile-ats";
import { driverGapCopy, mobileGapAlert, mobileReminderSlot, ownerIsDriver, reminderTargets } from "@/lib/gps/mobile-reminders";
import { shareEventPresentation, shareHistoryWindow } from "@/lib/gps/share-history";
import { acceptMobilePoint, emailsMatch, mobileFixFresh, mobileShareAllowed } from "@/lib/gps/mobile";
import { gpsSpeedKmSa, mobileDisplaySpeedMps, resolveMobileSpeed, shouldStoreMobilePoint } from "@/lib/gps/mobile-speed";
import { selectedServiceTotal, serviceSubscriptionNames } from "@/lib/uetds/service-subscriptions";

test("checked services form the monthly total", () => {
  assert.equal(selectedServiceTotal({
    standardEnabled: true,
    standardFee: 3,
    advancedEnabled: true,
    advancedFee: 4,
    mobileEnabled: true,
    mobileFee: 5,
  }), 12);
  assert.equal(selectedServiceTotal({
    standardEnabled: false,
    standardFee: 9,
    advancedEnabled: false,
    advancedFee: 9,
    mobileEnabled: false,
    mobileFee: 9,
  }), null);
});

test("subscription names hide the old membership labels", () => {
  const names = serviceSubscriptionNames({
    standardEnabled: true,
    advancedEnabled: true,
    mobileEnabled: false,
  }, {
    standard: "Standart Bildirim",
    advanced: "Gelişmiş Bildirim",
    mobile: "Mobil GPS",
    none: "Abonelik yok",
  });
  assert.equal(names, "Standart Bildirim, Gelişmiş Bildirim");
});

test("mobile sharing needs one active subscribed driver", () => {
  const open = { subscriptionOpen: true };
  assert.equal(mobileShareAllowed({ matches: 1, driverActive: true, mobileEnabled: true, isOwner: true, ...open }), true);
  assert.equal(mobileShareAllowed({ matches: 2, driverActive: true, mobileEnabled: true, isOwner: true, ...open }), false);
  assert.equal(mobileShareAllowed({ matches: 1, driverActive: false, mobileEnabled: true, isOwner: true, ...open }), false);
  assert.equal(mobileShareAllowed({ matches: 1, driverActive: true, mobileEnabled: false, isOwner: true, ...open }), false);
  assert.equal(mobileShareAllowed({ matches: 1, driverActive: true, mobileEnabled: true, isOwner: false, ...open }), false);
  assert.equal(mobileShareAllowed({ matches: 1, driverActive: true, mobileEnabled: true, isOwner: true, subscriptionOpen: false }), false);
  assert.equal(emailsMatch(" Mehmet@Trip.com ", "mehmet@trip.com"), true);
});

test("mobile points stay real and fresh", () => {
  const now = Date.parse("2026-10-10T02:00:00Z");
  assert.equal(acceptMobilePoint({
    latitude: 39.9,
    longitude: 32.8,
    recordedAt: "2026-10-10T01:59:00Z",
    accuracyM: 12,
    now,
  }), true);
  assert.equal(acceptMobilePoint({
    latitude: 39.9,
    longitude: 32.8,
    recordedAt: "2026-10-09T00:00:00Z",
    accuracyM: 12,
    now,
  }), false);
  assert.equal(mobileFixFresh("2026-10-10T01:59:00Z", now), true);
  assert.equal(mobileFixFresh("2026-10-10T01:00:00Z", now), false);
});

test("mobile ATS stays closed until a verified test endpoint exists", () => {
  const plan = planMobileAts({
    runtime: "development",
    testEndpointVerified: false,
    subscriptionEnabled: true,
    driverActive: true,
    vehicleId: "vehicle",
    plate: "34 TEST 01",
    companyName: "SEARCH TRAVEL",
    tripId: "trip",
    fixRecordedAt: "2026-10-10T02:00:00Z",
    physicalReportSent: false,
  });
  assert.equal(plan.send, false);
  assert.equal(planMobileAts({ ...{
    runtime: "production",
    testEndpointVerified: true,
    subscriptionEnabled: true,
    driverActive: true,
    vehicleId: "vehicle",
    plate: "34 TEST 01",
    companyName: "SEARCH TRAVEL",
    tripId: "trip",
    fixRecordedAt: "2026-10-10T02:00:00Z",
    physicalReportSent: false,
  } }).reason, "production_physical_source_only");
});

test("mobile ATS eligibility is two hours before the trip start and then keeps the last real fix", () => {
  const start = Date.parse("2026-10-10T15:03:00Z");
  const end = Date.parse("2026-10-10T18:03:00Z");
  const base = { tripStartMs: start, tripEndMs: end, vehicleMatches: true, driverMatches: true, companyMatches: true };
  const tooEarly = planMobileAtsReplay({
    ...base,
    nowMs: start,
    measuredAt: "2026-10-10T12:03:00Z",
  });
  assert.equal(tooEarly.send, false);
  assert.equal(tooEarly.eligible, false);
  assert.equal(tooEarly.decision, "reject_before_window");
  const inside = planMobileAtsReplay({
    ...base,
    nowMs: start,
    measuredAt: "2026-10-10T14:45:00Z",
  });
  assert.equal(inside.eligible, true);
  assert.equal(inside.decision, "use_last");
  assert.equal(inside.measuredAt, "2026-10-10T14:45:00Z");
  const later = planMobileAtsReplay({
    ...base,
    nowMs: start + 3 * 60 * 60 * 1000 - 60_000,
    measuredAt: "2026-10-10T14:45:00Z",
  });
  assert.equal(later.eligible, true);
  assert.equal(later.decision, "use_last");
  const recovered = planMobileAtsReplay({
    ...base,
    nowMs: start + 10 * 60 * 1000,
    measuredAt: new Date(start + 9 * 60 * 1000).toISOString(),
  });
  assert.equal(recovered.eligible, true);
  assert.equal(planMobileAtsReplay({ ...base, nowMs: start, measuredAt: null }).decision, "reject_missing");
  assert.equal(planMobileAtsReplay({ ...base, nowMs: start - 1, measuredAt: "2026-10-10T14:45:00Z" }).decision, "reject_trip");
  assert.equal(planMobileAtsReplay({ ...base, nowMs: end, measuredAt: "2026-10-10T14:45:00Z" }).decision, "reject_trip");
  assert.equal(planMobileAtsReplay({ ...base, nowMs: start, measuredAt: "2026-10-10T14:45:00Z", vehicleMatches: false }).decision, "reject_mismatch");
});

test("trip reminders follow the thirty minute clock and do not duplicate the owner", () => {
  const start = Date.parse("2026-10-10T06:00:00Z");
  const end = start + 2 * 60 * 60 * 1000;
  assert.equal(mobileReminderSlot({ startMs: start, endMs: end, nowMs: start - 31 * 60 * 1000 }), null);
  assert.equal(mobileReminderSlot({ startMs: start, endMs: end, nowMs: start - 30 * 60 * 1000 }), start - 30 * 60 * 1000);
  assert.equal(mobileReminderSlot({ startMs: start, endMs: end, nowMs: start - 17 * 60 * 1000 }), start - 20 * 60 * 1000);
  assert.equal(mobileReminderSlot({ startMs: start, endMs: end, nowMs: start - 5 * 60 * 1000 }), start - 5 * 60 * 1000);
  assert.equal(mobileReminderSlot({ startMs: start, endMs: end, nowMs: start + 5 * 60 * 1000 }), start + 5 * 60 * 1000);
  assert.equal(mobileReminderSlot({ startMs: start, endMs: end, nowMs: end }), null);
  assert.equal(ownerIsDriver({ driverEmail: "A@B.com", ownerEmail: "a@b.com" }), true);
  assert.deepEqual(reminderTargets({ ownerIsDriver: true }).map((item) => `${item.audience}:${item.channel}`), ["driver:push", "driver:email"]);
  assert.deepEqual(reminderTargets({ ownerIsDriver: false }).map((item) => `${item.audience}:${item.channel}`), ["driver:push", "owner:push", "owner:email"]);
});

test("a ten minute gap alerts once per outage and stays quiet during the grace period", () => {
  const now = Date.parse("2026-10-10T08:00:00Z");
  assert.equal(mobileGapAlert({ shareEnabled: true, lastReceivedAtMs: now - 9 * 60 * 1000, nowMs: now, tripOpen: true }).send, false);
  const due = mobileGapAlert({ shareEnabled: true, lastReceivedAtMs: now - 10 * 60 * 1000, nowMs: now, tripOpen: true });
  assert.equal(due.send, true);
  if (due.send) assert.equal(due.anchorMs, now - 10 * 60 * 1000);
  assert.equal(mobileGapAlert({ shareEnabled: false, lastReceivedAtMs: now - 20 * 60 * 1000, nowMs: now, tripOpen: true }).send, false);
  assert.equal(mobileGapAlert({ shareEnabled: true, lastReceivedAtMs: null, nowMs: now, tripOpen: true }).send, false);
  assert.equal(mobileGapAlert({ shareEnabled: true, lastReceivedAtMs: now - 20 * 60 * 1000, nowMs: now, tripOpen: false }).send, false);
  assert.match(driverGapCopy({ plate: "06TARIFESIZ123", lastFix: "10.10.2026 07:13" }).body, /10 dakikadır/);
  assert.doesNotMatch(driverGapCopy({ plate: "06TARIFESIZ123", lastFix: "10.10.2026 07:13" }).body, /internet kesildi|izin reddedildi|telefon hatası/);
});

test("share history keeps known causes and whole days", () => {
  assert.equal(shareEventPresentation("stream_lost")?.label, "Konum akışı kesildi");
  assert.equal(shareEventPresentation("stopped")?.icon, "■");
  assert.equal(shareEventPresentation("mystery"), null);
  const week = shareHistoryWindow({ preset: "week", now: new Date("2026-10-10T06:00:00Z") });
  assert.equal("error" in week, false);
  if (!("error" in week)) {
    assert.equal(week.from.toISOString(), "2026-10-04T21:00:00.000Z");
  }
});

test("mobile speed uses a browser reading and does not average across a gap", () => {
  const previous = { at: 0, latitude: 41, longitude: 29, accuracyM: 8 };
  const moved = { at: 5000, latitude: 41.00036, longitude: 29, accuracyM: 8 };
  assert.equal(resolveMobileSpeed({ reportedMps: 11.6, previous, current: moved }).source, "measured");
  const estimated = resolveMobileSpeed({ reportedMps: null, previous, current: moved });
  assert.equal(estimated.source, "estimated");
  assert.ok(estimated.speedMps != null && estimated.speedMps > 6 && estimated.speedMps < 10);
  assert.equal(resolveMobileSpeed({
    reportedMps: null,
    previous,
    current: { at: 4000, latitude: 41.00002, longitude: 29, accuracyM: 8 },
  }).speedMps, 0);
  assert.equal(resolveMobileSpeed({
    reportedMps: null,
    previous,
    current: { at: 10 * 60 * 1000, latitude: 41.02, longitude: 29, accuracyM: 8 },
  }).speedMps, null);
  assert.equal(resolveMobileSpeed({ reportedMps: -1, previous: null, current: moved }).speedMps, null);
  assert.equal(shouldStoreMobilePoint({ previous, current: { ...moved, at: 1000 }, reportedMps: null }), false);
  assert.equal(shouldStoreMobilePoint({ previous, current: moved, reportedMps: null }), true);
  assert.equal(shouldStoreMobilePoint({
    previous,
    current: { at: 2000, latitude: 41.02, longitude: 29, accuracyM: 8 },
    reportedMps: null,
  }), false);
  assert.equal(mobileDisplaySpeedMps({ motion: "unknown", speedMps: 10 }), null);
  assert.equal(mobileDisplaySpeedMps({ motion: "still", speedMps: 10 }), 0);
  assert.equal(mobileDisplaySpeedMps({ motion: "moving", speedMps: 11.6 }), 11.6);
  assert.equal(gpsSpeedKmSa(11.6), "42 km/sa");
});

test("physical ATS dispatch does not read mobile GPS", () => {
  const source = readFileSync(new URL("./ats-run.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /gps_mobile|source_mobile|Mobil GPS/);
});
