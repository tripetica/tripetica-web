import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gpsCopy } from "@/lib/gps/copy";
import { soleGpsDevice } from "@/lib/gps/entry";
import { gpsPopupClock, gpsPopupSpeed } from "@/lib/gps/format";
import { GPS_MOVING_CLEAR_MPS, GPS_MOVING_MPS, gpsMarkerState, gpsPlaybackMarkerState, gpsPopupRows, gpsSpeedIsMoving, GPS_POPUP_DEFAULTS, readGpsPopupPrefs } from "@/lib/gps/map-popup";
import { GPS_PLAYBACK_RATES, advancePlaybackCursor } from "@/lib/gps/playback";
import { clearGpsAddressCache, lookupGpsAddress } from "@/lib/gps/address";
import { formatGpsAddress, gpsAddressCell } from "@/lib/gps/address-format";
import { partnerCopy } from "@/lib/partner/copy";
import { opsCopy } from "@/lib/ops/copy";

test("menu and module names include camera in every panel locale", () => {
  assert.equal(partnerCopy.tr.gps, "GPS / Wi-Fi / Kamera");
  assert.equal(partnerCopy.en.gps, "GPS / Wi-Fi / Camera");
  assert.equal(partnerCopy.ru.gps, "GPS / Wi-Fi / Камера");
  assert.equal(opsCopy.tr.gps, partnerCopy.tr.gps);
  assert.equal(gpsCopy.tr.tabGps, "GPS");
  assert.equal(gpsCopy.en.tabCamera, "Camera");
  assert.equal(gpsCopy.ru.tabCamera, "Камера");
  assert.match(gpsCopy.tr.cameraEmpty, /henüz bağlı değil/);
  assert.equal(gpsCopy.tr.popupAddress, "Adres");
  assert.equal(gpsCopy.tr.showHistory, "Konum geçmişini göster");
  assert.equal(gpsCopy.tr.hideHistory, "Konum geçmişini gizle");
  assert.equal(gpsCopy.tr.showDevice, "Cihaz bilgilerini göster");
  assert.equal(gpsCopy.tr.hideDevice, "Cihaz bilgilerini gizle");
  assert.equal(gpsCopy.tr.deviceInfo, "Cihaz bilgileri");
  assert.equal(gpsCopy.tr.label, "Cihaz adı");
  const live = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  assert.match(live, /copy\.showHistory/);
  assert.match(live, /copy\.showDevice/);
  assert.match(live, /<h2>\{copy\.deviceInfo\}<\/h2>/);
  assert.match(live, /<h2>\{copy\.live\}<\/h2>/);
  assert.doesNotMatch(live, /<h2>\{copy\.label\}<\/h2>/);
  const toggle = readFileSync(new URL("../../components/gps/section-toggle.tsx", import.meta.url), "utf8");
  assert.match(toggle, /useState\(false\)/);
  assert.match(toggle, /ops-btn-secondary ops-contact-toggle/);
  assert.match(toggle, /aria-expanded=\{false\}/);
  assert.match(toggle, /aria-expanded=\{true\}/);
  assert.match(toggle, /<section className="gps-section">/);
  const workspace = readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /copy\.start\}: \{gpsClock\(route\.points/);
});

test("partner gps keeps the fleet map when there is one device", () => {
  assert.equal(soleGpsDevice([]), null);
  assert.deepEqual(soleGpsDevice([{ id: "one" }]), { id: "one" });
  assert.equal(soleGpsDevice([{ id: "one" }, { id: "two" }]), null);
  const page = readFileSync(new URL("../../app/[locale]/partner/(panel)/gps/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /soleGpsDevice/);
  assert.match(page, /listGpsDevices\(actor\.partnerId\)/);
  assert.match(page, /GpsDeviceWorkspace/);
  assert.doesNotMatch(page, /GpsFleetMap|GpsDeviceBoard/);
});

test("marker state keeps ignition-off for an explicit reading", () => {
  assert.equal(gpsMarkerState("online", 2), "moving");
  assert.equal(gpsMarkerState("online", 0), "stopped");
  assert.equal(gpsMarkerState("online", null), "stopped");
  assert.equal(gpsMarkerState("online", 0, null), "stopped");
  assert.equal(gpsMarkerState("online", 0, "on"), "stopped");
  assert.equal(gpsMarkerState("online", 3, "on"), "moving");
  assert.equal(gpsMarkerState("online", 0, "off"), "ignition-off");
  assert.equal(gpsMarkerState("stale", 5, "off"), "idle");
  assert.equal(gpsMarkerState("offline", 0, "off"), "idle");
  const section = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  const map = readFileSync(new URL("../../components/gps/live-map.tsx", import.meta.url), "utf8");
  const factsStart = section.indexOf('<dl className="gps-facts">');
  const facts = section.slice(factsStart, section.indexOf("</dl>", factsStart));
  assert.doesNotMatch(facts, /copy\.heading/);
  assert.match(section, /headingDeg: snapshot\.headingDeg/);
  assert.match(section, /gpsMarkerState\(presence, snapshot\.speedMps, null, moving\)/);
  assert.doesNotMatch(section, /gpsMarkerState\([^)]*accState/);
  assert.doesNotMatch(map, /M12 1\.6|width="22" height="36"/);
  assert.match(map, /gps-status is-\$\{state\}/);
  assert.equal(GPS_MOVING_MPS, 0.5);
  assert.equal(GPS_MOVING_CLEAR_MPS, 0.3);
  assert.equal(gpsSpeedIsMoving(0.4, false), false);
  assert.equal(gpsSpeedIsMoving(0.4, true), true);
  assert.equal(gpsSpeedIsMoving(0.2, true), false);
  assert.equal(gpsPlaybackMarkerState(3, false), "moving");
  assert.equal(gpsPlaybackMarkerState(0, false), "stopped");
  assert.equal(gpsPlaybackMarkerState(12, true), "idle");
  assert.deepEqual([...GPS_PLAYBACK_RATES], [1, 5, 10, 30, 60, 120, 200, 300, 400, 500]);
  const origin = Date.parse("2026-10-06T06:00:00.000Z");
  assert.equal(advancePlaybackCursor(origin, 1_000, 30, origin + 10_000_000), origin + 30_000);
  assert.equal(advancePlaybackCursor(origin, 1_000, 60, origin + 10_000_000), origin + 60_000);
  assert.equal(advancePlaybackCursor(origin, 60_000, 120, origin + 20_000_000), origin + 7_200_000);
  assert.equal(advancePlaybackCursor(origin, 1_000, 200, origin + 10_000_000), origin + 200_000);
  assert.equal(advancePlaybackCursor(origin, 1_000, 300, origin + 10_000_000), origin + 300_000);
  assert.equal(advancePlaybackCursor(origin, 1_000, 400, origin + 10_000_000), origin + 400_000);
  assert.equal(advancePlaybackCursor(origin, 1_000, 500, origin + 10_000_000), origin + 500_000);
});

test("popup shows values only and hides empty fields", () => {
  assert.equal(gpsPopupClock("2026-10-06T14:15:56.000Z"), "06.10.2026 17:15:56");
  assert.equal(gpsPopupClock(null), null);
  assert.equal(gpsPopupSpeed(null), null);
  assert.equal(gpsPopupSpeed(7.6 / 3.6), "7.6 km/h");
  assert.deepEqual(gpsPopupRows(GPS_POPUP_DEFAULTS, {
    plate: "34 EGP 847",
    speed: "7.6 km/h",
    clock: "06.10.2026 17:15:56",
    coordinates: "41.265434, 28.687899",
    address: "Adres servisi henüz bağlı değil",
  }), [
    "34 EGP 847",
    "7.6 km/h",
    "06.10.2026 17:15:56",
    "41.265434, 28.687899",
  ]);
  assert.deepEqual(gpsPopupRows({ ...GPS_POPUP_DEFAULTS, address: true }, {
    plate: "34 EGP 847",
    speed: "—",
    clock: null,
    coordinates: "UNAVAILABLE",
    address: "Ataşehir",
  }), ["34 EGP 847", "Ataşehir"]);
});

test("popup prefs keep plate out of storage and address off by default", () => {
  assert.equal(GPS_POPUP_DEFAULTS.address, false);
  assert.equal(GPS_POPUP_DEFAULTS.speed, true);
  const parsed = readGpsPopupPrefs(JSON.stringify({ address: true, speed: false, plate: false }));
  assert.equal(parsed.address, true);
  assert.equal(parsed.speed, false);
  assert.equal(parsed.clock, true);
  assert.equal("plate" in parsed, false);
  assert.deepEqual(readGpsPopupPrefs("not-json"), GPS_POPUP_DEFAULTS);
});

test("reverse geocode format keeps the short Turkish hierarchy", () => {
  const components = [
    { longName: "3", types: ["street_number"] },
    { longName: "Elmas Sokak", types: ["route"] },
    { longName: "Tayakadın", types: ["administrative_area_level_4", "political"] },
    { longName: "Arnavutköy", types: ["administrative_area_level_2", "political"] },
    { longName: "İstanbul", types: ["administrative_area_level_1", "political"] },
    { longName: "Türkiye", types: ["country", "political"] },
    { longName: "34277", types: ["postal_code"] },
  ];
  assert.equal(formatGpsAddress([{ types: ["street_address"], components }]), "Elmas Sk. No: 3, Tayakadın Mah., Arnavutköy / İstanbul");
  assert.equal(formatGpsAddress([{
    types: ["route"],
    components: components.filter((item) => !item.types.includes("street_number")),
  }]), "Elmas Sk., Tayakadın Mah., Arnavutköy / İstanbul");
  assert.equal(formatGpsAddress([{
    types: ["neighborhood"],
    components: components.filter((item) => !item.types.includes("street_number") && !item.types.includes("route")),
  }]), "Tayakadın Mah., Arnavutköy / İstanbul");
  assert.equal(formatGpsAddress([{
    types: ["park"],
    components: [
      { longName: "Tayakadın Kent Ormanı", types: ["park", "point_of_interest"] },
      ...components.filter((item) => item.types.includes("administrative_area_level_2") || item.types.includes("administrative_area_level_1")),
    ],
  }]), "Tayakadın Kent Ormanı, Arnavutköy / İstanbul");
  assert.equal(gpsAddressCell(41.265301, 28.687729), gpsAddressCell(41.26534, 28.68775));
  assert.notEqual(gpsAddressCell(41.265301, 28.687729), gpsAddressCell(41.2668, 28.687729));
});

test("nearby address lookups share one provider call and failures stay isolated", async () => {
  clearGpsAddressCache();
  let calls = 0;
  const resolve = async () => {
    calls += 1;
    return { status: "ok" as const, address: "Elmas Sk. No: 3, Tayakadın Mah., Arnavutköy / İstanbul" };
  };
  const first = await lookupGpsAddress(41.265301, 28.687729, Date.now(), resolve);
  const second = await lookupGpsAddress(41.26534, 28.68775, Date.now(), resolve);
  assert.equal(calls, 1);
  assert.equal(first, second);
  await lookupGpsAddress(41.2668, 28.687729, Date.now(), resolve);
  assert.equal(calls, 2);
  clearGpsAddressCache();
  let failures = 0;
  const failed = await lookupGpsAddress(41.265301, 28.687729, Date.now(), async () => {
    failures += 1;
    throw new Error("provider down");
  });
  const failedAgain = await lookupGpsAddress(41.26534, 28.68775, Date.now(), async () => {
    failures += 1;
    throw new Error("provider down");
  });
  assert.equal(failures, 1);
  assert.deepEqual(failed, { status: "unavailable", address: null });
  assert.equal(failedAgain, failed);
  const section = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  const pull = section.slice(section.indexOf("async function pull"), section.indexOf("function onVisibility"));
  assert.doesNotMatch(pull, /gps\/address|lookupGpsAddress|geocode/);
});
