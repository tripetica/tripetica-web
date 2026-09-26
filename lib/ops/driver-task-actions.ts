"use server";

import {
  advanceDriverTaskByToken,
  inspectDriverTaskPublicAccess,
  loadDriverTaskByToken,
  updateDriverTaskVisibility,
} from "@/lib/ops/driver-task";
import { reportDriverNoShowByToken } from "@/lib/ops/driver-no-show";
import { notifyOpsDriverNoShowReported } from "@/lib/ops/push/notify-driver-no-show";
import { scheduleOpsPush } from "@/lib/ops/push/schedule";
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

export async function refreshDriverTaskPublicAction(token: string) {
  return loadDriverTaskByToken(token);
}

export async function reportDriverNoShowAction(token: string) {
  const result = await reportDriverNoShowByToken(token);
  if (result.ok && !result.alreadyReported) {
    scheduleOpsPush("driver-no-show-reported", () =>
      notifyOpsDriverNoShowReported(result.reservationId),
    );
  }
  return result;
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
