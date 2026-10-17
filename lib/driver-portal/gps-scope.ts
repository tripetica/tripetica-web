import "server-only";

import { query } from "@/lib/db/postgres";
import { type DriverPermissionKey } from "@/lib/driver-portal/permissions";
import { getDriverPortalActor, type DriverPortalActor } from "@/lib/driver-portal/session";
import { isUuid } from "@/lib/ops/process-filters";
import { driverAuthorizedVehicleIds } from "@/lib/uetds/driver-access";

export async function driverGpsContext(required?: DriverPermissionKey) {
  const actor = await getDriverPortalActor();
  if (!actor) return null;
  if (required && !actor.permissions[required]) return null;
  return {
    actor,
    vehicleIds: await driverAuthorizedVehicleIds(actor.partnerId, actor.driverId),
  };
}

export async function driverDeviceVehicleId(deviceId: string, partnerId: string) {
  if (!isUuid(deviceId) || !isUuid(partnerId)) return null;
  const result = await query<{ vehicle_id: string | null }>(
    `SELECT vehicle_id
       FROM gps_devices
      WHERE id = $1
        AND partner_id = $2
        AND status = 'active'
      LIMIT 1`,
    [deviceId, partnerId],
  );
  return result.rows[0]?.vehicle_id ?? null;
}

export async function driverMayUseDevice(
  deviceId: string,
  permission: DriverPermissionKey,
): Promise<DriverPortalActor | null> {
  const context = await driverGpsContext(permission);
  if (!context) return null;
  const vehicleId = await driverDeviceVehicleId(deviceId, context.actor.partnerId);
  if (!vehicleId || !context.vehicleIds.includes(vehicleId)) return null;
  return context.actor;
}
