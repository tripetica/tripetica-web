import "server-only";

import { actorCan, getOpsActor } from "@/lib/ops/session";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import { readOpenCameraSession } from "@/lib/gps/camera-sessions";

export async function cameraViewerScope(surface: string | null) {
  if (surface === "partner") {
    const actor = await getPartnerActor();
    if (!actor || actor.mustChangePassword || !actor.isPrimaryPartner || !partnerHasTab(actor, "gps")) {
      return null;
    }
    return {
      surface: "partner" as const,
      partnerId: actor.partnerId,
      openedBy: actor.partnerName,
    };
  }
  if (surface === "ops") {
    const actor = await getOpsActor();
    if (!actor || !actorCan(actor, "gps.view")) {
      return null;
    }
    return {
      surface: "ops" as const,
      partnerId: null,
      openedBy: `${actor.firstName} ${actor.lastName}`.trim() || "ops",
    };
  }
  return null;
}

export async function cameraSessionForViewer(sessionId: string, scope: { surface: "partner" | "ops"; partnerId: string | null }) {
  const row = await readOpenCameraSession(sessionId);
  if (!row) {
    return null;
  }
  if (scope.surface === "partner" && row.partner_id !== scope.partnerId) {
    return null;
  }
  return row;
}
