"use server";

import {
  advanceDriverTaskByToken,
  inspectDriverTaskPublicAccess,
  updateDriverTaskVisibility,
} from "@/lib/ops/driver-task";
import { isUuid } from "@/lib/ops/process-filters";
import { actorCan, getOpsActor } from "@/lib/ops/session";

export async function advanceDriverTaskAction(
  token: string,
  requestedStage: string,
) {
  return advanceDriverTaskByToken(token, requestedStage);
}

export async function inspectDriverTaskPublicAccessAction(token: string) {
  return inspectDriverTaskPublicAccess(token);
}

export async function updateDriverTaskVisibilityAction(
  reservationId: string,
  flags: { showPriceInfo: boolean; showPassengerContact: boolean },
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" }> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "reservations.view")) {
    return { ok: false, error: "forbidden" };
  }
  if (!isUuid(reservationId)) {
    return { ok: false, error: "invalid" };
  }
  await updateDriverTaskVisibility(reservationId, {
    showPriceInfo: Boolean(flags.showPriceInfo),
    showPassengerContact: Boolean(flags.showPassengerContact),
  });
  return { ok: true };
}
