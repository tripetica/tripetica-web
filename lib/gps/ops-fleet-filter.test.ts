import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  adoptFleetSelection,
  groupOpsFleet,
  opsFleetChoices,
  partnerSelection,
  searchOpsFleet,
  togglePartnerSelection,
  toggleVehicleSelection,
  visibleFleetIds,
  type OpsFleetChoice,
} from "@/lib/gps/ops-fleet-filter";

const vehicles: OpsFleetChoice[] = [
  { id: "d1", partnerId: "p2", partnerName: "Search Travel", plate: "34BZC564", driverName: "Muhammet Elbiseci", deviceCode: "TPT-1", source: "device" },
  { id: "m1", partnerId: "p1", partnerName: "GM Global", plate: "34EGP847", driverName: "Recep Yıldırım", deviceCode: "Recep Yıldırım", source: "mobile" },
  { id: "d2", partnerId: "p1", partnerName: "GM Global", plate: "34ABC123", driverName: null, deviceCode: "TPT-2", source: "device" },
];

test("partners are alphabetical and every vehicle starts available to select", () => {
  const groups = groupOpsFleet(vehicles);
  assert.deepEqual(groups.map((group) => group.partnerName), ["GM Global", "Search Travel"]);
  assert.deepEqual(groups[0]?.vehicles.map((vehicle) => vehicle.plate), ["34ABC123", "34EGP847"]);
  const selected = new Set(vehicles.map((vehicle) => vehicle.id));
  assert.equal(visibleFleetIds(vehicles, selected).length, 3);
  assert.equal(partnerSelection(["d2", "m1"], selected), "all");
});

test("search matches partner, plate, and driver without changing the selection", () => {
  const groups = groupOpsFleet(vehicles);
  const selected = new Set(["d2"]);
  assert.deepEqual(searchOpsFleet(groups, "yıldırım").flatMap((group) => group.vehicles.map((vehicle) => vehicle.id)), ["m1"]);
  assert.deepEqual(searchOpsFleet(groups, "34ABC").flatMap((group) => group.vehicles.map((vehicle) => vehicle.id)), ["d2"]);
  assert.equal(searchOpsFleet(groups, "search").length, 1);
  assert.equal(searchOpsFleet(groups, "search")[0]?.vehicles.length, 1);
  assert.deepEqual([...selected], ["d2"]);
});

test("partner and vehicle toggles stay partial and do not invent a driver row", () => {
  let selected = new Set(vehicles.map((vehicle) => vehicle.id));
  selected = toggleVehicleSelection(selected, "m1");
  assert.equal(partnerSelection(["d2", "m1"], selected), "some");
  assert.deepEqual(visibleFleetIds(vehicles, selected).map((vehicle) => vehicle.id).sort(), ["d1", "d2"]);
  selected = togglePartnerSelection(selected, ["d2", "m1"], false);
  assert.equal(partnerSelection(["d2", "m1"], selected), "none");
  assert.deepEqual(visibleFleetIds(vehicles, selected).map((vehicle) => vehicle.id), ["d1"]);
  selected = togglePartnerSelection(selected, ["d2", "m1"], true);
  assert.equal(partnerSelection(["d2", "m1"], selected), "all");
  assert.equal(vehicles.find((vehicle) => vehicle.id === "d2")?.driverName, null);
});

test("a cleared vehicle stays cleared when the fleet refreshes and a new one starts selected", () => {
  const seen = new Set(["d1", "d2", "m1"]);
  const cleared = toggleVehicleSelection(new Set(["d1", "d2", "m1"]), "m1");
  const refreshed = adoptFleetSelection(cleared, seen, ["d1", "d2", "m1", "d3"]);
  assert.equal(refreshed.selected.has("m1"), false);
  assert.equal(refreshed.selected.has("d3"), true);
  const gone = adoptFleetSelection(refreshed.selected, refreshed.seen, ["d2", "d3"]);
  assert.equal(gone.selected.has("d1"), false);
  assert.equal(gone.selected.has("d2"), true);
});

test("ops map reads through an ops session and the partner fleet route stays partner scoped", () => {
  const partner = readFileSync(new URL("../../app/api/gps/fleet/route.ts", import.meta.url), "utf8");
  const ops = readFileSync(new URL("../../app/api/ops/gps/fleet/route.ts", import.meta.url), "utf8");
  const partnerPage = readFileSync(new URL("../../app/[locale]/partner/(panel)/gps/page.tsx", import.meta.url), "utf8");
  const opsPage = readFileSync(new URL("../../app/[locale]/ops/(panel)/gps/page.tsx", import.meta.url), "utf8");
  assert.match(partner, /getPartnerActor/);
  assert.match(partner, /listGpsDevices\(partner\.partnerId\)/);
  assert.doesNotMatch(partner, /getOpsActor|loadOpsMapFleet/);
  assert.match(ops, /getOpsActor/);
  assert.match(ops, /gps\.view/);
  assert.doesNotMatch(ops, /getPartnerActor/);
  assert.doesNotMatch(partnerPage, /loadOpsMapFleet|opsFilter/);
  const filter = readFileSync(new URL("../../components/gps/ops-fleet-filter.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.match(filter, /useState\(false\)/);
  assert.match(filter, /aria-expanded=\{open\}/);
  assert.match(filter, /ops-gps-filter-panel/);
  assert.doesNotMatch(filter, /<details/);
  assert.match(css, /\.ops-gps-filter-panel\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.ops-gps-partners\s*\{[^}]*max-height:\s*13\.75rem/);
  assert.match(css, /\.gps-map\s*\{[^}]*height:\s*440px/);
  assert.match(opsPage, /OpsGpsTabs/);
  assert.match(opsPage, /GpsDeviceBoard/);
  assert.doesNotMatch(opsPage, /submitUetds|ats-run|openAtsRuntime/);
});

test("stock devices stay on the ops fleet filter without a partner or plate", () => {
  const choices = opsFleetChoices([
    { id: "assigned", partnerId: "p1", partnerName: "Search Travel", plate: "34ABC123", driverName: "Ada", deviceCode: "TPT-A", source: "device" },
    { id: "stock", partnerId: null, partnerName: null, plate: null, driverName: null, deviceCode: "TPT-20CBB2C1A032", source: "device" },
    { id: "mobile", partnerId: "p1", partnerName: "Search Travel", plate: "34EGP847", driverName: "Recep", deviceCode: "Recep", source: "mobile" },
  ], "Stokta");
  const groups = groupOpsFleet(choices);
  assert.deepEqual(groups.map((group) => group.partnerName), ["Search Travel", "Stokta"]);
  const stock = groups.find((group) => group.partnerId === "stock");
  assert.equal(stock?.vehicles.length, 1);
  assert.equal(stock?.vehicles[0]?.plate, null);
  assert.equal(stock?.vehicles[0]?.deviceCode, "TPT-20CBB2C1A032");
  assert.deepEqual(searchOpsFleet(groups, "20cbb").map((group) => group.partnerId), ["stock"]);
});
