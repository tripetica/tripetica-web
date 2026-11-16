import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const route = queries.slice(
  queries.indexOf("export async function listGpsRoute"),
  queries.indexOf("export async function listGpsPartners"),
);
const ops = readFileSync(new URL("../../app/[locale]/ops/(panel)/gps/page.tsx", import.meta.url), "utf8");
const opsDevice = readFileSync(new URL("../../app/[locale]/ops/(panel)/gps/[id]/page.tsx", import.meta.url), "utf8");
const partner = readFileSync(new URL("../../app/[locale]/partner/(panel)/gps/page.tsx", import.meta.url), "utf8");
const driver = readFileSync(new URL("../../app/[locale]/(driver-portal)/driver/gps/page.tsx", import.meta.url), "utf8");

test("an assigned vehicle route reads partner and vehicle, not the current device", () => {
  assert.match(route, /partner_id = \$1 AND vehicle_id = \$2/);
  assert.match(route, /position\.partner_id = \$1 AND position\.vehicle_id = \$2/);
  assert.match(route, /ORDER BY position\.recorded_at, position\.seq/);
  assert.match(route, /\(\(n - 1\) % /);
  assert.doesNotMatch(route, /device_id = \$1 AND vehicle_id = \$4/);
  assert.doesNotMatch(route, /UPDATE gps_positions|DELETE FROM gps_positions|INSERT INTO gps_positions/);
});

test("a stock device route stays on that device and empty vehicle", () => {
  assert.match(route, /device_id = \$1 AND vehicle_id IS NULL/);
  assert.match(route, /position\.device_id = \$1 AND position\.vehicle_id IS NULL/);
});

test("partner and driver history uses vehicle access and ops does not borrow a device owner", () => {
  assert.match(route, /partner_can_access_vehicle\(\$1, \$2\)/);
  assert.match(route, /partner_can_access_gps_device\(\$1, \$2\)/);
  assert.match(partner, /accessPartnerId: actor\.partnerId/);
  assert.match(driver, /accessPartnerId: actor\.partnerId/);
  assert.match(ops, /accessPartnerId: null/);
  assert.match(opsDevice, /accessPartnerId: null/);
  assert.match(partner, /vehicleId: selected\.vehicleId/);
  assert.match(driver, /vehicleId: selected\.vehicleId/);
  assert.match(ops, /vehicleId: device\.vehicleId/);
  assert.match(opsDevice, /vehicleId: device\.vehicleId/);
});
