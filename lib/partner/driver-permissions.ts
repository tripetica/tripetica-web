"use server";

import { query } from "@/lib/db/postgres";
import {
  driverPermissionKeys,
  parseDriverPermissions,
  type DriverPermissions,
} from "@/lib/driver-portal/permissions";
import { isUuid } from "@/lib/ops/process-filters";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";

export async function savePartnerDriverPermissionsAction(input: {
  driverId: string;
  permissions: DriverPermissions;
}): Promise<{ ok: true; permissions: DriverPermissions } | { ok: false }> {
  const actor = await getPartnerActor();
  if (!actor || actor.mustChangePassword || !partnerHasTab(actor, "drivers") || !isUuid(input.driverId)) {
    return { ok: false };
  }
  const permissions = parseDriverPermissions(input.permissions);
  const stored = Object.fromEntries(driverPermissionKeys.map((key) => [key, permissions[key]]));
  const result = await query<{ portal_permissions: unknown }>(
    `UPDATE partner_drivers
        SET portal_permissions = $3::jsonb,
            updated_at = NOW()
      WHERE id = $1
        AND partner_id = $2
        AND deleted_at IS NULL
      RETURNING portal_permissions`,
    [input.driverId, actor.partnerId, JSON.stringify(stored)],
  );
  const saved = result.rows[0];
  if (!saved) return { ok: false };
  return { ok: true, permissions: parseDriverPermissions(saved.portal_permissions) };
}
