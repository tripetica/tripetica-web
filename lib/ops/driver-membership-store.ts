import "server-only";
import { query } from "@/lib/db/postgres";
import { isDriverMembershipStatus, type DriverMembershipStatus } from "./driver-membership";

/** Ops-only callers authorize partners.view/manage before accessing this field. */
export async function getDriverMembership(driverId: string): Promise<DriverMembershipStatus> {
  const result = await query<{ membership_status: DriverMembershipStatus }>(
    "SELECT membership_status FROM partner_drivers WHERE id = $1 AND deleted_at IS NULL", [driverId],
  );
  return result.rows[0]?.membership_status ?? "standard";
}

export async function saveDriverMembership(partnerId: string, driverId: string, status: DriverMembershipStatus) {
  if (!isDriverMembershipStatus(status)) return false;
  const result = await query(
    `UPDATE partner_drivers SET membership_status = $3, updated_at = NOW()
     WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL RETURNING id`, [driverId, partnerId, status],
  );
  return result.rows.length === 1;
}
