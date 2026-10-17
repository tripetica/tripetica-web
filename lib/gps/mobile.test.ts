import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planMobileAts, planMobileAtsReplay } from "@/lib/gps/mobile-ats";
import { driverReminderCopy, mobileReminderDue, mobileReminderRuntimeAllowed, mobileReminderSlot, mobileShareHeard, overlappingTripReminderBlocks, ownerIsDriver, ownerReminderCopy, recentReminderBlocks, reminderPushSources, reminderTargets, uniquePushEndpoints } from "@/lib/gps/mobile-reminders";
import { shareEventPresentation, shareHistoryWindow } from "@/lib/gps/share-history";
import { acceptMobilePoint, emailsMatch, mobileFixFresh, mobileShareAllowed, mobileShareForeignLive, mobileShareStartDecision } from "@/lib/gps/mobile";
import { gpsSpeedKmSa, mobileDisplaySpeedMps, resolveMobileSpeed, shouldStoreMobilePoint } from "@/lib/gps/mobile-speed";
import { selectedServiceTotal, serviceSubscriptionNames } from "@/lib/uetds/service-subscriptions";

test("checked services form the monthly total", () => {
  assert.equal(selectedServiceTotal({
    standardEnabled: true,
    standardFee: 3,
    advancedEnabled: true,
    advancedFee: 4,
    gpsAtsEnabled: false,
    gpsAtsFee: null,
    mobileEnabled: true,
    mobileFee: 5,
  }), 12);
  assert.equal(selectedServiceTotal({
    standardEnabled: false,
    standardFee: 9,
    advancedEnabled: false,
    advancedFee: 9,
    gpsAtsEnabled: false,
    gpsAtsFee: 5,
    mobileEnabled: false,
    mobileFee: 9,
  }), null);
  assert.equal(selectedServiceTotal({
    standardEnabled: false,
    standardFee: null,
    advancedEnabled: false,
    advancedFee: null,
    gpsAtsEnabled: true,
    gpsAtsFee: 5,
    mobileEnabled: false,
    mobileFee: null,
  }), 5);
});

test("subscription names hide the old membership labels", () => {
  const names = serviceSubscriptionNames({
    standardEnabled: true,
    advancedEnabled: true,
    gpsAtsEnabled: false,
    mobileEnabled: false,
  }, {
    standard: "Standart Bildirim",
    advanced: "Gelişmiş Bildirim",
    gpsAts: "GPS – ATS",
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

test("mobile ATS eligibility is sixty minutes before the trip start and then keeps the last real fix", () => {
  const start = Date.parse("2026-10-10T15:03:00Z");
  const end = Date.parse("2026-10-10T18:03:00Z");
  const minute = 60 * 1000;
  const base = { tripStartMs: start, tripEndMs: end, vehicleMatches: true, driverMatches: true, companyMatches: true };
  const tooEarly = planMobileAtsReplay({
    ...base,
    nowMs: start,
    measuredAt: new Date(start - 61 * minute).toISOString(),
  });
  assert.equal(tooEarly.send, false);
  assert.equal(tooEarly.eligible, false);
  assert.equal(tooEarly.decision, "reject_before_window");
  const opening = planMobileAtsReplay({
    ...base,
    nowMs: start,
    measuredAt: new Date(start - 60 * minute).toISOString(),
  });
  assert.equal(opening.eligible, true);
  assert.equal(opening.decision, "use_last");
  const halfHour = planMobileAtsReplay({
    ...base,
    nowMs: start + 30 * minute,
    measuredAt: new Date(start - 30 * minute).toISOString(),
  });
  assert.equal(halfHour.eligible, true);
  assert.equal(halfHour.measuredAt, new Date(start - 30 * minute).toISOString());
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

test("mobile reminders check five minutes before the trip and then every ten minutes", () => {
  const start = Date.parse("2026-10-11T18:00:00+03:00");
  const end = Date.parse("2026-10-11T20:00:00+03:00");
  const minute = 60 * 1000;
  const absent = { startMs: start, endMs: end, lastHeardAtMs: null as number | null };
  const checks = [17 * 60 + 55, 18 * 60 + 5, 18 * 60 + 15, 18 * 60 + 25, 18 * 60 + 35, 18 * 60 + 45, 18 * 60 + 55, 19 * 60 + 5, 19 * 60 + 15, 19 * 60 + 25, 19 * 60 + 35, 19 * 60 + 45, 19 * 60 + 55];
  const day = Date.parse("2026-10-11T00:00:00+03:00");
  for (const clock of checks) {
    const at = day + clock * minute;
    assert.equal(mobileReminderDue({ ...absent, nowMs: at }), at);
    assert.equal(mobileReminderDue({ ...absent, nowMs: at + 30 * 1000 }), at);
    assert.equal(mobileReminderSlot({ startMs: start, endMs: end, nowMs: at + minute }), null);
  }
  assert.equal(mobileReminderDue({ ...absent, nowMs: start - 6 * minute }), null);
  assert.equal(mobileReminderDue({ ...absent, nowMs: start }), null);
  assert.equal(mobileReminderDue({ ...absent, nowMs: start + minute }), null);
  assert.equal(mobileReminderDue({ ...absent, nowMs: end }), null);
  assert.equal(mobileReminderDue({ ...absent, nowMs: end + minute }), null);
  const heard = start - 5 * minute + 20 * 1000;
  assert.equal(mobileReminderDue({ ...absent, nowMs: start - 5 * minute, lastHeardAtMs: heard }), null);
  assert.equal(mobileReminderDue({ ...absent, nowMs: start - 5 * minute, lastHeardAtMs: start - 24 * 60 * minute }), start - 5 * minute);
  assert.equal(ownerIsDriver({ driverEmail: "A@B.com", ownerEmail: "a@b.com" }), true);
  assert.deepEqual(reminderTargets({ ownerIsDriver: true }).map((item) => `${item.audience}:${item.channel}`), ["driver:push", "driver:email"]);
  assert.deepEqual(reminderTargets({ ownerIsDriver: false }).map((item) => `${item.audience}:${item.channel}`), ["driver:push", "owner:push", "owner:email"]);
  const same = reminderTargets({ ownerIsDriver: true });
  const other = reminderTargets({ ownerIsDriver: false });
  assert.equal(new Set(same.map((item) => item.audience)).size, 1);
  assert.equal(other.filter((item) => item.audience === "owner").length, 2);
  assert.deepEqual(reminderPushSources({ samePerson: true, audience: "driver" }), ["driver", "owner"]);
  assert.deepEqual(reminderPushSources({ samePerson: false, audience: "driver" }), ["driver"]);
  assert.deepEqual(reminderPushSources({ samePerson: false, audience: "owner" }), ["owner"]);
  assert.equal(uniquePushEndpoints([{ endpoint: "a" }, { endpoint: "a" }, { endpoint: "b" }]).length, 2);
  assert.equal(recentReminderBlocks({ lastSentAtMs: start, nowMs: start + 30 * 1000 }), true);
  assert.equal(recentReminderBlocks({ lastSentAtMs: start, nowMs: start + 10 * minute }), false);
  const ownSend = Date.parse("2026-10-11T16:10:08+03:00");
  const nextCheckpoint = Date.parse("2026-10-11T16:20:08+03:00");
  assert.equal(overlappingTripReminderBlocks({ otherTripSentAtMs: null, nowMs: nextCheckpoint }), false);
  assert.equal(overlappingTripReminderBlocks({ otherTripSentAtMs: ownSend, nowMs: ownSend + 20 * 1000 }), true);
  assert.equal(overlappingTripReminderBlocks({ otherTripSentAtMs: ownSend, nowMs: nextCheckpoint }), false);
  assert.equal(mobileReminderDue({ ...absent, nowMs: start - 5 * minute }), mobileReminderDue({ ...absent, nowMs: start - 5 * minute + 20 * 1000 }));
});

test("a share that stops between checks waits for the next ten-minute checkpoint", () => {
  const start = Date.parse("2026-10-11T18:00:00+03:00");
  const end = Date.parse("2026-10-11T20:00:00+03:00");
  const minute = 60 * 1000;
  const cut = start + 7 * minute;
  const next = start + 15 * minute;
  assert.equal(mobileShareHeard(cut, cut + 90 * 1000), true);
  assert.equal(mobileReminderDue({ startMs: start, endMs: end, nowMs: cut + 90 * 1000, lastHeardAtMs: cut }), null);
  assert.equal(mobileReminderDue({ startMs: start, endMs: end, nowMs: cut, lastHeardAtMs: null }), null);
  assert.equal(mobileReminderDue({ startMs: start, endMs: end, nowMs: next, lastHeardAtMs: cut }), next);
  const resumed = next - 30 * 1000;
  assert.equal(mobileReminderDue({ startMs: start, endMs: end, nowMs: next, lastHeardAtMs: resumed }), null);
  assert.equal(mobileShareHeard(next - 40 * 1000, next), true);
  assert.equal(mobileReminderDue({ startMs: start, endMs: end, nowMs: end, lastHeardAtMs: cut }), null);
  const before = driverReminderCopy({
    phase: "missing",
    plate: "34EGP847",
    date: "11.10.2026",
    start: "14:00",
    end: "17:00",
    pickup: "IST",
    dropoff: "Taksim",
  });
  assert.equal(before.title, "Mobil GPS Konum Paylaşımı Başlatılmadı");
  assert.match(before.body, /konum paylaşımı başlatılmadı/);
  assert.match(before.body, /Konum Paylaş butonuna basın/);
  assert.match(before.body, /Sefer tarihi: 11.10.2026/);
  assert.doesNotMatch(before.body, /yolcu/i);
  const during = ownerReminderCopy({
    phase: "interrupted",
    plate: "34EGP847",
    driverName: "Ada",
    date: "11.10.2026",
    start: "14:00",
    end: "17:00",
    pickup: "IST",
    dropoff: "Taksim",
  });
  assert.equal(during.title, "Mobil GPS Konum Paylaşımı Kesildi");
  assert.match(during.body, /güncel GPS konumu alınamıyor/);
  assert.match(during.body, /Ada/);
  assert.doesNotMatch(during.body, /10 dakikadır|Durdur butonuna basıp/);
  const reminders = readFileSync(new URL("./mobile-reminders.ts", import.meta.url), "utf8");
  const runner = readFileSync(new URL("./mobile-reminder-run.ts", import.meta.url), "utf8");
  assert.match(runner, /service_mobile_gps_enabled/);
  assert.match(runner, /ats_ministry_source = 'mobile'/);
  assert.match(runner, /is_owner = TRUE/);
  assert.match(runner, /last_stream_at/);
  assert.match(runner, /driver_push_subscriptions/);
  assert.match(runner, /reminderPushSources/);
  assert.match(runner, /urgency: "high"/);
  assert.doesNotMatch(runner, /ats-run|postAts|share_enabled/);
  assert.match(runner, /MOBILE_REMINDER_COOLDOWN_MS/);
  assert.match(runner, /notification_id <> \$2/);
  assert.match(runner, /overlappingTripReminderBlocks/);
  assert.doesNotMatch(runner, /110 \* 1000/);
  assert.doesNotMatch(reminders, /MOBILE_REMINDER_LIVE_MS|MOBILE_REMINDER_PRE_MS/);
  assert.doesNotMatch(reminders, /yolcu/i);
  assert.equal(mobileReminderRuntimeAllowed({ NODE_ENV: "development", EXPECTED_DATABASE: "tripetica_dev" }), true);
  assert.equal(mobileReminderRuntimeAllowed({ NODE_ENV: "production", EXPECTED_DATABASE: "tripetica" }), true);
  assert.equal(mobileReminderRuntimeAllowed({ NODE_ENV: "production", EXPECTED_DATABASE: "tripetica_dev" }), false);
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

test("a dead foreign session can be replaced and a live one stays locked", () => {
  const now = 1_700_000_000_000;
  assert.equal(mobileShareStartDecision({
    hasSession: true,
    sharing: true,
    tokenMatches: false,
    tokenBound: true,
    lastStreamAt: now - 96 * 60_000,
    startedAt: now - 100 * 60_000,
    now,
  }), "replace");
  assert.equal(mobileShareStartDecision({
    hasSession: true,
    sharing: true,
    tokenMatches: false,
    tokenBound: true,
    lastStreamAt: now - 30_000,
    startedAt: now - 60_000,
    now,
  }), "blocked");
  assert.equal(mobileShareForeignLive({ lastStreamAt: now - 40_000, startedAt: now - 50_000, now }), true);
  assert.equal(mobileShareStartDecision({
    hasSession: true,
    sharing: true,
    tokenMatches: false,
    tokenBound: true,
    lastStreamAt: null,
    startedAt: now - 10_000,
    now,
  }), "blocked");
  assert.equal(mobileShareStartDecision({
    hasSession: true,
    sharing: true,
    tokenMatches: false,
    tokenBound: true,
    lastStreamAt: null,
    startedAt: now - 10 * 60_000,
    now,
  }), "replace");
  assert.equal(mobileShareStartDecision({
    hasSession: true,
    sharing: true,
    tokenMatches: true,
    tokenBound: true,
    lastStreamAt: now - 10 * 60_000,
    startedAt: now - 20 * 60_000,
    now,
  }), "resume");
  assert.equal(mobileShareStartDecision({
    hasSession: true,
    sharing: true,
    tokenMatches: false,
    tokenBound: false,
    lastStreamAt: now - 5_000,
    startedAt: now - 5_000,
    now,
  }), "bind-token");
  assert.equal(mobileShareStartDecision({
    hasSession: false,
    sharing: false,
    tokenMatches: false,
    tokenBound: false,
    lastStreamAt: null,
    startedAt: null,
    now,
  }), "create");
  const store = readFileSync(new URL("./mobile-store.ts", import.meta.url), "utf8");
  assert.match(store, /mobileShareStartDecision/);
  assert.doesNotMatch(store, /DELETE FROM gps_mobile/);
  assert.doesNotMatch(store, /ats-run|postAts/);
});

test("physical ATS dispatch does not read mobile GPS", () => {
  const source = readFileSync(new URL("./ats-run.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /gps_mobile_positions|source_mobile|Mobil GPS/);
});
