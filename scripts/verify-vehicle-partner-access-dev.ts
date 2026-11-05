import assert from "node:assert/strict";
import { Client } from "pg";
import { assertExpectedDatabase } from "../lib/db/database-target";
import { loadDevelopmentEnv } from "./load-env";

loadDevelopmentEnv();
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
assertExpectedDatabase(databaseUrl, "tripetica_dev");

const client = new Client({ connectionString: databaseUrl });
async function main() {
  await client.connect();
  try {
    await client.query("BEGIN");
  const fixture = await client.query<{
    vehicle_id: string;
    creator_partner_id: string;
    alternate_partner_id: string;
    driver_id: string | null;
    device_id: string | null;
  }>(
    `SELECT vehicle.id AS vehicle_id,
            vehicle.partner_id AS creator_partner_id,
            alternate.id AS alternate_partner_id,
            pairing.driver_id,
            device.id AS device_id
       FROM partner_vehicles vehicle
       JOIN LATERAL (
         SELECT partner.id
           FROM partners partner
          WHERE partner.id <> vehicle.partner_id
            AND partner.deleted_at IS NULL
            AND partner.status = 'active'
          ORDER BY partner.id
          LIMIT 1
       ) alternate ON TRUE
       LEFT JOIN partner_fleet_defaults pairing ON pairing.vehicle_id = vehicle.id
       LEFT JOIN gps_devices device
         ON device.vehicle_id = vehicle.id
        AND device.deleted_at IS NULL
        AND device.receiver = 'teltonika'
      WHERE vehicle.deleted_at IS NULL
      ORDER BY (pairing.driver_id IS NOT NULL)::int + (device.id IS NOT NULL)::int DESC, vehicle.id
      LIMIT 1`,
  );
  const row = fixture.rows[0];
  assert.ok(row, "DEV requires one vehicle and two active partners");
  if (!row.driver_id) {
    const driver = await client.query<{ id: string }>(
      `INSERT INTO partner_drivers (
         partner_id, first_name, last_name, status, languages, vehicle_derived_visibility
       ) VALUES ($1, 'Access', 'Regression', 'active', ARRAY['tr'], TRUE)
       RETURNING id`,
      [row.creator_partner_id],
    );
    row.driver_id = driver.rows[0]?.id ?? null;
    assert.ok(row.driver_id);
    await client.query(
      `INSERT INTO partner_fleet_defaults (partner_id, driver_id, vehicle_id)
       VALUES ($1, $2, $3)`,
      [row.creator_partner_id, row.driver_id, row.vehicle_id],
    );
  }
  if (!row.device_id) {
    const device = await client.query<{ id: string }>(
      `INSERT INTO gps_devices (
         partner_id, vehicle_id, device_code, label, imei, receiver, tracker_model,
         manufacturer, link_technology, installation_status, live_source
       ) VALUES (
         $1, $2, 'TPT-' || upper(substr(md5(random()::text), 1, 12)),
         'Access regression', lpad(floor(random() * 1000000000000000)::bigint::text, 15, '0'),
         'teltonika', 'fmb920', 'teltonika', '2g', 'pending', FALSE
       )
       RETURNING id`,
      [row.creator_partner_id, row.vehicle_id],
    );
    row.device_id = device.rows[0]?.id ?? null;
    assert.ok(row.device_id);
  }

  const before = await protectedCounts(row.vehicle_id);
  await client.query(
    `INSERT INTO partner_vehicle_access (vehicle_id, partner_id, uetds_company_id)
     SELECT $1, $2, uetds_company_id
       FROM partner_vehicles
      WHERE id = $1
     ON CONFLICT (vehicle_id, partner_id) DO NOTHING`,
    [row.vehicle_id, row.alternate_partner_id],
  );

  assert.equal(await canAccess("partner_can_access_vehicle", row.alternate_partner_id, row.vehicle_id), true);
  assert.equal(await canAccess("partner_can_access_driver", row.alternate_partner_id, row.driver_id), true);
  assert.equal(await canAccess("partner_can_access_gps_device", row.alternate_partner_id, row.device_id), true);
  const notification = await client.query<{ id: string }>(
    `INSERT INTO uetds_notifications (
       partner_id, source, actor_type, actor_user_id, status, company_short_name,
       driver_id, vehicle_id, snapshot, ministry_env
     ) VALUES (
       $1, 'manual', 'partner', gen_random_uuid(), 'recorded', 'ACCESS-REGRESSION',
       $2, $3, jsonb_build_object(
         'driver', jsonb_build_object('id', $2::uuid),
         'vehicle', jsonb_build_object('id', $3::uuid, 'plate', 'TEST')
       ), 'none'
     )
     RETURNING id`,
    [row.creator_partner_id, row.driver_id, row.vehicle_id],
  );
  const notificationId = notification.rows[0]?.id;
  assert.ok(notificationId);
  assert.equal(
    await canAccess("partner_can_access_uetds_notification", row.alternate_partner_id, notificationId),
    true,
  );
  const permissionWrite = await client.query<{ portal_permissions: unknown }>(
    `UPDATE partner_drivers
        SET portal_permissions = '{"gps":true,"uetds":true}'::jsonb
      WHERE id = $1 AND partner_can_access_driver($2, id)
      RETURNING portal_permissions`,
    [row.driver_id, row.alternate_partner_id],
  );
  assert.equal(permissionWrite.rows.length, 1);

  await client.query(
    `DELETE FROM partner_vehicle_access WHERE vehicle_id = $1 AND partner_id = $2`,
    [row.vehicle_id, row.creator_partner_id],
  );
  assert.equal(await canAccess("partner_can_access_vehicle", row.creator_partner_id, row.vehicle_id), false);
  assert.equal(await canAccess("partner_can_access_vehicle", row.alternate_partner_id, row.vehicle_id), true);
  const provenance = await client.query<{ partner_id: string }>(
    `SELECT partner_id FROM partner_vehicles WHERE id = $1`,
    [row.vehicle_id],
  );
  assert.equal(provenance.rows[0]?.partner_id, row.creator_partner_id);
  assert.deepEqual(await protectedCounts(row.vehicle_id), before);

  await client.query("SAVEPOINT last_grant");
  let lastGrantBlocked = false;
  try {
    await client.query(
      `DELETE FROM partner_vehicle_access WHERE vehicle_id = $1 AND partner_id = $2`,
      [row.vehicle_id, row.alternate_partner_id],
    );
  } catch (error) {
    lastGrantBlocked = postgresCode(error) === "23514";
    await client.query("ROLLBACK TO SAVEPOINT last_grant");
  }
  assert.equal(lastGrantBlocked, true, "last authorized partner must not be removable");

  console.log(JSON.stringify({
    ok: true,
    vehicleId: row.vehicle_id,
    creatorRemoval: "verified",
    driverVisibility: "verified",
    gpsVisibility: "verified",
    uetdsSharedRecordVisibility: "verified",
    sharedDriverPermissions: "verified",
    lastGrantProtection: "verified",
    subscriptionsUnchanged: true,
    atsSubmissionsUnchanged: true,
  }));
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
}

async function canAccess(functionName: string, partnerId: string, recordId: string) {
  const result = await client.query<{ allowed: boolean }>(
    `SELECT ${functionName}($1, $2) AS allowed`,
    [partnerId, recordId],
  );
  return result.rows[0]?.allowed === true;
}

async function protectedCounts(vehicleId: string) {
  const result = await client.query<{
    subscription_periods: number;
    ats_submissions: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM partner_vehicle_uetds_subscription_periods WHERE vehicle_id = $1)
         AS subscription_periods,
       (SELECT COUNT(*)::int FROM gps_ats_submissions WHERE vehicle_id = $1)
         AS ats_submissions`,
    [vehicleId],
  );
  return result.rows[0];
}

function postgresCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code ?? "");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
