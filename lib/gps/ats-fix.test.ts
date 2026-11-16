import assert from "node:assert/strict";
import test from "node:test";
import { chooseAtsFixForTrips } from "@/lib/gps/ats-fix";

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

test("a fix older than an hour before the trip is still the last real coordinate", () => {
  const now = firstStart;
  const accepted = chooseAtsFixForTrips({
    pointsNewestFirst: [point("p60", firstStart - hour, 2053)],
    trips: [trips[0]!],
    nowMs: now,
    resolve,
  });
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(accepted.point.id, "p60");
    assert.equal(accepted.point.measuredAtMs, firstStart - hour);
  }
  const older = chooseAtsFixForTrips({
    pointsNewestFirst: [point("hours", firstStart - 3 * hour, 2049)],
    trips: [trips[0]!],
    nowMs: now,
    resolve,
  });
  assert.equal(older.ok, true);
  if (older.ok) {
    assert.equal(older.point.id, "hours");
    assert.equal(older.point.measuredAtMs, firstStart - 3 * hour);
    assert.equal(older.point.latitude, 2049);
  }
});

test("an unresolved newer fix falls back to the previous real fix and its own district", () => {
  const now = Date.parse("2026-10-12T15:42:00+03:00");
  const fresh = point("fresh", now - 2 * minute, 0);
  const older = point("older", now - 20 * minute, 2049);
  const choice = chooseAtsFixForTrips({
    pointsNewestFirst: [fresh, older],
    trips,
    nowMs: now,
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
    resolve,
  });
  assert.equal(during.ok, true);
  if (during.ok) assert.deepEqual(during.tripIds, ["sefer-1", "sefer-2"]);

  const beforeSecond = chooseAtsFixForTrips({
    pointsNewestFirst: [point("early", Date.parse("2026-10-12T14:20:00+03:00"), 1183)],
    trips: [trips[0]!],
    nowMs: Date.parse("2026-10-12T14:20:00+03:00"),
    resolve,
  });
  assert.equal(beforeSecond.ok, true);
  if (beforeSecond.ok) assert.deepEqual(beforeSecond.tripIds, ["sefer-1"]);

  const afterFirst = chooseAtsFixForTrips({
    pointsNewestFirst: [point("late", Date.parse("2026-10-12T16:10:00+03:00"), 1835)],
    trips: [trips[1]!],
    nowMs: Date.parse("2026-10-12T16:10:00+03:00"),
    resolve,
  });
  assert.equal(afterFirst.ok, true);
  if (afterFirst.ok) assert.deepEqual(afterFirst.tripIds, ["sefer-2"]);
});

test("an older fix is sent for every active sefer", () => {
  const measuredAtMs = Date.parse("2026-10-12T14:29:00+03:00");
  const choice = chooseAtsFixForTrips({
    pointsNewestFirst: [point("border", measuredAtMs, 1183)],
    trips,
    nowMs: Date.parse("2026-10-12T15:42:00+03:00"),
    resolve,
  });
  assert.equal(choice.ok, true);
  if (!choice.ok) return;
  assert.deepEqual(choice.tripIds, ["sefer-1", "sefer-2"]);
  assert.equal(choice.point.measuredAtMs, measuredAtMs);
});

test("a new resolved fix replaces the stored one without rewriting its time", () => {
  const older = point("older", Date.parse("2026-10-12T17:25:00+03:00"), 1835);
  const newer = point("newer", Date.parse("2026-10-12T18:10:00+03:00"), 2049);
  const choice = chooseAtsFixForTrips({
    pointsNewestFirst: [newer, older],
    trips: [{ id: "evening", startMs: Date.parse("2026-10-12T18:00:00+03:00") }],
    nowMs: Date.parse("2026-10-12T18:40:00+03:00"),
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
    resolve,
  });
  assert.equal(ended.ok, false);
  if (!ended.ok) assert.equal(ended.reason, "fix_before_window");
});
