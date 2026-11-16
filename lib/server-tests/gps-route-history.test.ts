import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { databaseNameFromUrl } from "@/lib/db/database-target";
import type { GpsRegistrationProfile } from "@/lib/gps/registration";

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

const profile = {
  receiver: "teltonika",
  manufacturer: "teltonika",
  trackerModel: "fmb920",
  linkTechnology: "2g",
  serialNumber: null,
  simPhone: null,
  simOperator: "Turkcell",
  simApn: null,
  installationStatus: "pending",
} satisfies Omit<GpsRegistrationProfile, "imei">;

test("vehicle history follows the vehicle across a device change", { skip: devDatabase ? false : "DEV database is not selected" }, async () => {
  const { getPool, query } = await import("@/lib/db/postgres");
  const { assignGpsDevice, createGpsDevice, listGpsRoute } = await import("@/lib/gps/queries");
  const database = await query<{ name: string }>("SELECT current_database() AS name");
  assert.equal(database.rows[0]?.name, "tripetica_dev");
  const before = await query<{ total: number }>("SELECT COUNT(*)::int AS total FROM gps_positions");
  const vehicles = await query<{ id: string; partner_id: string }>(
    `SELECT vehicle.id::text AS id, vehicle.partner_id::text AS partner_id
       FROM partner_vehicles vehicle
      WHERE vehicle.deleted_at IS NULL
        AND vehicle.partner_id = (
          SELECT partner_id
            FROM partner_vehicles
           WHERE deleted_at IS NULL
           GROUP BY partner_id
          HAVING COUNT(*) >= 2
           LIMIT 1
        )
      ORDER BY vehicle.created_at
      LIMIT 2`,
  );
  const vehicleA = vehicles.rows[0];
  const vehicleB = vehicles.rows[1];
  assert.ok(vehicleA && vehicleB);
  const created: string[] = [];
  let guestId: string | null = null;
  const base = Date.now() - 20 * 60_000;
  const from = new Date(base - 60_000);
  const earlyEnd = new Date(base + 5 * 60_000);
  const to = new Date(base + 40 * 60_000);
  try {
    const first = await createGpsDevice({
      partnerId: vehicleA.partner_id,
      vehicleId: vehicleA.id,
      label: "Route history probe A",
      profile: { ...profile, imei: `91${String(base).slice(-13)}` },
      assignedBy: "route-history-probe",
    });
    created.push(first.id);
    const second = await createGpsDevice({
      partnerId: vehicleA.partner_id,
      vehicleId: vehicleA.id,
      label: "Route history probe B",
      profile: { ...profile, imei: `92${String(base + 1).slice(-13)}` },
      assignedBy: "route-history-probe",
    });
    created.push(second.id);
    const stock = await createGpsDevice({
      partnerId: null,
      vehicleId: null,
      label: "Route history probe stock",
      profile: { ...profile, imei: `93${String(base + 2).slice(-13)}` },
      assignedBy: "route-history-probe",
    });
    created.push(stock.id);
    await query(
      `INSERT INTO gps_positions (device_id, partner_id, vehicle_id, seq, recorded_at, latitude, longitude)
       VALUES ($1, $2, $3, 1, $4, 41.11, 29.11),
              ($5, $2, $3, 1, $6, 41.12, 29.12)`,
      [first.id, vehicleA.partner_id, vehicleA.id, new Date(base).toISOString(), second.id, new Date(base + 10 * 60_000).toISOString()],
    );
    await assignGpsDevice({
      deviceId: second.id,
      partnerId: vehicleB.partner_id,
      vehicleId: vehicleB.id,
      assignedBy: "route-history-probe",
    });
    await query(
      `INSERT INTO gps_positions (device_id, partner_id, vehicle_id, seq, recorded_at, latitude, longitude)
       VALUES ($1, $2, $3, 2, $4, 41.21, 29.21),
              ($5, NULL, NULL, 1, $6, 41.31, 29.31)`,
      [second.id, vehicleB.partner_id, vehicleB.id, new Date(base + 20 * 60_000).toISOString(), stock.id, new Date(base + 5 * 60_000).toISOString()],
    );
    const kept = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
         FROM gps_positions
        WHERE device_id = $1 AND vehicle_id = $2 AND latitude = 41.12`,
      [second.id, vehicleA.id],
    );
    assert.equal(kept.rows[0]?.total, 1);

    const single = await listGpsRoute({
      deviceId: second.id,
      partnerId: vehicleB.partner_id,
      vehicleId: vehicleB.id,
      accessPartnerId: null,
      from,
      to,
    });
    assert.deepEqual(single.points.map((point) => point.latitude), [41.21]);
    assert.equal(single.step, 1);

    const combined = await listGpsRoute({
      deviceId: second.id,
      partnerId: vehicleA.partner_id,
      vehicleId: vehicleA.id,
      accessPartnerId: vehicleA.partner_id,
      from,
      to,
    });
    assert.deepEqual(combined.points.map((point) => point.latitude), [41.11, 41.12]);
    assert.equal(combined.total, 2);
    assert.equal(combined.step, 1);
    assert.equal(combined.points[0]?.plate === combined.points[1]?.plate, true);
    assert.deepEqual(combined.points.map((point) => point.recordedAt), [
      new Date(base).toISOString(),
      new Date(base + 10 * 60_000).toISOString(),
    ]);

    const early = await listGpsRoute({
      deviceId: first.id,
      partnerId: vehicleA.partner_id,
      vehicleId: vehicleA.id,
      accessPartnerId: null,
      from,
      to: earlyEnd,
    });
    assert.deepEqual(early.points.map((point) => point.latitude), [41.11]);

    const moved = await listGpsRoute({
      deviceId: second.id,
      partnerId: vehicleB.partner_id,
      vehicleId: vehicleB.id,
      accessPartnerId: vehicleB.partner_id,
      from,
      to,
    });
    assert.deepEqual(moved.points.map((point) => point.latitude), [41.21]);
    assert.equal(moved.points[0]?.plate === combined.points[0]?.plate, false);

    const stockRoute = await listGpsRoute({
      deviceId: stock.id,
      partnerId: null,
      vehicleId: null,
      accessPartnerId: null,
      from,
      to,
    });
    assert.deepEqual(stockRoute.points.map((point) => point.latitude), [41.31]);
    assert.equal(combined.points.some((point) => point.latitude === 41.31), false);
    assert.equal(moved.points.some((point) => point.latitude === 41.12), false);

    const denied = await listGpsRoute({
      deviceId: first.id,
      partnerId: vehicleA.partner_id,
      vehicleId: vehicleA.id,
      accessPartnerId: "00000000-0000-0000-0000-000000000000",
      from,
      to,
    });
    assert.deepEqual(denied.points, []);

    const guest = await query<{ id: string }>(
      `INSERT INTO partners (partner_code, name, status)
       SELECT code, 'Route history probe', 'active'
         FROM (
           SELECT 'PTR-' || lpad(n::text, 4, '0') AS code
             FROM generate_series(9000, 9999) AS n
         ) candidates
        WHERE NOT EXISTS (SELECT 1 FROM partners WHERE partner_code = candidates.code)
        LIMIT 1
       RETURNING id::text AS id`,
    );
    guestId = guest.rows[0]?.id ?? null;
    assert.ok(guestId);
    await query(
      `INSERT INTO partner_vehicle_access (vehicle_id, partner_id)
       VALUES ($1, $2)
       ON CONFLICT (vehicle_id, partner_id) DO NOTHING`,
      [vehicleA.id, guestId],
    );
    const shared = await listGpsRoute({
      deviceId: second.id,
      partnerId: vehicleA.partner_id,
      vehicleId: vehicleA.id,
      accessPartnerId: guestId,
      from,
      to,
    });
    assert.deepEqual(shared.points.map((point) => point.latitude), [41.11, 41.12]);
    const otherVehicle = await listGpsRoute({
      deviceId: second.id,
      partnerId: vehicleB.partner_id,
      vehicleId: vehicleB.id,
      accessPartnerId: guestId,
      from,
      to,
    });
    assert.deepEqual(otherVehicle.points, []);
  } finally {
    if (guestId && vehicleA) {
      await query(
        `DELETE FROM partner_vehicle_access WHERE vehicle_id = $1 AND partner_id = $2`,
        [vehicleA.id, guestId],
      );
      await query(
        `DELETE FROM partners WHERE id = $1 AND name = 'Route history probe'`,
        [guestId],
      );
    }
    if (created.length > 0) {
      await query(`DELETE FROM gps_devices WHERE id = ANY($1::uuid[])`, [created]);
    }
    const after = await query<{ total: number }>("SELECT COUNT(*)::int AS total FROM gps_positions");
    assert.equal(after.rows[0]?.total, before.rows[0]?.total);
    await getPool().end();
  }
});
