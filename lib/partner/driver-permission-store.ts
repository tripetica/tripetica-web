import "server-only";

import { query } from "@/lib/db/postgres";
import {
  emptyDriverPermissions,
  parseDriverPermissions,
  type DriverPermissions,
} from "@/lib/driver-portal/permissions";
import { isUuid } from "@/lib/ops/process-filters";

export async function listPartnerDriverPermissions(partnerId: string) {
  const result = await query<{ id: string; portal_permissions: unknown }>(
    `SELECT id, portal_permissions
       FROM partner_drivers
      WHERE partner_id = $1
        AND deleted_at IS NULL`,
    [partnerId],
  );
  return Object.fromEntries(
    result.rows.map((row) => [row.id, parseDriverPermissions(row.portal_permissions)]),
  ) as Record<string, DriverPermissions>;
}

export async function getPartnerDriverPermissions(partnerId: string, driverId: string) {
  if (!isUuid(partnerId) || !isUuid(driverId)) return emptyDriverPermissions();
  const result = await query<{ portal_permissions: unknown }>(
    `SELECT portal_permissions
       FROM partner_drivers
      WHERE id = $1
        AND partner_id = $2
        AND deleted_at IS NULL
      LIMIT 1`,
    [driverId, partnerId],
  );
  return parseDriverPermissions(result.rows[0]?.portal_permissions);
}
