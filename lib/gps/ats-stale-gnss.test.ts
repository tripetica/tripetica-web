import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chooseAtsFixForTrips } from "@/lib/gps/ats-fix";
import { ATS_FAULT_OUTAGE_MS, gnssCheckpointDecision } from "@/lib/gps/ats-fault";
import { nextAtsAttempt } from "@/lib/gps/ats-policy";
import { planAtsCycle, type AtsTripClock } from "@/lib/gps/ats-window";
import { atsKonumBildirInnerXml, formatAtsKonumZamani } from "@/lib/uetds/ats-soap";

const vehicle = { vehicleId: "vehicle-1", companyId: "company-1", plate: "34 EGP 847" };
const minute = 60 * 1000;

function trip(): AtsTripClock {
  return {
    id: "sefer-a",
    status: "submitted",
    vehicleId: vehicle.vehicleId,
    companyId: vehicle.companyId,
    plate: "34EGP847",
    startDate: "2026-10-08",
    startTime: "18:00",
    endDate: "2026-10-08",
    endTime: "23:00",
  };
}

const tripStart = Date.parse("2026-10-08T15:00:00.000Z");

function cycle(nowMs: number, recordedAt: string | null) {
  return planAtsCycle({
    nowMs,
    enabled: true,
    trips: [trip()],
    ...vehicle,
    recordedAt,
    statusGnssFix: true,
    heartbeatAt: new Date(nowMs - 10_000).toISOString(),
    slotUsed: false,
  });
}

test("fresh GNSS is planned with its own measurement time", () => {
  const nowMs = tripStart + 30_000;
  const recordedAt = new Date(nowMs - 20_000).toISOString();
  const planned = cycle(nowMs, recordedAt);
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.gnssTime, recordedAt);
  assert.equal(planned.positionNote, null);
  assert.equal(gnssCheckpointDecision({
    tripStartMs: tripStart,
    tripEndMs: tripStart + 8 * 60 * minute,
    lastGnssMs: nowMs - 20_000,
    nowMs,
  }).alert, false);
});

test("GNSS from 31 minutes ago is still sent and the fault suspicion still alerts", () => {
  const nowMs = tripStart + 31 * minute;
  const recordedAt = new Date(tripStart).toISOString();
  const planned = cycle(nowMs, recordedAt);
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.gnssTime, recordedAt);
  assert.notEqual(planned.gnssTime, new Date(nowMs).toISOString());
  const fault = gnssCheckpointDecision({
    tripStartMs: tripStart,
    tripEndMs: tripStart + 8 * 60 * minute,
    lastGnssMs: tripStart,
    nowMs,
  });
  assert.equal(fault.alert, true);
  assert.equal(fault.reason, "stale");
  assert.equal(ATS_FAULT_OUTAGE_MS, 30 * minute);
});

test("a coordinate from several hours earlier is sent with that measurement time", () => {
  const nowMs = tripStart + 3 * 60 * minute;
  const measuredAtMs = tripStart - 2 * 60 * minute;
  const planned = cycle(nowMs, new Date(measuredAtMs).toISOString());
  assert.equal(planned.ok, true);
  if (planned.ok) assert.equal(planned.gnssTime, new Date(measuredAtMs).toISOString());
  const choice = chooseAtsFixForTrips({
    pointsNewestFirst: [{ id: "old", measuredAtMs, latitude: 41.01, longitude: 29.01 }],
    trips: [{ id: "sefer-a", startMs: tripStart }],
    nowMs,
    resolve: () => ({ ok: true, ilKodu: 34, ilceMernisKodu: 2053 }),
  });
  assert.equal(choice.ok, true);
  if (!choice.ok) return;
  assert.equal(choice.point.measuredAtMs, measuredAtMs);
  assert.equal(choice.point.latitude, 41.01);
  assert.equal(choice.point.longitude, 29.01);
  const fault = gnssCheckpointDecision({
    tripStartMs: tripStart,
    tripEndMs: tripStart + 8 * 60 * minute,
    lastGnssMs: null,
    nowMs,
  });
  assert.equal(fault.alert, true);
  assert.equal(fault.reason, "missing");
});

test("no stored coordinate is not invented", () => {
  const missing = cycle(tripStart + minute, null);
  assert.deepEqual(missing, { ok: false, reason: "no_position" });
  const choice = chooseAtsFixForTrips({
    pointsNewestFirst: [],
    trips: [{ id: "sefer-a", startMs: tripStart }],
    nowMs: tripStart + minute,
    resolve: () => ({ ok: true, ilKodu: 34, ilceMernisKodu: 2053 }),
  });
  assert.deepEqual(choice, { ok: false, reason: "fix_missing", unresolved: [] });
});

test("a new GNSS fix replaces the stored one and clears the fault", () => {
  const nowMs = tripStart + 40 * minute;
  const older = tripStart + minute;
  const newer = nowMs - 15_000;
  const choice = chooseAtsFixForTrips({
    pointsNewestFirst: [
      { id: "newer", measuredAtMs: newer, latitude: 41.02, longitude: 29.02 },
      { id: "older", measuredAtMs: older, latitude: 41.01, longitude: 29.01 },
    ],
    trips: [{ id: "sefer-a", startMs: tripStart }],
    nowMs,
    resolve: (latitude) => ({ ok: true, ilKodu: 34, ilceMernisKodu: latitude }),
  });
  assert.equal(choice.ok, true);
  if (choice.ok) {
    assert.equal(choice.point.id, "newer");
    assert.equal(choice.point.measuredAtMs, newer);
  }
  const planned = cycle(nowMs, new Date(newer).toISOString());
  assert.equal(planned.ok, true);
  if (planned.ok) assert.equal(planned.gnssTime, new Date(newer).toISOString());
  const fault = gnssCheckpointDecision({
    tripStartMs: tripStart,
    tripEndMs: tripStart + 8 * 60 * minute,
    lastGnssMs: newer,
    nowMs,
  });
  assert.equal(fault.alert, false);
  assert.equal(fault.reason, "fresh");
});

test("a ministry rejection of an old GNSS time stays a failed report", () => {
  const measured = new Date("2026-10-08T13:58:00.000Z");
  const now = new Date("2026-10-08T15:30:00.000Z");
  const konumZamani = formatAtsKonumZamani(measured);
  assert.notEqual(konumZamani, formatAtsKonumZamani(now));
  const xml = atsKonumBildirInnerXml({
    username: "test-user",
    password: "test-password",
    plate: "34EGP847",
    latitude: 41.01,
    longitude: 29.01,
    ilKodu: 34,
    ilceMernisKodu: 2053,
    konumZamani,
  });
  assert.match(xml, new RegExp(`<konumZamani>${konumZamani}</konumZamani>`));
  const rejected = nextAtsAttempt({ enabled: true, attemptCount: 0, sonucKodu: 4, now });
  assert.equal(rejected.retry, false);
  assert.equal(rejected.reason, "rejected");
  const fault = readFileSync(new URL("./ats-fault.ts", import.meta.url), "utf8");
  assert.match(fault, /ATS_FAULT_OUTAGE_MS = 30 \* 60 \* 1000/);
  assert.match(fault, /reason: "stale"/);
});
