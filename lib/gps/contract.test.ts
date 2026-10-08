import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { commandAuditState, isPartnerCommand, softwareRebootPayload, wifiConfigPayload, wifiShareConfirmKind, wifiSharePayload } from "@/lib/gps/commands";
import { gpsPresence } from "@/lib/gps/presence";
import {
  GPS_TOKEN_PATTERN,
  GPS_WIFI_MAX_CLIENTS_MAX,
  parseCommandResultBody,
  GPS_BATTERY_UNCHANGED,
  parseDeviceBattery,
  parseHeartbeatBody,
  parseTelemetryBody,
  pointError,
  publicCommandPayload,
  routeSampleStep,
  wifiMaxClientsError,
  wifiPasswordError,
  wifiSsidError,
  type GpsPoint,
} from "@/lib/gps/contract";
import { hashDeviceToken, readBearerToken } from "@/lib/gps/token";

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

test("telemetry accepts a real-shaped fix and rejects an empty coordinate", () => {
  const parsed = parseTelemetryBody({
    points: [
      {
        seq: 2,
        gnss_time: "2026-10-05T11:59:30.000Z",
        lat: 41.015,
        lon: 28.979,
        speed_mps: 4,
        heading_deg: 180,
        satellites: 9,
        hdop: 1.2,
      },
      {
        seq: 3,
        gnss_time: "2026-10-05T11:59:40.000Z",
        lat: 0,
        lon: 0,
      },
    ],
  }, now);
  assert.ok(parsed);
  assert.equal(parsed?.points.length, 1);
  assert.equal(parsed?.points[0]?.seq, 2);
  assert.deepEqual(parsed?.rejected, [{ seq: 3, error: "invalid_coordinate" }]);
});

test("telemetry rejects future and stale GNSS time", () => {
  assert.equal(pointError(point({ gnssTime: new Date("2026-10-05T12:06:00.000Z") }), now), "future_time");
  assert.equal(pointError(point({ gnssTime: new Date("2026-09-01T12:00:00.000Z") }), now), "stale_time");
  assert.equal(pointError(point(), now), null);
});

test("heartbeat and command result stay strict", () => {
  const heartbeat = parseHeartbeatBody({
    firmware: "0.1.0",
    rssi: -75,
    network: "lte",
    operator: "Turkcell",
    wifi: { enabled: true, ssid: "Tripetica", clients: 1 },
    gnss: { fix: false },
  });
  assert.equal(heartbeat?.firmware, "0.1.0");
  assert.equal(heartbeat?.rssi, -75);
  assert.equal(heartbeat?.gnssFix, false);
  assert.equal(heartbeat?.powerSource, null);
  assert.equal(heartbeat?.vehicleBatteryVoltage, null);
  assert.equal(heartbeat?.accState, null);
  assert.equal(heartbeat?.powerMode, null);
  assert.equal(heartbeat?.wifiEnabled, true);
  assert.equal(heartbeat?.wifiSsid, "Tripetica");
  assert.equal(heartbeat?.wifiClients, 1);
  assert.equal(heartbeat?.cameraAvailable, null);
  assert.equal(heartbeat?.cameraReady, null);
  const reported = parseHeartbeatBody({
    firmware: "0.1.0",
    network: "lte",
    operator: "Turkcell",
    wifi_enabled: false,
    wifi_ssid: "Cabin",
    wifi_max_clients: 1,
    wifi_connected_clients: 0,
  });
  assert.equal(reported?.wifiEnabled, false);
  assert.equal(reported?.wifiSsid, "Cabin");
  assert.equal(reported?.reportedMaxClients, 1);
  assert.equal(reported?.wifiClients, 0);
  assert.equal(reported?.cameraAvailable, null);
  assert.equal(parseHeartbeatBody({
    firmware: "0.1.0",
    network: "lte",
    operator: "Turkcell",
    camera_available: true,
    camera_ready: false,
  })?.cameraReady, false);
  assert.equal("password" in (reported ?? {}), false);
  assert.deepEqual(heartbeat?.battery, GPS_BATTERY_UNCHANGED);
  assert.equal(parseHeartbeatBody({ rssi: 20 }), null);
  assert.equal(parseCommandResultBody({ ok: false, error: "ap_failed" })?.ok, false);
  assert.equal(parseCommandResultBody({ ok: "yes" }), null);
});

test("device battery fields stay optional and never invent a percent", () => {
  const base = { firmware: "0.3.6", network: "lte", operator: "Turkcell" };
  const old = parseHeartbeatBody(base);
  assert.deepEqual(old?.battery, GPS_BATTERY_UNCHANGED);
  for (const percent of [0, 1, 20, 50, 97, 100]) {
    const parsed = parseDeviceBattery({ battery_percent: percent });
    assert.deepEqual(parsed.percent, { kind: "set", value: percent });
  }
  assert.deepEqual(parseDeviceBattery({ battery_percent: null }).percent, { kind: "absent" });
  assert.deepEqual(parseDeviceBattery({}).percent, { kind: "absent" });
  assert.deepEqual(parseDeviceBattery({ battery_percent: -1 }).percent, { kind: "keep" });
  assert.deepEqual(parseDeviceBattery({ battery_percent: 101 }).percent, { kind: "keep" });
  assert.deepEqual(parseDeviceBattery({ battery_percent: 97.4 }).percent, { kind: "keep" });
  assert.deepEqual(parseDeviceBattery({ battery_voltage: 4.279 }).voltage, { kind: "set", value: 4.279 });
  assert.deepEqual(parseDeviceBattery({ battery_voltage: null }).voltage, { kind: "clear" });
  assert.deepEqual(parseDeviceBattery({ battery_voltage: 12 }).voltage, { kind: "keep" });
  assert.deepEqual(parseDeviceBattery({ charging_inferred: true }).chargingInferred, { kind: "set", value: true });
  assert.deepEqual(parseDeviceBattery({ charging_inferred: false }).chargingInferred, { kind: "set", value: false });
  assert.deepEqual(parseDeviceBattery({ charging_inferred: null }).chargingInferred, { kind: "clear" });
  const sample = parseHeartbeatBody({
    ...base,
    battery_percent: 97,
    battery_voltage: 4.279,
    charging_inferred: true,
  });
  assert.deepEqual(sample?.battery.percent, { kind: "set", value: 97 });
  assert.equal(sample?.vehicleBatteryVoltage, null);
  const now = new Date("2026-10-07T12:00:00.000Z");
  const withBattery = parseTelemetryBody({
    points: [{ seq: 1, gnss_time: "2026-10-07T11:59:00.000Z", lat: 41.01, lon: 29.01 }],
    battery_percent: 84,
    battery_voltage: 4.1,
    charging_inferred: false,
  }, now);
  assert.equal(withBattery?.points.length, 1);
  assert.deepEqual(withBattery?.battery.percent, { kind: "set", value: 84 });
  const withoutBattery = parseTelemetryBody({
    points: [{ seq: 1, gnss_time: "2026-10-07T11:59:00.000Z", lat: 41.01, lon: 29.01 }],
  }, now);
  assert.deepEqual(withoutBattery?.battery, GPS_BATTERY_UNCHANGED);
});

test("wifi rules and route sampling", () => {
  assert.equal(wifiSsidError("Tripetica-34"), null);
  assert.equal(wifiPasswordError("short"), "wifi_password");
  assert.equal(wifiPasswordError("correct horse"), null);
  assert.equal(routeSampleStep(800), 1);
  assert.equal(routeSampleStep(1600), 2);
  assert.deepEqual(publicCommandPayload({ ssid: "A", password: "secret", enabled: true }), {
    ssid: "A",
    enabled: true,
  });
  assert.equal(GPS_WIFI_MAX_CLIENTS_MAX, 8);
  assert.equal(wifiMaxClientsError(1), null);
  assert.equal(wifiMaxClientsError(8), null);
  assert.equal(wifiMaxClientsError(0), "max_clients");
  assert.equal(wifiMaxClientsError(9), "max_clients");
  assert.deepEqual(wifiConfigPayload({ mode: "on", ssid: "Cabin", password: "", maxClients: 1 }), {
    mode: "on",
    enabled: true,
    ssid: "Cabin",
    max_clients: 1,
  });
  assert.equal("password" in wifiConfigPayload({ mode: "off", ssid: "", password: "", maxClients: 1 }), false);
  assert.equal(wifiConfigPayload({ mode: "on", ssid: "Cabin", password: "correct horse", maxClients: 8 }).password, "correct horse");
  assert.deepEqual(softwareRebootPayload(), { scope: "software" });
  assert.deepEqual(wifiSharePayload("on"), { mode: "on", enabled: true });
  assert.deepEqual(wifiSharePayload("off"), { mode: "off", enabled: false });
  assert.equal("max_clients" in wifiSharePayload("off"), false);
  assert.equal(wifiShareConfirmKind("off", 97), "off");
  assert.equal(wifiShareConfirmKind("off", 10), "off");
  assert.equal(wifiShareConfirmKind("on", 97), null);
  assert.equal(wifiShareConfirmKind("on", 20), null);
  assert.equal(wifiShareConfirmKind("on", 19), "low");
  assert.equal(wifiShareConfirmKind("on", 10), "low");
  assert.equal(wifiShareConfirmKind("on", 10, "keep_on"), null);
  assert.equal(wifiShareConfirmKind("on", null), null);
  const share = readFileSync(new URL("../../components/gps/wifi-share-switch.tsx", import.meta.url), "utf8");
  const copy = readFileSync(new URL("./copy.ts", import.meta.url), "utf8");
  assert.match(share, /checked=\{enabled === true\}/);
  assert.match(share, /wifiShareConfirmKind/);
  assert.match(share, /wifiShareConfirmTitle/);
  assert.match(copy, /Wi-Fi paylaşımını kapatmak istiyor musunuz\?/);
  assert.match(copy, /GPS konum takibi etkilenmeyecektir/);
  assert.doesNotMatch(share, /Şarj oluyor|low_battery_action|10 \* 60/);
  assert.match(share, /GPS_WIFI_SHARE_WAIT_MS/);
});

test("device token is hashed and the raw value is never the lookup key", () => {
  const header = "Bearer tdev_" + "a".repeat(43);
  const token = readBearerToken(header);
  assert.ok(token);
  assert.match(token ?? "", GPS_TOKEN_PATTERN);
  const hash = hashDeviceToken(token ?? "");
  assert.equal(hash.length, 64);
  assert.equal(hash.includes(token ?? "missing"), false);
});

test("presence and command audit stay shared across panels", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");
  const thresholds = { onlineMs: 120_000, staleMs: 900_000 };
  assert.equal(gpsPresence("2026-10-05T11:59:00.000Z", now, thresholds), "online");
  assert.equal(gpsPresence("2026-10-05T11:50:00.000Z", now, thresholds), "stale");
  assert.equal(gpsPresence("2026-10-05T10:00:00.000Z", now, thresholds), "offline");
  assert.equal(gpsPresence(null, now, thresholds), "offline");
  assert.equal(commandAuditState("queued", null), "PENDING");
  assert.equal(commandAuditState("delivered", null), "DELIVERED");
  assert.equal(commandAuditState("acked", null), "SUCCESS");
  assert.equal(commandAuditState("failed", "ap_failed"), "FAILED");
  assert.equal(commandAuditState("expired", "timeout"), "EXPIRED");
  assert.equal(isPartnerCommand("reboot"), true);
  assert.equal(isPartnerCommand("modem_reset"), false);
  assert.equal(isPartnerCommand("wifi_config"), true);
  assert.equal(isPartnerCommand("set_max_wifi_clients"), true);
});

test("gps schema does not call the ministry and keeps the device token hashed", () => {
  const sql = readFileSync(new URL("../../db/migrations/068_gps_devices.sql", import.meta.url), "utf8");
  assert.match(sql, /token_hash/);
  const controls = readFileSync(new URL("../../db/migrations/069_gps_device_controls.sql", import.meta.url), "utf8");
  assert.match(controls, /set_max_wifi_clients/);
  const wifiConfig = readFileSync(new URL("../../db/migrations/071_gps_wifi_config.sql", import.meta.url), "utf8");
  assert.match(wifiConfig, /wifi_config/);
  assert.match(wifiConfig, /BETWEEN 1 AND 8/);
  const header = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(header, /\{deviceCode\} · \{copy\[presence\]\}/);
  assert.match(header, /copy\.batteryLevel/);
  assert.match(header, /gps-battery is-low/);
  assert.match(header, /snapshot\.batteryPercent === null/);
  assert.doesNotMatch(header, /charging_inferred|chargingInferred|Şarj oluyor/);
  assert.match(header, /<dt>\{copy\.plate\}<\/dt>/);
  const workspace = readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /wifiClients \?\? 0/);
  assert.match(workspace, /wifiClients === null/);
  assert.match(controls, /wifi_max_clients/);
  assert.doesNotMatch(controls, /1234qwer/);
  const partnerPage = readFileSync(new URL("../../app/[locale]/partner/(panel)/gps/page.tsx", import.meta.url), "utf8");
  assert.match(partnerPage, /actor\.partnerId/);
  assert.doesNotMatch(partnerPage, /listGpsDevices\(null\)/);
  assert.doesNotMatch(sql, /password TEXT|firmaSeferNo|seferEkle|ats/i);
  const routes = [
    "app/api/device/v1/heartbeat/route.ts",
    "app/api/device/v1/telemetry/route.ts",
    "app/api/device/v1/commands/route.ts",
    "app/api/device/v1/commands/[id]/result/route.ts",
  ];
  for (const route of routes) {
    const source = readFileSync(new URL(`../../${route}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /uetds|ministry|soap/i);
  }
  const panel = readFileSync(new URL("../../lib/gps/queries.ts", import.meta.url), "utf8");
  assert.match(panel, /company.short_name/);
  assert.doesNotMatch(panel, /password_sealed|live_password|test_password/);
});
