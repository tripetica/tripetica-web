"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  sendAssignmentCustomerNotification,
  type AssignmentNotifyError,
} from "@/lib/ops/assignment-customer-notification";
import { actorCan, getOpsActor } from "@/lib/ops/session";

export type OpsAssignmentNotifyFormState = {
  error: AssignmentNotifyError | "forbidden" | null;
  ok: boolean;
  reservationId: string;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

function refreshNotify(locale: Locale, reservationId: string) {
  revalidatePath(localizedPath(locale, "/ops/reservations"));
  revalidatePath(localizedPath(locale, `/ops/reservations/${reservationId}`));
}

export async function opsSendAssignmentCustomerNotificationAction(
  _prev: OpsAssignmentNotifyFormState,
  formData: FormData,
): Promise<OpsAssignmentNotifyFormState> {
  const locale = localeFromForm(formData);
  const reservationId = String(formData.get("id") ?? "");
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "reservations.manage")) {
    return { error: "forbidden", ok: false, reservationId };
  }
  const includeDriver = String(formData.get("includeDriver") ?? "") === "1";
  const scope = includeDriver ? "vehicle_and_driver" : "vehicle_only";
  try {
    const result = await sendAssignmentCustomerNotification({
      actorId: actor.id,
      reservationId,
      scope,
    });
    if (!result.ok) {
      return { error: result.error, ok: false, reservationId };
    }
    refreshNotify(locale, reservationId);
    return { error: null, ok: true, reservationId };
  } catch {
    return { error: "failed", ok: false, reservationId };
  }
}
