import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gpsApplyVehicleFix, gpsOpenPopup, gpsSelectVehicle, type GpsFollowFix, type GpsFollowView } from "@/lib/gps/follow";

const vehicleA: GpsFollowFix = { id: "A", latitude: 41.01, longitude: 29.01 };
const vehicleB: GpsFollowFix = { id: "B", latitude: 41.2, longitude: 29.2 };
const vehicleC: GpsFollowFix = { id: "C", latitude: 40.9, longitude: 28.8 };

function view(selected: GpsFollowFix, zoom = 15): GpsFollowView {
  return gpsSelectVehicle(selected, zoom);
}

test("popup open must not change map center away from selected marker", () => {
  const selected = view(vehicleC, 15);
  const opened = gpsOpenPopup(selected);
  assert.equal(opened.selectedId, "C");
  assert.equal(opened.zoom, 15);
  assert.deepEqual(opened.center, vehicleC);
  assert.equal(opened, selected);
});

test("non-selected vehicle position update must not change follow target or map center", () => {
  const selected = view(vehicleA, 14);
  const movedB: GpsFollowFix = { id: "B", latitude: 41.5, longitude: 29.5 };
  const next = gpsApplyVehicleFix(selected, movedB);
  assert.equal(next, selected);
  assert.equal(next.selectedId, "A");
  assert.deepEqual(next.center, vehicleA);
  assert.equal(next.zoom, 14);
});

test("selected vehicle fix recenters on that marker and keeps zoom", () => {
  const selected = view(vehicleA, 16);
  const moved: GpsFollowFix = { id: "A", latitude: 41.02, longitude: 29.03 };
  const next = gpsApplyVehicleFix(selected, moved);
  assert.equal(next.selectedId, "A");
  assert.equal(next.zoom, 16);
  assert.deepEqual(next.center, moved);
});

test("clicking another vehicle switches the follow target immediately", () => {
  const followingA = view(vehicleA, 15);
  const followingB = gpsSelectVehicle(vehicleB, followingA.zoom);
  assert.equal(followingB.selectedId, "B");
  assert.deepEqual(followingB.center, vehicleB);
  assert.equal(followingB.zoom, 15);
  const staleA: GpsFollowFix = { id: "A", latitude: 41.08, longitude: 29.08 };
  const stillB = gpsApplyVehicleFix(followingB, staleA);
  assert.equal(stillB, followingB);
  const movedB: GpsFollowFix = { id: "B", latitude: 41.21, longitude: 29.22 };
  const followed = gpsApplyVehicleFix(followingB, movedB);
  assert.deepEqual(followed.center, movedB);
  assert.equal(followed.zoom, 15);
  assert.notEqual(followed.selectedId, vehicleC.id);
});

test("live map popup cannot pan the selected marker off center", () => {
  const map = readFileSync(new URL("../../components/gps/live-map.tsx", import.meta.url), "utf8");
  assert.match(map, /autoPan:\s*false/);
  assert.match(map, /keepInView:\s*false/);
  assert.match(map, /autoPanOnFocus:\s*false/);
  assert.match(map, /gpsApplyVehicleFix/);
  assert.match(map, /gpsSelectVehicle/);
  assert.match(map, /animate:\s*false/);
  const popupOpen = map.slice(map.indexOf('"popupopen"'), map.indexOf('"popupclose"'));
  assert.doesNotMatch(popupOpen, /setView|panTo|panBy|fitBounds|flyTo/);
  assert.match(map, /GLIDE_MS = 800/);
});
