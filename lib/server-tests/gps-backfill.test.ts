import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { databaseNameFromUrl } from "@/lib/db/database-target";
import type { GpsPoint } from "@/lib/gps/contract";

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

function point(seq: number, recordedAt: Date, latitude: number): GpsPoint {
  return {
    seq,
    gnssTime: recordedAt,
    lat: latitude,
    lon: 29,
    speedMps: seq,
    headingDeg: seq * 10,
    altitudeM: null,
    fixMode: "3d",
    satellites: 10,
    hdop: null,
    pdop: null,
    vdop: null,
  };
}

test("Teltonika shared ingest preserves backfill order on DEV", { skip: devDatabase ? false : "DEV database is not selected" }, async () => {
  const { getPool, query } = await import("@/lib/db/postgres");
  const { ingestTelemetry } = await import("@/lib/gps/ingest");
  const { createGpsDevice, listGpsRoute } = await import("@/lib/gps/queries");
  const owner = (await query<{ partner_id: string; vehicle_id: string }>(
    `SELECT device.partner_id, device.vehicle_id
       FROM gps_devices device
       JOIN partner_vehicles vehicle
         ON vehicle.id = device.vehicle_id AND vehicle.partner_id = device.partner_id
      WHERE device.receiver = 'teltonika'
        AND device.partner_id IS NOT NULL
        AND device.vehicle_id IS NOT NULL
        AND device.deleted_at IS NULL
        AND vehicle.deleted_at IS NULL
      LIMIT 1`,
  )).rows[0];
  if (!owner) {
    await getPool().end();
    return;
  }

  const imei = `99${Date.now().toString().slice(-13)}`;
  const created = await createGpsDevice({
    partnerId: owner.partner_id,
    vehicleId: owner.vehicle_id,
    label: "Teltonika backfill probe",
    profile: {
      receiver: "teltonika",
      manufacturer: "teltonika",
      trackerModel: "fmb920",
      linkTechnology: "2g",
      imei,
      serialNumber: null,
      simPhone: null,
      simOperator: "Turkcell",
      simApn: null,
      installationStatus: "pending",
    },
    assignedBy: "teltonika-backfill-test",
  });
  const base = Date.now() - 5 * 60_000;
  try {
    const latest = point(5, new Date(base + 5 * 60_000), 41.5);
    assert.equal((await ingestTelemetry(created.id, [latest], [])).http, 200);
    const older = [point(4, new Date(base + 4 * 60_000), 41.4), point(2, new Date(base + 2 * 60_000), 41.2)];
    const result = await ingestTelemetry(created.id, older, []);
    assert.equal(result.http, 200);
    if (result.http === 200) assert.equal(result.liveAdvanced, false);
    const route = await listGpsRoute({
      deviceId: created.id,
      partnerId: owner.partner_id,
      vehicleId: owner.vehicle_id,
      accessPartnerId: null,
      from: new Date(base),
      to: new Date(base + 10 * 60_000),
    });
    assert.deepEqual(route.points.map((item) => item.seq), [2, 4, 5]);
  } finally {
    await query(`DELETE FROM gps_devices WHERE id = $1`, [created.id]);
    await getPool().end();
  }
});
