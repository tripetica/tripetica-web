import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chooseLivePoint } from "@/lib/gps/backfill";
import { GPS_MAX_BATCH, parseTelemetryBody, type GpsPoint } from "@/lib/gps/contract";

const now = new Date("2026-10-06T19:00:00.000Z");

function point(seq: number, iso: string): GpsPoint {
  return {
    seq,
    gnssTime: new Date(iso),
    lat: 41 + seq / 100,
    lon: 29,
    speedMps: seq,
    headingDeg: 10,
    altitudeM: null,
    fixMode: null,
    satellites: 8,
    hdop: null,
    pdop: null,
    vdop: null,
  };
}

test("live candidate is the newest GNSS fix, not the last array item", () => {
  const chosen = chooseLivePoint([
    point(4, "2026-10-06T18:02:00.000Z"),
    point(2, "2026-10-06T18:05:00.000Z"),
    point(3, "2026-10-06T18:03:00.000Z"),
  ]);
  assert.equal(chosen?.seq, 2);
  assert.equal(chooseLivePoint([]), null);
  const tied = chooseLivePoint([
    point(2, "2026-10-06T18:05:00.000Z"),
    point(9, "2026-10-06T18:05:00.000Z"),
  ]);
  assert.equal(tied?.seq, 9);
});

test("telemetry batch accepts old GNSS time and rejects an oversized batch", () => {
  const old = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString();
  const parsed = parseTelemetryBody({
    points: [
      { seq: 4, gnss_time: old, lat: 41.02, lon: 29.02, speed_mps: 3, heading_deg: 180 },
      { seq: 2, gnss_time: "2026-10-06T18:05:00.000Z", lat: 41.05, lon: 29.05 },
    ],
  }, now);
  assert.deepEqual(parsed?.points.map((item) => item.seq), [2, 4]);
  const tooMany = Array.from({ length: GPS_MAX_BATCH + 1 }, (_, index) => ({
    seq: index + 1,
    gnss_time: "2026-10-06T18:00:00.000Z",
    lat: 41.01,
    lon: 29.01,
  }));
  assert.equal(parseTelemetryBody({ points: tooMany }, now), null);
  assert.equal(parseTelemetryBody({ points: [] }, now), null);
});

test("telemetry ingest keeps history time separate from the live position", () => {
  const source = readFileSync(new URL("./ingest.ts", import.meta.url), "utf8");
  const ingest = source.slice(
    source.indexOf("export async function ingestTelemetry"),
    source.indexOf("export async function ingestHeartbeat"),
  );
  assert.match(ingest, /recorded_at/);
  assert.match(ingest, /ON CONFLICT \(device_id, seq\) DO NOTHING/);
  assert.match(ingest, /recorded_at IS NULL OR recorded_at <= \$12/);
  assert.match(ingest, /chooseLivePoint/);
  assert.doesNotMatch(ingest, /last_heartbeat_at/);
  assert.doesNotMatch(ingest, /battery_percent/);
  assert.match(ingest, /writeDeviceBattery/);
});
