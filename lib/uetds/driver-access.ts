import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { listAssignableEdevletAuthorities } from "@/lib/partner/fleet-pairing";
import { type AuthorityChoice } from "@/lib/partner/fleet-pairing-rules";
import {
  listUetdsDriverOptions,
  listUetdsVehicleOptions,
} from "@/lib/uetds/fleet-scope";
import { type UetdsFleetOption } from "@/lib/uetds/fleet-options";

export async function driverAuthorizedVehicleIds(partnerId: string, driverId: string) {
  if (!isUuid(partnerId) || !isUuid(driverId)) {
    return [];
  }
  const result = await query<{ id: string }>(
    `SELECT v.id
       FROM partner_fleet_defaults fd
       JOIN partner_vehicles v ON v.id = fd.vehicle_id
      WHERE fd.partner_id = $1
        AND fd.driver_id = $2
        AND v.partner_id = $1
        AND v.deleted_at IS NULL
        AND v.status = 'active'`,
    [partnerId, driverId],
  );
  return result.rows.map((row) => row.id);
}

export async function notificationSnapshotVehicleId(input: {
  notificationId: string;
  partnerId: string;
  driverId: string;
}) {
  if (!isUuid(input.notificationId) || !isUuid(input.partnerId) || !isUuid(input.driverId)) {
    return null;
  }
  const result = await query<{ vehicle_id: string | null }>(
    `SELECT snapshot->'vehicle'->>'id' AS vehicle_id
       FROM uetds_notifications
      WHERE id = $1
        AND partner_id = $2
        AND driver_id = $3
      LIMIT 1`,
    [input.notificationId, input.partnerId, input.driverId],
  );
  const vehicleId = result.rows[0]?.vehicle_id ?? "";
  return isUuid(vehicleId) ? vehicleId : null;
}

export async function notificationOwnedByDriver(input: {
  notificationId: string;
  partnerId: string;
  driverId: string;
}) {
  if (!isUuid(input.notificationId) || !isUuid(input.partnerId) || !isUuid(input.driverId)) {
    return false;
  }
  const vehicleIds = await driverAuthorizedVehicleIds(input.partnerId, input.driverId);
  if (vehicleIds.length === 0) return false;
  const result = await query<{ id: string }>(
    `SELECT id
       FROM uetds_notifications
      WHERE id = $1
        AND partner_id = $2
        AND driver_id = $3
        AND vehicle_id = ANY($4::uuid[])
      LIMIT 1`,
    [input.notificationId, input.partnerId, input.driverId, vehicleIds],
  );
  return Boolean(result.rows[0]);
}

export async function driverUetdsScope(partnerId: string, driverId: string) {
  return {
    partnerId,
    driverId,
    vehicleIds: await driverAuthorizedVehicleIds(partnerId, driverId),
  };
}

export async function loadDriverUetdsFleet(partnerId: string, driverId: string): Promise<{
  drivers: UetdsFleetOption[];
  vehicles: UetdsFleetOption[];
  authorities: AuthorityChoice[];
}> {
  const [drivers, vehicles, authorities, vehicleIds] = await Promise.all([
    listUetdsDriverOptions({ scope: "partner", partnerId }),
    listUetdsVehicleOptions({ scope: "partner", partnerId }),
    listAssignableEdevletAuthorities({ partnerId }),
    driverAuthorizedVehicleIds(partnerId, driverId),
  ]);
  const self = drivers.filter((driver) => driver.id === driverId);
  const allowed = new Set(vehicleIds);
  const ownVehicles = vehicles.filter((vehicle) => allowed.has(vehicle.id));
  const authorityId = self[0]?.defaultAuthorityId ?? null;
  return {
    drivers: self,
    vehicles: ownVehicles,
    authorities: authorityId ? authorities.filter((item) => item.id === authorityId) : [],
  };
}
