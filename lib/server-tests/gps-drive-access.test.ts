import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { databaseNameFromUrl } from "@/lib/db/database-target";

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(new URL("../../.env.development.local", import.meta.url).pathname);
process.env.EXPECTED_DATABASE = "tripetica_dev";
const devDatabase = process.env.DATABASE_URL
  ? databaseNameFromUrl(process.env.DATABASE_URL) === "tripetica_dev"
  : false;

test("partner GPS drive history executes after the access check", { skip: devDatabase ? false : "DEV database is not selected" }, async () => {
  const { getPool, query } = await import("@/lib/db/postgres");
  const { listPhysicalDrivePoints, listVehicleGreenDriving, readDriveVehicle } = await import("@/lib/gps/drive-store");
  const access = (await query<{ partner_id: string; vehicle_id: string }>(
    `SELECT access.partner_id, access.vehicle_id
       FROM partner_vehicle_access access
       JOIN partner_vehicles vehicle ON vehicle.id = access.vehicle_id
      WHERE vehicle.deleted_at IS NULL
      LIMIT 1`,
  )).rows[0];
  try {
    assert.ok(access, "DEV has no vehicle access row");
    const from = new Date("2026-10-25T21:00:00.000Z");
    const to = new Date("2026-10-26T21:00:00.000Z");
    const points = await listPhysicalDrivePoints({
      partnerId: access.partner_id,
      vehicleId: access.vehicle_id,
      from,
      to,
    });
    const green = await listVehicleGreenDriving({
      partnerId: access.partner_id,
      vehicleId: access.vehicle_id,
      from,
      to,
    });
    const profile = await readDriveVehicle(access.partner_id, access.vehicle_id);
    const denied = await listPhysicalDrivePoints({
      partnerId: "00000000-0000-4000-8000-000000000001",
      vehicleId: access.vehicle_id,
      from,
      to,
    });
    assert.equal(Array.isArray(points.points), true);
    assert.equal(typeof points.truncated, "boolean");
    assert.equal(typeof green.parserReady, "boolean");
    assert.equal(Array.isArray(green.events), true);
    assert.equal("brand" in profile, true);
    assert.deepEqual(denied, { points: [], truncated: false });
  } finally {
    await getPool().end();
  }
});
