import assert from "node:assert/strict";
import test from "node:test";
import { chooseAtsFixForTrips } from "@/lib/gps/ats-fix";
import { MOBILE_ATS_MAX_FIX_AGE_MS } from "@/lib/gps/mobile-ats";

const minute = 60 * 1000;
const hour = 60 * minute;
const firstStart = Date.parse("2026-10-12T14:00:00+03:00");
const secondStart = Date.parse("2026-10-12T15:30:00+03:00");
const trips = [
  { id: "sefer-1", startMs: firstStart },
  { id: "sefer-2", startMs: secondStart },
];

function point(id: string, at: number, latitude: number) {
  return { id, measuredAtMs: at, latitude, longitude: 29 };
}

const resolve = (latitude: number) =>
  latitude === 0
    ? { ok: false as const }
    : { ok: true as const, ilKodu: 34, ilceMernisKodu: latitude };

test("a fix from the sixtieth minute is kept and the sixty-first is not", () => {
  const now = firstStart;
  const accepted = chooseAtsFixForTrips({
    pointsNewestFirst: [point("p60", firstStart - hour, 2053)],
    trips: [trips[0]!],
    nowMs: now,
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.equal(accepted.point.id, "p60");
  const rejected = chooseAtsFixForTrips({
    pointsNewestFirst: [point("p61", firstStart - hour - minute, 2053)],
    trips: [trips[0]!],
    nowMs: now,
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.reason, "fix_before_window");
});

test("an unresolved newer fix falls back to the previous real fix and its own district", () => {
  const now = Date.parse("2026-10-12T15:42:00+03:00");
  const fresh = point("fresh", now - 2 * minute, 0);
  const older = point("older", now - 20 * minute, 2049);
  const choice = chooseAtsFixForTrips({
    pointsNewestFirst: [fresh, older],
    trips,
    nowMs: now,
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(choice.ok, true);
  if (!choice.ok) return;
  assert.equal(choice.point.id, "older");
  assert.equal(choice.point.latitude, 2049);
  assert.equal(choice.point.measuredAtMs, older.measuredAtMs);
  assert.equal(choice.district.ilceMernisKodu, 2049);
  assert.notEqual(choice.point.id, fresh.id);
  assert.deepEqual(choice.tripIds, ["sefer-1", "sefer-2"]);
  assert.equal(choice.unresolved[0]?.id, "fresh");
  assert.equal(choice.unresolved[0]?.latitude, 0);
});

test("overlapping sefers share one fix only while both are open", () => {
  const during = chooseAtsFixForTrips({
    pointsNewestFirst: [point("live", Date.parse("2026-10-12T15:42:00+03:00"), 1835)],
    trips,
    nowMs: Date.parse("2026-10-12T15:42:00+03:00"),
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(during.ok, true);
  if (during.ok) assert.deepEqual(during.tripIds, ["sefer-1", "sefer-2"]);

  const beforeSecond = chooseAtsFixForTrips({
    pointsNewestFirst: [point("early", Date.parse("2026-10-12T14:20:00+03:00"), 1183)],
    trips: [trips[0]!],
    nowMs: Date.parse("2026-10-12T14:20:00+03:00"),
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(beforeSecond.ok, true);
  if (beforeSecond.ok) assert.deepEqual(beforeSecond.tripIds, ["sefer-1"]);

  const afterFirst = chooseAtsFixForTrips({
    pointsNewestFirst: [point("late", Date.parse("2026-10-12T16:10:00+03:00"), 1835)],
    trips: [trips[1]!],
    nowMs: Date.parse("2026-10-12T16:10:00+03:00"),
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(afterFirst.ok, true);
  if (afterFirst.ok) assert.deepEqual(afterFirst.tripIds, ["sefer-2"]);
});

test("a fix too old for the later sefer stays on the earlier sefer only", () => {
  const choice = chooseAtsFixForTrips({
    pointsNewestFirst: [point("border", Date.parse("2026-10-12T14:29:00+03:00"), 1183)],
    trips,
    nowMs: Date.parse("2026-10-12T15:42:00+03:00"),
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(choice.ok, true);
  if (choice.ok) assert.deepEqual(choice.tripIds, ["sefer-1"]);
});

test("a new resolved fix replaces the stored one without rewriting its time", () => {
  const older = point("older", Date.parse("2026-10-12T17:25:00+03:00"), 1835);
  const newer = point("newer", Date.parse("2026-10-12T18:10:00+03:00"), 2049);
  const choice = chooseAtsFixForTrips({
    pointsNewestFirst: [newer, older],
    trips: [{ id: "evening", startMs: Date.parse("2026-10-12T18:00:00+03:00") }],
    nowMs: Date.parse("2026-10-12T18:40:00+03:00"),
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(choice.ok, true);
  if (!choice.ok) return;
  assert.equal(choice.point.id, "newer");
  assert.equal(choice.point.measuredAtMs, newer.measuredAtMs);
  assert.equal(choice.district.ilceMernisKodu, 2049);
});

test("thirty silent minutes still uses the last in-window fix and the trip end drops it", () => {
  const start = Date.parse("2026-10-12T18:00:00+03:00");
  const stored = point("stored", start - 30 * minute, 2053);
  const during = chooseAtsFixForTrips({
    pointsNewestFirst: [stored],
    trips: [{ id: "evening", startMs: start }],
    nowMs: start + 30 * minute,
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(during.ok, true);
  if (during.ok) {
    assert.equal(during.point.measuredAtMs, stored.measuredAtMs);
    assert.equal(during.point.latitude, stored.latitude);
  }
  const ended = chooseAtsFixForTrips({
    pointsNewestFirst: [stored],
    trips: [],
    nowMs: Date.parse("2026-10-12T20:00:00+03:00"),
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve,
  });
  assert.equal(ended.ok, false);
  if (!ended.ok) assert.equal(ended.reason, "fix_before_window");
});
