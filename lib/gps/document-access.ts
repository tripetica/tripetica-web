import "server-only";

import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import { driverAuthorizedVehicleIds } from "@/lib/uetds/driver-access";
import { type DocumentAccess } from "@/lib/gps/document-store";

export async function documentEditor(): Promise<Exclude<DocumentAccess, { kind: "driver" }> | null> {
  const ops = await getOpsActor();
  if (ops && actorCan(ops, "gps.view")) return { kind: "ops", userId: ops.id };
  const partner = await getPartnerActor();
  if (!partner || partner.mustChangePassword || !partnerHasTab(partner, "gps")) return null;
  return { kind: "partner", partnerId: partner.partnerId, userId: partner.userId };
}

export async function documentDriverViewer(): Promise<Extract<DocumentAccess, { kind: "driver" }> | null> {
  const driver = await getDriverPortalActor();
  if (!driver?.permissions.gpsDocuments) return null;
  return {
    kind: "driver",
    partnerId: driver.partnerId,
    vehicleIds: await driverAuthorizedVehicleIds(driver.partnerId, driver.driverId),
  };
}
