import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gpsCopy } from "@/lib/gps/copy";
import { analyzeDriveTrack, formatDriveDay, formatDriveKilometers } from "@/lib/gps/drive";
import { foldMaintenanceDistance } from "@/lib/gps/maintenance";

function north(latitude: number, meters: number) {
  return latitude + (meters / 6_371_000) * (180 / Math.PI);
}

const start = Date.parse("2026-10-13T10:00:00Z");

test("selected-range distance matches maintenance filters and skips ignition-off movement", () => {
  const points = [
    { id: "a", at: start, latitude: 41, longitude: 29, speedMps: 12, ignition: "on" as const },
    { id: "b", at: start + 60_000, latitude: north(41, 1000), longitude: 29, speedMps: 16, ignition: "on" as const },
    { id: "c", at: start + 2 * 60_000, latitude: north(41, 1100), longitude: 29, speedMps: 0, ignition: "off" as const },
    { id: "d", at: start + 12 * 60_000, latitude: north(41, 6100), longitude: 29, speedMps: 4, ignition: "off" as const },
    { id: "e", at: start + 13 * 60_000, latitude: north(41, 7000), longitude: 29, speedMps: 8, ignition: "on" as const },
    { id: "f", at: start + 14 * 60_000, latitude: north(41, 8000), longitude: 29, speedMps: 20, ignition: "on" as const },
    { id: "zero", at: start + 30_000, latitude: 0, longitude: 0, ignition: "on" as const },
  ];
  const report = analyzeDriveTrack({ points, nowMs: start + 20 * 60_000, useIgnition: true });
  const folded = foldMaintenanceDistance({ cursor: null, points, nowMs: start + 20 * 60_000, useIgnition: true });
  assert.equal(report.meters, folded.addedMeters);
  assert.ok(report.meters > 1900 && report.meters < 2200);
  assert.equal(report.trips.length, 2);
  assert.equal(report.hasExplicitIgnition, true);
  assert.ok((report.maxSpeedMps ?? 0) >= 20);
  const unknown = analyzeDriveTrack({
    points: [
      { id: "u1", at: start, latitude: 41, longitude: 29, speedMps: 10 },
      { id: "u2", at: start + 60_000, latitude: north(41, 1000), longitude: 29, speedMps: 10 },
    ],
    nowMs: start + 10 * 60_000,
    useIgnition: true,
  });
  assert.ok(unknown.meters > 990 && unknown.meters < 1010);
  assert.equal(unknown.countedUnknownIgnition, true);
  assert.equal(unknown.hasExplicitIgnition, false);
  const gap = analyzeDriveTrack({
    points: [
      { id: "g1", at: start, latitude: 41, longitude: 29, ignition: "on" },
      { id: "g2", at: start + 20 * 60_000, latitude: north(41, 2000), longitude: 29, ignition: "on" },
    ],
    nowMs: start + 30 * 60_000,
    useIgnition: true,
  });
  assert.equal(gap.meters, 0);
  assert.equal(gap.gap, true);
  const mobile = analyzeDriveTrack({
    points: [
      { id: "m1", at: start, latitude: 41, longitude: 29, ignition: "off" },
      { id: "m2", at: start + 10 * 60_000, latitude: north(41, 5000), longitude: 29, ignition: "off" },
    ],
    nowMs: start + 20 * 60_000,
    useIgnition: false,
  });
  assert.ok(mobile.meters > 4900 && mobile.meters < 5100);
  assert.equal(mobile.useIgnition, false);
  assert.equal(formatDriveKilometers(125_600, "tr"), "125,6 km");
  assert.equal(formatDriveKilometers(125_600, "en"), "125.6 km");
  assert.equal(formatDriveDay(start, "tr"), "13 Ekim 2026 — Salı");
  assert.equal(gpsCopy.tr.showDrive, "Sürüş analizini göster");
  assert.equal(gpsCopy.en.hideDrive, "Hide driving analysis");
  assert.equal(gpsCopy.ru.driveUnavailable, "Данные отсутствуют");
  assert.equal(gpsCopy.tr.rangeDistance, "Seçilen Aralıkta Tahmini Mesafe");
  assert.equal(gpsCopy.tr.driveBehaviorPending, "Sürüş davranışı verileri henüz kullanılabilir değil. Cihaz yapılandırması tamamlandığında bu bölümde görüntülenecek.");
  assert.equal(gpsCopy.en.driveShowDetails, "Show trip details");
  assert.equal(gpsCopy.ru.driveShowMap, "Показать маршрут на карте");
  const tripMeters = report.trips.reduce((sum, trip) => sum + trip.meters, 0);
  assert.ok(Math.abs(tripMeters - report.meters) < 1);
  for (const trip of report.trips) {
    assert.equal(trip.movingMs + trip.stoppedMs, trip.endedAt - trip.startedAt);
  }
  assert.equal(report.trips[0]?.closedBy, "ignition");
  assert.equal(report.trips[1]?.closedBy, "end");
});

test("short stops stay in the trip and a 15 minute stop starts another", () => {
  const pause = analyzeDriveTrack({
    points: [
      { id: "a", at: start, latitude: 41, longitude: 29, speedMps: 10, ignition: "on" },
      { id: "b", at: start + 60_000, latitude: north(41, 500), longitude: 29, speedMps: 10, ignition: "on" },
      { id: "c", at: start + 6 * 60_000, latitude: north(41, 500), longitude: 29, speedMps: 0, ignition: "on" },
      { id: "d", at: start + 7 * 60_000, latitude: north(41, 1000), longitude: 29, speedMps: 10, ignition: "on" },
    ],
    nowMs: start + 10 * 60_000,
    useIgnition: true,
  });
  assert.equal(pause.trips.length, 1);
  assert.equal(pause.trips[0]?.stoppedMs, 5 * 60_000);
  assert.equal(pause.trips[0]?.movingMs + pause.trips[0]?.stoppedMs, pause.trips[0]?.endedAt - pause.trips[0]?.startedAt);
  const parked = analyzeDriveTrack({
    points: [
      { id: "a", at: start, latitude: 41, longitude: 29, speedMps: 10, ignition: "on" },
      { id: "b", at: start + 60_000, latitude: north(41, 500), longitude: 29, speedMps: 10, ignition: "on" },
      { id: "c", at: start + 16 * 60_000, latitude: north(41, 500), longitude: 29, speedMps: 0, ignition: "on" },
      { id: "d", at: start + 17 * 60_000, latitude: north(41, 1000), longitude: 29, speedMps: 10, ignition: "on" },
    ],
    nowMs: start + 20 * 60_000,
    useIgnition: true,
  });
  assert.equal(parked.trips.length, 2);
  assert.equal(parked.trips[0]?.closedBy, "stationary");
  assert.equal(parked.trips[0]?.stoppedMs, 0);
  assert.equal(parked.trips[0]?.endedAt, start + 60_000);
  assert.equal(parked.stoppedMs, 0);
  const jitter = analyzeDriveTrack({
    points: [
      { id: "j1", at: start, latitude: 41, longitude: 29, speedMps: 0.2, ignition: "on" },
      { id: "j2", at: start + 60_000, latitude: north(41, 15), longitude: 29, speedMps: 0.2, ignition: "on" },
    ],
    nowMs: start + 5 * 60_000,
    useIgnition: true,
  });
  assert.equal(jitter.trips.length, 0);
  assert.equal(jitter.meters, 0);
  const brief = analyzeDriveTrack({
    points: [
      { id: "s1", at: start, latitude: 41, longitude: 29, speedMps: 8, ignition: "on" },
      { id: "s2", at: start + 30_000, latitude: north(41, 200), longitude: 29, speedMps: 8, ignition: "on" },
    ],
    nowMs: start + 5 * 60_000,
    useIgnition: true,
  });
  assert.equal(brief.trips.length, 1);
  assert.ok(brief.trips[0] && brief.trips[0].meters > 190 && brief.trips[0].meters < 210);
  const split = analyzeDriveTrack({
    points: [
      { id: "g1", at: start, latitude: 41, longitude: 29, speedMps: 10, ignition: "on" },
      { id: "g2", at: start + 60_000, latitude: north(41, 400), longitude: 29, speedMps: 10, ignition: "on" },
      { id: "g3", at: start + 21 * 60_000, latitude: north(41, 800), longitude: 29, speedMps: 10, ignition: "on" },
      { id: "g4", at: start + 22 * 60_000, latitude: north(41, 1200), longitude: 29, speedMps: 10, ignition: "on" },
    ],
    nowMs: start + 30 * 60_000,
    useIgnition: true,
  });
  assert.equal(split.gap, true);
  assert.equal(split.trips.length, 2);
  assert.equal(split.trips[0]?.closedBy, "gap");
  assert.equal(split.trips[0]?.endedAt, start + 60_000);
  assert.ok(split.meters > 700 && split.meters < 900);
  assert.equal(split.totalMs, 2 * 60_000);
});

test("drive analysis reads physical points and does not invent event rows", () => {
  const store = readFileSync(new URL("./drive-store.ts", import.meta.url), "utf8");
  const live = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  const reportSrc = readFileSync(new URL("../../components/gps/drive-report.tsx", import.meta.url), "utf8");
  assert.match(reportSrc, /driveGreenEmpty/);
  assert.match(reportSrc, /driveGreenInactive/);
  assert.doesNotMatch(reportSrc, /driveScore/);
  assert.match(store, /FROM gps_positions/);
  assert.match(store, /gps_green_driving_events/);
  assert.match(store, /ignition/);
  assert.doesNotMatch(store, /gps_mobile_positions|setdigout|ats-run/);
  assert.doesNotMatch(live, /harshBrakeCount|driveScoreValue|greenDrivingValue/);
  const historyAt = live.indexOf("copy.showHistory");
  const driveAt = live.indexOf("copy.showDrive");
  const maintenanceAt = live.indexOf("copy.showMaintenance");
  const deviceAt = live.indexOf("copy.showDevice");
  assert.ok(historyAt >= 0 && historyAt < maintenanceAt && maintenanceAt < driveAt && driveAt < deviceAt);
});
