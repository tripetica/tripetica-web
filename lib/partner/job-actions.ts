"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { claimPartnerJob } from "@/lib/partner/jobs";
import { getPartnerActor } from "@/lib/partner/session";

export type PartnerJobFormState = {
  error: "already-taken" | "not-visible" | "not-found" | "inactive" | "failed" | null;
  ok: boolean;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

async function requirePartner(locale: Locale) {
  const actor = await getPartnerActor();
  if (!actor) {
    redirect(localizedPath(locale, "/partner/login"));
  }
  if (actor.mustChangePassword) {
    redirect(localizedPath(locale, "/partner/change-password"));
  }
  return actor;
}

export async function partnerAcceptJobAction(
  _prev: PartnerJobFormState,
  formData: FormData,
): Promise<PartnerJobFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartner(locale);
  const jobId = String(formData.get("id") ?? "");
  if (!jobId) {
    return { error: "not-found", ok: false };
  }
  try {
    const result = await claimPartnerJob({
      partnerId: actor.partnerId,
      userId: actor.userId,
      reservationId: jobId,
    });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    revalidatePath(localizedPath(locale, "/partner/jobs"));
    revalidatePath(localizedPath(locale, "/partner/accepted"));
    revalidatePath(localizedPath(locale, `/partner/jobs/${jobId}`));
    revalidatePath(localizedPath(locale, `/partner/accepted/${jobId}`));
    revalidatePath(localizedPath(locale, `/ops/partners/${actor.partnerId}`));
    redirect(localizedPath(locale, "/partner/accepted?claimed=1"));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return { error: "failed", ok: false };
  }
}
