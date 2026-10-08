import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { googleMapsUrl, yandexMapsUrl } from "@/lib/gps/format";
import { gpsApplyVehicleFix, gpsOpenPopup, gpsSelectVehicle } from "@/lib/gps/follow";
import {
  GPS_FLEET_FOLLOW_ZOOM,
  GPS_FLEET_GLIDE_MS,
  gpsFleetFrame,
  gpsFleetIdsChanged,
  gpsFleetKeepSelection,
  gpsFleetPadding,
  gpsFleetPlotted,
  gpsFleetHistoryReady,
  gpsFleetMarkerClick,
  gpsFleetOpening,
  gpsFleetPoint,
  gpsFleetPopupClosed,
  gpsFleetUnlocated,
  readGpsFleet,
  type GpsFleetVehicle,
} from "@/lib/gps/fleet";

const istanbul = { latitude: 41.015, longitude: 28.979 };
const bursa = { latitude: 40.195, longitude: 29.06 };
const edirne = { latitude: 41.677, longitude: 26.556 };

function vehicle(id: string, point: { latitude: number; longitude: number } | null, extra: Partial<GpsFleetVehicle> = {}): GpsFleetVehicle {
  return {
    id,
    plate: extra.plate ?? id,
    deviceCode: extra.deviceCode ?? `TPT-${id}`,
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    speedMps: extra.speedMps ?? null,
    headingDeg: extra.headingDeg ?? null,
    recordedAt: extra.recordedAt ?? "2026-10-07T21:00:00.000Z",
    lastHeartbeatAt: extra.lastHeartbeatAt ?? "2026-10-07T21:00:00.000Z",
  };
}

test("fleet map excludes missing and invalid coordinates", () => {
  assert.equal(gpsFleetPoint(null, 29), null);
  assert.equal(gpsFleetPoint(41, null), null);
  assert.equal(gpsFleetPoint(Number.NaN, 29), null);
  assert.equal(gpsFleetPoint(91, 29), null);
  assert.equal(gpsFleetPoint(41, 181), null);
  assert.deepEqual(gpsFleetPoint(41.01, 28.98), { latitude: 41.01, longitude: 28.98 });
  const fleet = [
    vehicle("missing", null),
    vehicle("invalid", { latitude: 120, longitude: 10 }),
    vehicle("ok", istanbul),
  ];
  assert.deepEqual(gpsFleetPlotted(fleet).map((item) => item.id), ["ok"]);
  assert.deepEqual(gpsFleetUnlocated(fleet).map((item) => item.id), ["missing", "invalid"]);
});

test("empty, single, ten-vehicle, and spread fleets choose the right frame", () => {
  assert.deepEqual(gpsFleetFrame([]), { kind: "empty" });
  const one = gpsFleetFrame([istanbul]);
  assert.deepEqual(one, { kind: "single", point: istanbul, zoom: GPS_FLEET_FOLLOW_ZOOM });
  const ten = Array.from({ length: 10 }, (_, index) => ({
    latitude: 41 + index * 0.01,
    longitude: 29 + index * 0.01,
  }));
  const city = gpsFleetFrame(ten);
  assert.equal(city.kind, "bounds");
  if (city.kind === "bounds") {
    assert.equal(city.points.length, 10);
  }
  const spread = gpsFleetFrame([istanbul, bursa, edirne]);
  assert.equal(spread.kind, "bounds");
  if (spread.kind === "bounds") {
    assert.equal(spread.points.length, 3);
  }
  assert.deepEqual(gpsFleetPadding(390), [16, 16]);
  assert.deepEqual(gpsFleetPadding(1200), [24, 24]);
});

test("fleet view does not refit when only coordinates change", () => {
  const before = ["a", "b", "c"];
  assert.equal(gpsFleetIdsChanged(before, ["c", "a", "b"]), false);
  assert.equal(gpsFleetIdsChanged(before, ["a", "b"]), true);
  assert.equal(gpsFleetIdsChanged(before, ["a", "b", "c", "d"]), true);
});

test("selected vehicle follow ignores other vehicles and popup pan", () => {
  const selected = gpsSelectVehicle({ id: "C", ...edirne }, GPS_FLEET_FOLLOW_ZOOM);
  const other = gpsApplyVehicleFix(selected, { id: "A", latitude: 41.2, longitude: 29.2 });
  assert.equal(other, selected);
  const moved = gpsApplyVehicleFix(selected, { id: "C", latitude: 41.7, longitude: 26.6 });
  assert.equal(moved.selectedId, "C");
  assert.equal(moved.zoom, GPS_FLEET_FOLLOW_ZOOM);
  assert.deepEqual(moved.center, { id: "C", latitude: 41.7, longitude: 26.6 });
  const opened = gpsOpenPopup(moved);
  assert.equal(opened.zoom, moved.zoom);
  assert.deepEqual(opened.center, moved.center);
  const switched = gpsSelectVehicle({ id: "H", ...bursa }, moved.zoom);
  assert.equal(switched.selectedId, "H");
  assert.deepEqual(switched.center, { id: "H", ...bursa });
  assert.equal(gpsApplyVehicleFix(switched, { id: "C", latitude: 41.8, longitude: 26.7 }), switched);
});

test("lost selection returns to the fleet", () => {
  const fleet = [vehicle("A", istanbul), vehicle("B", null, { lastHeartbeatAt: null, recordedAt: null })];
  assert.equal(gpsFleetKeepSelection("A", fleet), "A");
  assert.equal(gpsFleetKeepSelection("B", fleet), null);
  assert.equal(gpsFleetKeepSelection("C", fleet), null);
  assert.equal(gpsFleetKeepSelection(null, fleet), null);
  assert.equal(GPS_FLEET_GLIDE_MS, 800);
});

test("one vehicle starts selected with the popup closed and can be opened again", () => {
  const opened = gpsFleetOpening(["only"]);
  assert.deepEqual(opened, { selectedId: "only", popupId: null });
  const shown = gpsFleetMarkerClick(opened, "only");
  assert.deepEqual(shown, { selectedId: "only", popupId: "only" });
  const closed = gpsFleetPopupClosed(shown);
  assert.deepEqual(closed, { selectedId: "only", popupId: null });
  assert.deepEqual(gpsFleetMarkerClick(closed, "only"), { selectedId: "only", popupId: "only" });
  assert.equal(gpsFleetHistoryReady(1, "only"), true);
  assert.equal(gpsFleetHistoryReady(1, null), true);
});

test("many vehicles start unselected and history waits for a map choice", () => {
  const opened = gpsFleetOpening(["a", "b", "c", "d"]);
  assert.deepEqual(opened, { selectedId: null, popupId: null });
  assert.equal(gpsFleetHistoryReady(4, null), false);
  const first = gpsFleetMarkerClick(opened, "b");
  assert.deepEqual(first, { selectedId: "b", popupId: "b" });
  const hidden = gpsFleetPopupClosed(first);
  assert.equal(hidden.selectedId, "b");
  assert.equal(hidden.popupId, null);
  assert.equal(gpsFleetHistoryReady(4, hidden.selectedId), true);
  const second = gpsFleetMarkerClick(hidden, "c");
  assert.deepEqual(second, { selectedId: "c", popupId: "c" });
  assert.deepEqual(gpsFleetOpening([]), { selectedId: null, popupId: null });
});

test("map links pin the coordinate and do not start a route", () => {
  const google = googleMapsUrl(41.015, 28.979);
  const yandex = yandexMapsUrl(41.015, 28.979);
  assert.match(google ?? "", /google\.com\/maps\/search\/\?api=1&query=41\.015,28\.979/);
  assert.doesNotMatch(google ?? "", /dir\/|travelmode|destination=/);
  assert.match(yandex ?? "", /ll=28\.979,41\.015/);
  assert.match(yandex ?? "", /pt=28\.979,41\.015/);
  assert.match(yandex ?? "", /z=16&l=map/);
  assert.doesNotMatch(yandex ?? "", /rtext|rtt=/);
  assert.equal(googleMapsUrl(91, 29), null);
  assert.equal(yandexMapsUrl(41, Number.NaN), null);
});

test("fleet endpoint stays partner scoped and the live map is the partner home", () => {
  const route = readFileSync(new URL("../../app/api/gps/fleet/route.ts", import.meta.url), "utf8");
  assert.match(route, /getPartnerActor/);
  assert.match(route, /listGpsDevices\(partner\.partnerId\)/);
  assert.doesNotMatch(route, /listGpsDevices\(null\)/);
  assert.doesNotMatch(route, /getGpsLive\(/);
  const page = readFileSync(new URL("../../app/[locale]/partner/(panel)/gps/page.tsx", import.meta.url), "utf8");
  assert.match(page, /listGpsDevices\(actor\.partnerId\)/);
  assert.match(page, /devices\.find/);
  assert.match(page, /GpsDeviceWorkspace/);
  assert.doesNotMatch(page, /getGpsDevice\(|soleGpsDevice|GpsFleetMap|GpsDeviceBoard/);
  const map = readFileSync(new URL("../../components/gps/live-map.tsx", import.meta.url), "utf8");
  assert.match(map, /autoPan:\s*false/);
  assert.match(map, /keepInView:\s*false/);
  assert.match(map, /GPS_FLEET_GLIDE_MS/);
  assert.match(map, /gpsFleetMarkerClick/);
  assert.match(map, /loadFleetAddress\(selectedFleetRef\.current\)/);
  assert.match(map, /followHeldRef/);
  assert.doesNotMatch(map, /fleetLabel|gps-fleet-control|showFleetNow|Tüm filoyu göster/);
  const click = map.slice(map.indexOf("gpsFleetMarkerClick"), map.indexOf("fleetMarkers.current.set"));
  assert.match(click, /openPopup\(\)/);
  assert.doesNotMatch(click, /if \(same\) return|if \(previous === pin\.id\) return/);
  const section = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  assert.match(section, /GPS_LIVE_POLL_MS/);
  assert.match(section, /document\.hidden/);
  assert.match(section, /copy\.historyPick/);
  assert.match(section, /copy\.batteryLevel/);
  assert.doesNotMatch(section, /showFleet|onShowFleet|preserveSelection/);
  assert.doesNotMatch(section, /\{deviceCode\} · \{copy\[presence\]\}/);
  const history = readFileSync(new URL("../../components/gps/history-playback.tsx", import.meta.url), "utf8");
  assert.match(history, /interactive: false/);
});

test("fleet payload drops invalid coordinates and rejects a bad body", () => {
  const vehicles = readGpsFleet({
    vehicles: [
      { id: "a", deviceCode: "TPT-A", plate: "34 A", latitude: 41, longitude: 29, speedMps: 1, headingDeg: null, recordedAt: null, lastHeartbeatAt: null },
      { id: "b", deviceCode: "TPT-B", plate: null, latitude: 99, longitude: 29, speedMps: null, headingDeg: null, recordedAt: null, lastHeartbeatAt: null },
    ],
  });
  assert.equal(vehicles?.[0]?.latitude, 41);
  assert.equal(vehicles?.[1]?.latitude, null);
  assert.equal(readGpsFleet({ ok: true }), null);
  assert.equal(readGpsFleet(null), null);
});
