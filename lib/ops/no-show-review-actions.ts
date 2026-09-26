"use server";

import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { reviewDriverNoShowReport } from "@/lib/ops/driver-no-show";
import { isUuid } from "@/lib/ops/process-filters";
import { canEditOpsRecords } from "@/lib/ops/permissions";
import { getOpsActor } from "@/lib/ops/session";
import { type NoShowReviewDecision } from "@/lib/ops/no-show";

export async function reviewDriverNoShowAction(
  reservationId: string,
  decision: NoShowReviewDecision,
  localeRaw: string,
  operationsNote?: string | null,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" | "conflict" }> {
  const actor = await getOpsActor();
  if (!actor || !canEditOpsRecords(actor.role)) {
    return { ok: false, error: "forbidden" };
  }
  if (!isUuid(reservationId) || (decision !== "approved" && decision !== "rejected")) {
    return { ok: false, error: "invalid" };
  }
  const result = await reviewDriverNoShowReport({
    reservationId,
    opsUserId: actor.id,
    decision,
    operationsNote,
  });
  if (!result.ok) {
    return { ok: false, error: result.reason === "conflict" ? "conflict" : "invalid" };
  }
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  revalidatePath(localizedPath(locale, "/ops/reservations"));
  revalidatePath(localizedPath(locale, `/ops/reservations/${reservationId}`));
  return { ok: true };
}
