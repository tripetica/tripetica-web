import assert from "node:assert/strict";
import { loadDevelopmentEnv } from "./load-env";

async function main() {
  loadDevelopmentEnv();
  process.env.EXPECTED_DATABASE = "tripetica_dev";
  const [{ query, getPool }, fleet, pairing, gps, drive, mobile, uetds] = await Promise.all([
    import("../lib/db/postgres"),
    import("../lib/partner/fleet"),
    import("../lib/partner/fleet-pairing"),
    import("../lib/gps/queries"),
    import("../lib/gps/drive-store"),
    import("../lib/gps/mobile-store"),
    import("../lib/uetds/fleet-scope"),
  ]);
  const fixture = await query<{ partner_id: string; vehicle_id: string }>(
    `SELECT access.partner_id, access.vehicle_id
       FROM partner_vehicle_access access
       JOIN partner_vehicles vehicle ON vehicle.id = access.vehicle_id
      WHERE vehicle.deleted_at IS NULL
      ORDER BY access.created_at, access.vehicle_id
      LIMIT 1`,
  );
  const row = fixture.rows[0];
  assert.ok(row, "DEV requires one accessible vehicle");

  const vehicles = await fleet.listPartnerVehicles(row.partner_id);
  const drivers = await fleet.listPartnerDrivers(row.partner_id);
  const vehicle = await fleet.getPartnerVehicle(row.partner_id, row.vehicle_id);
  const vehicleChoices = await pairing.listPartnerVehicleChoices(row.partner_id);
  const driverChoices = await pairing.listPartnerDriverChoices(row.partner_id);
  const devices = await gps.listGpsDevices(row.partner_id);
  const identities = await drive.listPartnerVehicleIdentity(row.partner_id);
  const mobileFleet = await mobile.listMobileFleet(row.partner_id);
  const uetdsVehicles = await uetds.listUetdsVehicleOptions({ scope: "partner", partnerId: row.partner_id });
  const uetdsDrivers = await uetds.listUetdsDriverOptions({ scope: "partner", partnerId: row.partner_id });
  assert.ok(vehicle);
  assert.ok(vehicles.some((item) => item.id === row.vehicle_id));
  assert.ok(vehicleChoices.some((item) => item.id === row.vehicle_id));
  assert.ok(identities.has(row.vehicle_id));
  console.log(JSON.stringify({
    ok: true,
    vehicles: vehicles.length,
    drivers: drivers.length,
    vehicleChoices: vehicleChoices.length,
    driverChoices: driverChoices.length,
    gpsDevices: devices.length,
    mobileFleet: mobileFleet.length,
    uetdsVehicles: uetdsVehicles.length,
    uetdsDrivers: uetdsDrivers.length,
  }));
  await getPool().end();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
