import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gpsMapMarkerState, gpsPresenceMarker } from "@/lib/gps/map-popup";
import {
  GPS_STILL_MS,
  gpsDisplayTrack,
  gpsMotionView,
  gpsPathMeters,
  type GpsMotionFix,
} from "@/lib/gps/motion";

const parked: Array<[string, number, number, number]> = [
  ["2026-10-09T00:36:10+03:00", 41.081875, 28.971207, 0],
  ["2026-10-09T00:36:14+03:00", 41.081856, 28.971132, 10.98 / 3.6],
  ["2026-10-09T00:36:19+03:00", 41.081844, 28.971073, 7.44 / 3.6],
  ["2026-10-09T00:36:24+03:00", 41.081928, 28.971209, 4.99 / 3.6],
  ["2026-10-09T00:36:34+03:00", 41.081959, 28.971279, 7.17 / 3.6],
  ["2026-10-09T00:36:40+03:00", 41.081978, 28.971384, 4.48 / 3.6],
  ["2026-10-09T00:37:54+03:00", 41.081978, 28.971466, 0],
  ["2026-10-09T00:37:59+03:00", 41.081997, 28.971432, 4.2 / 3.6],
  ["2026-10-09T00:38:29+03:00", 41.081989, 28.971378, 3.54 / 3.6],
  ["2026-10-09T00:38:44+03:00", 41.082008, 28.971294, 4.36 / 3.6],
  ["2026-10-09T00:39:40+03:00", 41.081989, 28.971207, 9.35 / 3.6],
  ["2026-10-09T00:39:59+03:00", 41.081947, 28.971237, 6.72 / 3.6],
  ["2026-10-09T00:40:45+03:00", 41.081966, 28.971289, 0],
  ["2026-10-09T00:41:15+03:00", 41.081928, 28.971254, 0],
  ["2026-10-09T00:41:45+03:00", 41.081932, 28.971302, 0],
  ["2026-10-09T00:41:50+03:00", 41.081959, 28.971283, 0],
  ["2026-10-09T00:41:56+03:00", 41.081986, 28.971266, 2.86 / 3.6],
  ["2026-10-09T00:43:16+03:00", 41.081947, 28.971293, 0],
  ["2026-10-09T00:43:32+03:00", 41.081913, 28.971266, 5.66 / 3.6],
  ["2026-10-09T00:43:44+03:00", 41.081875, 28.971251, 0],
  ["2026-10-09T00:44:59+03:00", 41.081932, 28.971241, 6.69 / 3.6],
];

function parkedFixes(): GpsMotionFix[] {
  return parked.map(([clock, latitude, longitude, speedMps]) => ({
    at: Date.parse(clock),
    latitude,
    longitude,
    speedMps,
  }));
}

function northbound(start: number, steps: number, stepMs: number, meters: number, speedMps: number): GpsMotionFix[] {
  const fixes: GpsMotionFix[] = [];
  for (let index = 0; index <= steps; index += 1) {
    fixes.push({
      at: start + index * stepMs,
      latitude: 41.08 + (index * meters) / 111_320,
      longitude: 28.97,
      speedMps,
    });
  }
  return fixes;
}

test("parked GNSS scatter collapses and does not count as movement", () => {
  const fixes = parkedFixes();
  const shown = gpsDisplayTrack(fixes);
  assert.equal(shown.length, 1);
  assert.equal(shown[0]?.latitude, fixes[0]?.latitude);
  assert.ok(gpsPathMeters(shown) < 1);
  const early = gpsMotionView(fixes, Date.parse("2026-10-09T00:36:19+03:00"));
  assert.equal(early?.kind, "unknown");
  assert.equal(early?.liveSpeedMps, null);
  const shortStop = gpsMotionView(fixes, Date.parse("2026-10-09T00:39:06+03:00"));
  assert.equal(shortStop?.kind, "stopped");
  assert.equal(shortStop?.liveSpeedMps, null);
  assert.equal(shortStop?.measuredAt, Date.parse("2026-10-09T00:38:44+03:00"));
  const held = gpsMotionView(fixes, Date.parse("2026-10-09T00:44:59+03:00"));
  assert.equal(held?.kind, "still");
  assert.equal(GPS_STILL_MS, 300_000);
});

test("a real drive stays on the map and a traffic light does not erase it", () => {
  const start = Date.parse("2026-10-09T22:00:00+03:00");
  const outbound = northbound(start, 24, 5_000, 83, 60 / 3.6);
  const parkOrigin = outbound[outbound.length - 1];
  assert.ok(parkOrigin);
  const parkedStop: GpsMotionFix[] = [];
  for (let index = 1; index <= 18; index += 1) {
    parkedStop.push({
      at: parkOrigin.at + index * 20_000,
      latitude: parkOrigin.latitude + ((index % 3) - 1) * 0.00008,
      longitude: parkOrigin.longitude + ((index % 2) === 0 ? 0.00012 : -0.0001),
      speedMps: index % 4 === 0 ? 1.2 : 0,
    });
  }
  const resumeAt = parkedStop[parkedStop.length - 1]?.at ?? parkOrigin.at;
  const inbound = northbound(resumeAt, 24, 5_000, 83, 55 / 3.6).map((fix, index) => ({
    ...fix,
    latitude: parkOrigin.latitude + (index * 83) / 111_320,
    longitude: parkOrigin.longitude + 0.01,
  }));
  const trip = [...outbound, ...parkedStop, ...inbound];
  const shown = gpsDisplayTrack(trip);
  const rawLegs = gpsPathMeters(outbound) + gpsPathMeters(inbound);
  const shownPath = gpsPathMeters(shown);
  assert.ok(shownPath > rawLegs * 0.9, `shown ${shownPath} raw legs ${rawLegs}`);
  assert.ok(shown.length > 40);
  assert.ok(shown.length <= outbound.length + inbound.length + 2);
  assert.equal(shown.some((fix) => fix.at === parkedStop[4]?.at), false);
  const duringStop = gpsMotionView(trip, parkOrigin.at + 90_000);
  assert.equal(duringStop?.kind, "stopped");
  assert.equal(duringStop?.liveSpeedMps, null);
  const afterFive = gpsMotionView(trip, parkOrigin.at + GPS_STILL_MS + 20_000);
  assert.equal(afterFive?.kind, "still");
  const rolling = gpsMotionView(trip, inbound[inbound.length - 1]?.at ?? resumeAt);
  assert.equal(rolling?.kind, "moving");
  assert.equal(rolling?.liveSpeedMps, 55 / 3.6);
});

test("one speed reading and a GNSS gap do not become a stop or a live speed", () => {
  const at = Date.parse("2026-10-09T02:13:21+03:00");
  const alone: GpsMotionFix = { at, latitude: 41.033444, longitude: 28.812925, speedMps: 4.78 / 3.6 };
  const single = gpsMotionView([alone], at + 5_000);
  assert.equal(single?.kind, "unknown");
  assert.equal(single?.liveSpeedMps, null);
  assert.equal(single?.measuredAt, at);
  const moving = northbound(at, 8, 5_000, 83, 16);
  const last = moving[moving.length - 1];
  assert.ok(last);
  const gap = gpsMotionView(moving, last.at + 3 * 60_000);
  assert.equal(gap?.kind, "unknown");
  assert.equal(gap?.liveSpeedMps, null);
  assert.equal(gap?.measuredAt, last.at);
  const spike = gpsDisplayTrack([
    alone,
    { at: at + 5_000, latitude: 41.0342, longitude: 28.812925, speedMps: 12 },
    { at: at + 10_000, latitude: alone.latitude, longitude: alone.longitude, speedMps: 0 },
    { at: at + 40_000, latitude: alone.latitude + 0.00005, longitude: alone.longitude, speedMps: 1 },
  ]);
  assert.equal(spike.length, 1);
});

test("marker colors follow presence and verified motion", () => {
  assert.equal(gpsPresenceMarker("online", "moving"), "moving");
  assert.equal(gpsPresenceMarker("online", "stopped"), "stopped");
  assert.equal(gpsPresenceMarker("online", "still"), "still");
  assert.equal(gpsPresenceMarker("online", "unknown"), "unknown");
  assert.equal(gpsPresenceMarker("stale", "moving"), "offline");
  assert.equal(gpsPresenceMarker("offline", "stopped"), "offline");
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.gps-status\.is-moving::before \{ background: #15803d; \}/);
  assert.match(css, /\.gps-status\.is-stopped::before \{ background: #f59e0b; \}/);
  assert.match(css, /\.gps-status\.is-still::before,/);
  assert.match(css, /\.gps-status\.is-ignition-off::before \{ background: #dc2626; \}/);
  assert.match(css, /\.gps-status\.is-unknown::before \{ background: #2563eb; \}/);
  assert.match(css, /\.gps-status\.is-offline::before \{ background: #111827; \}/);
});

test("map pins keep a color after the stream stops", () => {
  const now = Date.parse("2026-10-10T08:00:00Z");
  const fresh = new Date(now - 30_000).toISOString();
  assert.equal(gpsMapMarkerState({ receivedAt: fresh, nowMs: now, motion: "moving" }), "moving");
  assert.equal(gpsMapMarkerState({ receivedAt: fresh, nowMs: now, motion: "stopped" }), "stopped");
  assert.equal(gpsMapMarkerState({ receivedAt: fresh, nowMs: now, motion: "still" }), "still");
  assert.equal(gpsMapMarkerState({ receivedAt: fresh, nowMs: now, motion: "unknown" }), "unknown");
  const lost = new Date(now - 10 * 60 * 1000).toISOString();
  assert.equal(gpsMapMarkerState({ receivedAt: lost, nowMs: now, motion: "moving" }), "still");
  const black = new Date(now - 31 * 60 * 1000).toISOString();
  assert.equal(gpsMapMarkerState({ receivedAt: black, nowMs: now, motion: "moving" }), "offline");
  assert.equal(gpsMapMarkerState({ receivedAt: null, nowMs: now, motion: "moving" }), "offline");
});

test("display filtering stays out of the ministry ATS path", () => {
  const motion = readFileSync(new URL("./motion.ts", import.meta.url), "utf8");
  const history = readFileSync(new URL("../../components/gps/history-playback.tsx", import.meta.url), "utf8");
  const live = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  const ats = readFileSync(new URL("./ats-run.ts", import.meta.url), "utf8");
  const windowSql = readFileSync(new URL("./ats-window.ts", import.meta.url), "utf8");
  const ingest = readFileSync(new URL("./ingest.ts", import.meta.url), "utf8");
  assert.doesNotMatch(motion, /ats-run|postAtsKonum|gps_ats_submissions/);
  assert.doesNotMatch(history, /ats-run|postAtsKonum/);
  assert.doesNotMatch(live, /ats-run|postAtsKonum/);
  assert.doesNotMatch(ats, /gpsDisplayTrack|gpsMotionView/);
  assert.doesNotMatch(windowSql, /gpsDisplayTrack|gpsMotionView/);
  assert.match(ingest, /INSERT INTO gps_positions/);
  assert.doesNotMatch(ingest, /gpsDisplayTrack|gpsMotionView/);
});
