import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { pointError, routeSampleStep, type GpsPoint } from "@/lib/gps/contract";
import { gpsPresence } from "@/lib/gps/presence";

const now = new Date("2026-10-05T12:00:00.000Z");

function point(overrides: Partial<GpsPoint> = {}): GpsPoint {
  return {
    seq: 1,
    gnssTime: new Date("2026-10-05T11:59:00.000Z"),
    lat: 41.015,
    lon: 28.979,
    speedMps: 10,
    headingDeg: 90,
    altitudeM: 40,
    fixMode: "3d",
    satellites: 11,
    hdop: 0.8,
    pdop: 1.1,
    vdop: 0.7,
    ...overrides,
  };
}

test("shared GPS points validate time and coordinates", () => {
  assert.equal(pointError(point(), now), null);
  assert.equal(pointError(point({ lat: 0, lon: 0 }), now), "invalid_coordinate");
  assert.equal(pointError(point({ gnssTime: new Date("2026-10-05T12:06:00.000Z") }), now), "future_time");
  assert.equal(pointError(point({ gnssTime: new Date("2026-09-01T12:00:00.000Z") }), now), "stale_time");
  assert.equal(routeSampleStep(800), 1);
  assert.equal(routeSampleStep(1600), 2);
});

test("presence remains shared by Teltonika and mobile GPS", () => {
  const thresholds = { onlineMs: 120_000, staleMs: 900_000 };
  assert.equal(gpsPresence("2026-10-05T11:59:00.000Z", now, thresholds), "online");
  assert.equal(gpsPresence("2026-10-05T11:50:00.000Z", now, thresholds), "stale");
  assert.equal(gpsPresence(null, now, thresholds), "offline");
});

test("active HTTP device and ESP control surfaces are removed", () => {
  const removed = [
    "app/api/device/v1/telemetry/route.ts",
    "app/api/device/v1/heartbeat/route.ts",
    "app/api/device/v1/commands/route.ts",
    "app/api/device/v1/camera/session/route.ts",
    "components/gps/wifi-panel.tsx",
    "components/gps/camera-live.tsx",
  ];
  for (const path of removed) {
    assert.equal(existsSync(new URL(`../../${path}`, import.meta.url)), false, path);
  }

  const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
  assert.match(queries, /receiver = 'teltonika'/);
  assert.doesNotMatch(queries, /gps_device_credentials|gps_commands|wifi_config|camera_sessions/);
});
