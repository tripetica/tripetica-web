import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ATS_PERIOD_MS,
  atsPositionIsCurrent,
  planAtsCycle,
  selectActiveAtsTrips,
  type AtsTripClock,
} from "@/lib/gps/ats-window";

const vehicle = { vehicleId: "vehicle-1", companyId: "company-1", plate: "34 EGP 847" };

function trip(overrides: Partial<AtsTripClock> = {}): AtsTripClock {
  return {
    id: "sefer-a",
    status: "submitted",
    vehicleId: "vehicle-1",
    companyId: "company-1",
    plate: "34EGP847",
    startDate: "2026-10-08",
    startTime: "18:00",
    endDate: "2026-10-08",
    endTime: "21:00",
    ...overrides,
  };
}

const start = Date.parse("2026-10-08T15:00:00.000Z");
const end = Date.parse("2026-10-08T18:00:00.000Z");

test("ATS follows the stored sefer clock and does not invent a duration", () => {
  const source = readFileSync(new URL("./ats-window.ts", import.meta.url), "utf8");
  assert.equal(ATS_PERIOD_MS, 120_000);
  assert.doesNotMatch(source, /\+ ?3|3 \* 60|120 \* 60 \* 1000|two hours|three hours/i);
  assert.deepEqual(selectActiveAtsTrips({ trips: [trip()], ...vehicle, nowMs: start - 1 }), { ok: false, reason: "no_trip" });
  assert.deepEqual(selectActiveAtsTrips({ trips: [trip()], ...vehicle, nowMs: start }).ok, true);
  assert.deepEqual(selectActiveAtsTrips({ trips: [trip()], ...vehicle, nowMs: end }), { ok: false, reason: "no_trip" });
  assert.deepEqual(selectActiveAtsTrips({ trips: [trip()], ...vehicle, nowMs: end + 1 }), { ok: false, reason: "no_trip" });
  const twoHours = selectActiveAtsTrips({
    trips: [trip({ endTime: "20:00" })],
    ...vehicle,
    nowMs: Date.parse("2026-10-08T16:30:00.000Z"),
  });
  const day = selectActiveAtsTrips({
    trips: [trip({ endDate: "2026-10-09", endTime: "18:00" })],
    ...vehicle,
    nowMs: Date.parse("2026-10-09T14:00:00.000Z"),
  });
  assert.equal(twoHours.ok, true);
  assert.equal(day.ok, true);
});

test("overlapping sefers share one cycle and a gap sends nothing", () => {
  const overlap = selectActiveAtsTrips({
    trips: [trip(), trip({ id: "sefer-b", startTime: "19:30", endTime: "21:00" })],
    ...vehicle,
    nowMs: Date.parse("2026-10-08T16:45:00.000Z"),
  });
  assert.deepEqual(overlap.ok ? overlap.notificationIds : [], ["sefer-a", "sefer-b"]);
  const gap = selectActiveAtsTrips({
    trips: [trip({ endTime: "20:00" }), trip({ id: "sefer-b", startTime: "21:00", endTime: "23:00" })],
    ...vehicle,
    nowMs: Date.parse("2026-10-08T17:30:00.000Z"),
  });
  assert.deepEqual(gap, { ok: false, reason: "no_trip" });
});

test("cancelled and unverified sefers stay out, accepted updates use the snapshot clock", () => {
  assert.equal(selectActiveAtsTrips({
    trips: [trip({ status: "cancelled" }), trip({ id: "sefer-b", startTime: "19:00", endTime: "22:00" })],
    ...vehicle,
    nowMs: Date.parse("2026-10-08T16:30:00.000Z"),
  }).ok, true);
  assert.equal(selectActiveAtsTrips({
    trips: [trip({ status: "failed" })],
    ...vehicle,
    nowMs: start,
  }).ok, false);
  const updated = selectActiveAtsTrips({
    trips: [trip({ status: "updated", endTime: "20:00" })],
    ...vehicle,
    nowMs: Date.parse("2026-10-08T17:30:00.000Z"),
  });
  assert.equal(updated.ok, false);
});

test("a two-minute cycle repeats the last real fix without inventing a GNSS time", () => {
  const nowMs = start + 30_000;
  const fresh = {
    nowMs,
    enabled: true,
    trips: [trip(), trip({ id: "sefer-b", startTime: "19:30" })],
    ...vehicle,
    recordedAt: new Date(nowMs - 20_000).toISOString(),
    statusGnssFix: true as boolean | null,
    heartbeatAt: new Date(nowMs - 10_000).toISOString(),
    slotUsed: false,
  };
  const duringOverlap = Date.parse("2026-10-08T16:45:00.000Z");
  const first = planAtsCycle({
    ...fresh,
    nowMs: duringOverlap,
    recordedAt: new Date(duringOverlap - 20_000).toISOString(),
    heartbeatAt: new Date(duringOverlap - 10_000).toISOString(),
    trips: [trip(), trip({ id: "sefer-b", startTime: "19:30" })],
  });
  assert.equal(first.ok, true);
  if (first.ok) assert.deepEqual(first.notificationIds, ["sefer-a", "sefer-b"]);
  assert.equal(planAtsCycle({ ...fresh, slotUsed: true }).ok, false);
  const storedAt = new Date(nowMs - 20_000).toISOString();
  const nextSlot = planAtsCycle({
    ...fresh,
    nowMs: nowMs + ATS_PERIOD_MS,
    recordedAt: storedAt,
    heartbeatAt: new Date(nowMs + ATS_PERIOD_MS - 10_000).toISOString(),
    slotUsed: false,
  });
  assert.equal(nextSlot.ok, true);
  if (nextSlot.ok) {
    assert.equal(nextSlot.gnssTime, storedAt);
    assert.equal(nextSlot.stored, true);
    assert.equal(nextSlot.positionNote, "stale_position");
  }
});

test("offline, lost fix, a closed switch, and the wrong plate do not send", () => {
  const nowMs = start + 30_000;
  const base = {
    nowMs,
    enabled: true,
    trips: [trip()],
    ...vehicle,
    recordedAt: new Date(nowMs - 10_000).toISOString(),
    statusGnssFix: true as boolean | null,
    heartbeatAt: new Date(nowMs - 10_000).toISOString(),
    slotUsed: false,
  };
  assert.equal(planAtsCycle({ ...base, enabled: false }).ok, false);
  assert.equal(planAtsCycle({ ...base, recordedAt: null }).ok, false);
  const parked = planAtsCycle({
    ...base,
    recordedAt: new Date(nowMs - 6 * 60 * 60 * 1000).toISOString(),
    heartbeatAt: new Date(nowMs - 130_000).toISOString(),
    statusGnssFix: false,
  });
  assert.equal(parked.ok, true);
  if (parked.ok) {
    assert.equal(parked.stored, true);
    assert.equal(parked.positionNote, "offline");
  }
  assert.equal(atsPositionIsCurrent({ ...base, heartbeatAt: new Date(nowMs - 130_000).toISOString() }).ok, false);
  assert.equal(atsPositionIsCurrent({ ...base, statusGnssFix: false }).ok, false);
  assert.equal(selectActiveAtsTrips({ trips: [trip({ plate: "06ABC123" })], ...vehicle, nowMs }).ok, false);
  assert.equal(selectActiveAtsTrips({
    trips: [trip({ companyId: "other-company" })],
    ...vehicle,
    nowMs,
  }).ok, false);
});
