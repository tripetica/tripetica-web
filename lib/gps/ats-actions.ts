"use server";

import { revalidatePath } from "next/cache";
import { locales } from "@/lib/i18n/config";
import { applyGpsAtsControl } from "@/lib/gps/ats-control";
import { actorCan, getOpsActor } from "@/lib/ops/session";

export async function setGpsAtsEnabled(input: { deviceId: string; enabled: boolean }) {
  const actor = await getOpsActor();
  const result = await applyGpsAtsControl({
    deviceId: input.deviceId,
    enable: input.enabled,
    actorUserId: actor?.id ?? "",
    actorAllowed: Boolean(actor && actorCan(actor, "gps.manage")),
  });
  if (!result.ok) {
    return result;
  }
  for (const locale of locales) {
    revalidatePath(`/${locale}/ops/gps`);
    revalidatePath(`/${locale}/ops/gps/${input.deviceId}`);
  }
  return result;
}
