import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { partnerHasGpsDeviceControls } from "@/lib/partner/gps-access";
import { wifiHotspotOn, wifiTelemetryKind } from "@/lib/gps/wifi-view";

test("wifi hotspot follows reported enablement then AP status", () => {
  assert.equal(wifiHotspotOn(true, "down"), true);
  assert.equal(wifiHotspotOn(false, "up"), false);
  assert.equal(wifiHotspotOn(null, "up"), true);
  assert.equal(wifiHotspotOn(null, "DOWN"), false);
  assert.equal(wifiHotspotOn(null, "assoc"), null);
  assert.equal(wifiHotspotOn(null, null), null);
});

test("wifi telemetry states cover offline, pending, mobile, and teltonika", () => {
  assert.equal(wifiTelemetryKind({
    presence: "offline",
    manufacturer: "esp32",
    wifiEnabled: null,
    ssid: "Cabin",
    clients: 1,
    apStatus: "up",
  }), "offline");
  assert.equal(wifiTelemetryKind({
    presence: "online",
    manufacturer: "esp32",
    wifiEnabled: null,
    ssid: null,
    clients: null,
    apStatus: null,
  }), "pending");
  assert.equal(wifiTelemetryKind({
    presence: "online",
    manufacturer: "esp32",
    wifiEnabled: true,
    ssid: "Cabin",
    clients: 0,
    apStatus: "up",
  }), "ready");
  assert.equal(wifiTelemetryKind({
    presence: "online",
    manufacturer: "teltonika",
    source: "device",
    wifiEnabled: null,
    ssid: null,
    clients: null,
    apStatus: null,
  }), "unsupported");
  assert.equal(wifiTelemetryKind({
    presence: "online",
    manufacturer: null,
    source: "mobile",
    wifiEnabled: null,
    ssid: null,
    clients: null,
    apStatus: null,
  }), "mobile");
});

test("partner Wi-Fi tab always renders a status surface", () => {
  const section = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  const start = section.indexOf("deviceControls && visibleTab === \"wifi\"");
  const end = section.indexOf("deviceControls && visibleTab === \"camera\"", start);
  const wifi = section.slice(start, end);
  assert.match(wifi, /GpsWifiPanel/);
  assert.match(wifi, /GpsWifiFleetList/);
  assert.match(wifi, /wifiOfflineNotice|mergeWifiLive/);
  assert.equal(partnerHasGpsDeviceControls(true), true);
  assert.equal(partnerHasGpsDeviceControls(false), false);
  const page = readFileSync(new URL("../../app/[locale]/partner/(panel)/gps/page.tsx", import.meta.url), "utf8");
  assert.match(page, /listGpsDevices\(actor\.partnerId\)/);
  assert.match(page, /partnerHasGpsDeviceControls/);
  assert.match(page, /reportedWifiSsid: device\.reportedWifiSsid/);
  const fleetRoute = readFileSync(new URL("../../app/api/gps/fleet/route.ts", import.meta.url), "utf8");
  assert.match(fleetRoute, /partner\.partnerId/);
  assert.match(fleetRoute, /reportedWifiSsid: device\.reportedWifiSsid/);
  const panel = readFileSync(new URL("../../components/gps/wifi-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /wifiHotspot/);
  assert.match(panel, /wifiOfflineNotice/);
  assert.match(panel, /wifiPendingNotice/);
  assert.match(panel, /copy\.ppp/);
  assert.match(panel, /copy\.napt/);
  assert.match(panel, /copy\.signal/);
  assert.doesNotMatch(panel, /wifiChannel|txPower|dataUsage|bytesRx/);
  const action = readFileSync(new URL("../../lib/gps/actions.ts", import.meta.url), "utf8");
  assert.match(action, /partner\.isPrimaryPartner/);
  assert.match(action, /getGpsDevice\(deviceId, partnerScope\)/);
});
