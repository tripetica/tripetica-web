import "server-only";

import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { query } from "@/lib/db/postgres";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { isUuid } from "@/lib/ops/process-filters";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import { driverUetdsScope } from "@/lib/uetds/driver-access";
import { kamuLoginOwnerFromActors } from "@/lib/uetds/kamu-login-owner";
import { kamuAssistedLoginAllowed } from "@/lib/uetds/kamu-login-session";
import { getUetdsNotification } from "@/lib/uetds/notifications";

export async function kamuLoginOwnerKey() {
  if (!kamuAssistedLoginAllowed()) return null;
  const [partner, ops, driver] = await Promise.all([
    getPartnerActor(),
    getOpsActor(),
    getDriverPortalActor(),
  ]);
  return kamuLoginOwnerFromActors({
    partner: partner ? { partnerId: partner.partnerId, userId: partner.userId, uetds: partnerHasTab(partner, "uetds") } : null,
    ops: ops ? { id: ops.id, uetdsManage: actorCan(ops, "uetds.manage") } : null,
    driver: driver ? { partnerId: driver.partnerId, driverId: driver.driverId, uetdsList: driver.permissions.uetdsList } : null,
  });
}

export async function loadKamuLoginNotification(owner: string, notificationId: string) {
  if (!isUuid(notificationId)) return null;
  if (owner.startsWith("driver:")) {
    const driver = await getDriverPortalActor();
    if (!driver?.permissions.uetdsList || owner !== `driver:${driver.partnerId}:${driver.driverId}`) return null;
    return getUetdsNotification({ id: notificationId, ...await driverUetdsScope(driver.partnerId, driver.driverId) });
  }
  if (owner.startsWith("partner:")) {
    const partner = await getPartnerActor();
    if (!partner || !partnerHasTab(partner, "uetds") || owner !== `partner:${partner.partnerId}:${partner.userId}`) return null;
    return getUetdsNotification({ id: notificationId, partnerId: partner.partnerId });
  }
  if (owner.startsWith("ops:")) {
    const ops = await getOpsActor();
    if (!ops || !actorCan(ops, "uetds.manage") || owner !== `ops:${ops.id}`) return null;
    return getUetdsNotification({ id: notificationId });
  }
  return null;
}

export async function driverMayUseKamuAuthority(input: {
  driverId: string;
  partnerId: string;
  authorityId: string;
  companyId: string | null;
}) {
  if (![input.driverId, input.partnerId, input.authorityId].every((value) => isUuid(value))) return false;
  if (input.companyId && !isUuid(input.companyId)) return false;
  const result = await query<{ id: string }>(
    `SELECT a.id
       FROM partner_drivers d
       JOIN partner_uetds_authorities a
         ON a.id = d.default_edevlet_authority_id
        AND a.partner_id = d.partner_id
        AND a.deleted_at IS NULL
        AND a.status = 'active'
      WHERE d.id = $1
        AND d.partner_id = $2
        AND d.deleted_at IS NULL
        AND d.status = 'active'
        AND a.id = $3
        AND (
          $4::uuid IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM partner_uetds_authority_companies ac WHERE ac.authority_id = a.id
          )
          OR EXISTS (
            SELECT 1 FROM partner_uetds_authority_companies ac
             WHERE ac.authority_id = a.id AND ac.company_id = $4
          )
        )`,
    [input.driverId, input.partnerId, input.authorityId, input.companyId],
  );
  return Boolean(result.rows[0]);
}
