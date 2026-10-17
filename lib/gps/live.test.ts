import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gpsLiveEtag, gpsPartnerLivePayload, GPS_LIVE_POLL_MS, readGpsLiveSnapshot, type GpsLiveSnapshot } from "@/lib/gps/live";
import { gpsPresence } from "@/lib/gps/presence";

const snapshot: GpsLiveSnapshot = {
  seq: 12,
  recordedAt: "2026-10-06T07:00:00.000Z",
  latitude: 41.01,
  longitude: 29.02,
  speedMps: 4.2,
  headingDeg: 180,
  satellites: 11,
  gnssFix: true,
  lastHeartbeatAt: "2026-10-06T07:00:05.000Z",
  firmware: "0.3.5",
  rssi: -70,
  operatorName: "28601",
  network: "home",
  uptimeSeconds: 10,
  simStatus: null,
  lteRegistration: null,
  pppStatus: null,
  naptStatus: null,
  ipAddress: null,
  gnssResponse: null,
  wifiPolicy: null,
  apStatus: null,
  wifiClients: 0,
  reportedMaxClients: null,
  lastRecoveryReason: null,
  lastModemRecoveryAt: null,
  lastGnssRecoveryAt: null,
  resetReason: null,
  powerSource: null,
  vehicleBatteryVoltage: null,
  accState: null,
  din1State: null,
  manufacturer: "esp32",
  powerMode: null,
  batteryPercent: null,
  wifiEnabled: null,
  wifiShareCommand: null,
  lowBatteryState: null,
  lowBatteryGraceRemainingSeconds: null,
};

test("live snapshot etag changes only when the device state changes", () => {
  assert.equal(gpsLiveEtag(snapshot), gpsLiveEtag({ ...snapshot }));
  assert.notEqual(gpsLiveEtag(snapshot), gpsLiveEtag({ ...snapshot, latitude: 41.02 }));
  assert.notEqual(gpsLiveEtag(snapshot), gpsLiveEtag({ ...snapshot, rssi: -80 }));
  assert.notEqual(gpsLiveEtag(snapshot), gpsLiveEtag({ ...snapshot, batteryPercent: 97 }));
  assert.equal(readGpsLiveSnapshot({ ...snapshot, batteryPercent: 0 })?.batteryPercent, 0);
  assert.equal(readGpsLiveSnapshot({ ...snapshot, wifiEnabled: true })?.wifiEnabled, true);
  assert.equal(readGpsLiveSnapshot({ ...snapshot, wifiEnabled: false })?.wifiEnabled, false);
  assert.notEqual(gpsLiveEtag(snapshot), gpsLiveEtag({ ...snapshot, wifiEnabled: false }));
  assert.equal(readGpsLiveSnapshot({ ...snapshot, batteryPercent: 101 }), null);
  assert.equal(readGpsLiveSnapshot(snapshot)?.satellites, 11);
  assert.equal(readGpsLiveSnapshot({ ...snapshot, latitude: 0, longitude: 0 })?.latitude, 0);
  assert.equal(readGpsLiveSnapshot({ ...snapshot, seq: 1.5 }), null);
  assert.equal(GPS_LIVE_POLL_MS, 5000);
});

test("partner live payload keeps the map and drops device telemetry", () => {
  const payload = gpsPartnerLivePayload(snapshot);
  assert.equal("firmware" in payload, false);
  assert.equal("operatorName" in payload, false);
  assert.equal("rssi" in payload, false);
  assert.equal(payload.latitude, 41.01);
  assert.equal(payload.manufacturer, "esp32");
  assert.equal(payload.satellites, 11);
  const parsed = readGpsLiveSnapshot(payload);
  assert.equal(parsed?.firmware, null);
  assert.equal(parsed?.operatorName, null);
  assert.equal(parsed?.latitude, 41.01);
  assert.equal(parsed?.din1State, null);
  assert.equal(parsed?.manufacturer, "esp32");
});

test("partner device card stays on the same five fields while data loads", () => {
  const section = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  const start = section.indexOf("gps-partner-device-facts");
  const end = section.indexOf("deviceLoading ? <p", start);
  const card = section.slice(start, end);
  assert.match(card, /partnerDeviceId/);
  assert.match(card, /partnerSimOperator/);
  assert.match(card, /partnerMinistryCompany/);
  assert.match(card, /partnerDeviceStatus/);
  assert.match(card, /partnerLastConnection/);
  assert.equal(card.split("deviceLoading").length - 1, 5);
  assert.doesNotMatch(card, /imei|firmware|manufacturer|rssi|gnssFix|operatorName/);
  const workspace = readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /readGpsLiveSnapshot\(gpsPartnerLivePayload\(initialLive\)\)/);
  assert.match(workspace, /initial=\{partnerLive \?\? initialLive\}/);
  const route = readFileSync(new URL("../../app/api/gps/live/[id]/route.ts", import.meta.url), "utf8");
  assert.match(route, /surface === "partner" \? gpsPartnerLivePayload\(snapshot\)/);
});

test("parked telemetry gap does not change heartbeat presence", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  const thresholds = { onlineMs: 120_000, staleMs: 900_000 };
  assert.equal(gpsPresence("2026-10-06T11:59:20.000Z", now, thresholds), "online");
  assert.equal(gpsPresence("2026-10-06T11:30:00.000Z", now, thresholds), "offline");
});

test("live poll reads one device and does not reload history", () => {
  const route = readFileSync(new URL("../../app/api/gps/live/[id]/route.ts", import.meta.url), "utf8");
  const section = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  assert.match(route, /getGpsLive\(id, partnerId\)/);
  assert.match(route, /actor\.partnerId/);
  assert.match(route, /gps\.view/);
  assert.match(route, /status: 304/);
  assert.doesNotMatch(route, /listGpsRoute|gps_positions/);
  assert.match(section, /GPS_LIVE_POLL_MS/);
  assert.match(section, /document\.hidden/);
  assert.match(section, /AbortController/);
  assert.doesNotMatch(section, /listGpsRoute|\/telemetry/);
  const pull = section.slice(section.indexOf("async function pull"), section.indexOf("function onVisibility"));
  assert.doesNotMatch(pull, /gps\/address|lookupGpsAddress/);
  assert.match(section, /gps-battery/);
  assert.match(section, /snapshot\.batteryPercent === null/);
  assert.doesNotMatch(section, /charging_inferred|chargingInferred|Şarj oluyor|Harici güç|Type-C/);
  assert.equal(GPS_LIVE_POLL_MS, 5000);
});
