import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chooseLivePoint } from "@/lib/gps/backfill";
import type { GpsPoint } from "@/lib/gps/contract";

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
});

test("Teltonika ingest keeps history time separate from the live position", () => {
  const source = readFileSync(new URL("./ingest.ts", import.meta.url), "utf8");
  assert.match(source, /receiver = 'teltonika'/);
  assert.match(source, /recorded_at/);
  assert.match(source, /ON CONFLICT \(device_id, seq\) DO NOTHING/);
  assert.match(source, /recorded_at IS NULL OR recorded_at <= \$12/);
  assert.match(source, /chooseLivePoint/);
  assert.doesNotMatch(source, /last_heartbeat_at|battery_percent|wifi|camera/);
});
