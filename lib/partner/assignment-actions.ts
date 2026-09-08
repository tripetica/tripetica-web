"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  assignPartnerJobDriver,
  assignPartnerJobVehicle,
  clearPartnerJobDriver,
  clearPartnerJobVehicle,
  type AssignJobError,
} from "@/lib/partner/job-assignment";
import { getPartnerActor } from "@/lib/partner/session";

export type PartnerAssignmentFormState = {
  error: AssignJobError | null;
  ok: boolean;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

function languageCodesFromForm(formData: FormData) {
  return String(formData.get("languages") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function refreshAssignmentPaths(locale: Locale, partnerId: string, jobId: string) {
  revalidatePath(localizedPath(locale, "/partner/accepted"));
  revalidatePath(localizedPath(locale, `/partner/accepted/${jobId}`));
  revalidatePath(localizedPath(locale, `/partner/jobs/${jobId}`));
  revalidatePath(localizedPath(locale, "/ops/reservations"));
  revalidatePath(localizedPath(locale, `/ops/reservations/${jobId}`));
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
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

export async function partnerAssignDriverAction(
  _prev: PartnerAssignmentFormState,
  formData: FormData,
): Promise<PartnerAssignmentFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartner(locale);
  const jobId = String(formData.get("id") ?? "");
  if (!jobId) {
    return { error: "not-found", ok: false };
  }
  try {
    const result = await assignPartnerJobDriver({
      partnerId: actor.partnerId,
      userId: actor.userId,
      isPrimaryPartner: actor.isPrimaryPartner,
      reservationId: jobId,
      selection: String(formData.get("selection") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
      existingFirst: String(formData.get("existingFirst") ?? ""),
      existingLast: String(formData.get("existingLast") ?? ""),
      phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
      phoneNational: String(formData.get("phoneNational") ?? ""),
      languageCodes: languageCodesFromForm(formData),
      notes: String(formData.get("notes") ?? ""),
    });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    refreshAssignmentPaths(locale, actor.partnerId, jobId);
    return { error: null, ok: true };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return { error: "failed", ok: false };
  }
}

export async function partnerAssignVehicleAction(
  _prev: PartnerAssignmentFormState,
  formData: FormData,
): Promise<PartnerAssignmentFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartner(locale);
  const jobId = String(formData.get("id") ?? "");
  if (!jobId) {
    return { error: "not-found", ok: false };
  }
  try {
    const result = await assignPartnerJobVehicle({
      partnerId: actor.partnerId,
      userId: actor.userId,
      isPrimaryPartner: actor.isPrimaryPartner,
      reservationId: jobId,
      selection: String(formData.get("selection") ?? ""),
      plate: String(formData.get("plate") ?? ""),
      brandModel: String(formData.get("brandModel") ?? ""),
      features: String(formData.get("features") ?? ""),
    });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    refreshAssignmentPaths(locale, actor.partnerId, jobId);
    return { error: null, ok: true };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return { error: "failed", ok: false };
  }
}

export async function partnerClearDriverAction(
  _prev: PartnerAssignmentFormState,
  formData: FormData,
): Promise<PartnerAssignmentFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartner(locale);
  const jobId = String(formData.get("id") ?? "");
  if (!jobId) {
    return { error: "not-found", ok: false };
  }
  try {
    const result = await clearPartnerJobDriver({
      partnerId: actor.partnerId,
      userId: actor.userId,
      reservationId: jobId,
    });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    refreshAssignmentPaths(locale, actor.partnerId, jobId);
    return { error: null, ok: true };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return { error: "failed", ok: false };
  }
}

export async function partnerClearVehicleAction(
  _prev: PartnerAssignmentFormState,
  formData: FormData,
): Promise<PartnerAssignmentFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartner(locale);
  const jobId = String(formData.get("id") ?? "");
  if (!jobId) {
    return { error: "not-found", ok: false };
  }
  try {
    const result = await clearPartnerJobVehicle({
      partnerId: actor.partnerId,
      userId: actor.userId,
      reservationId: jobId,
    });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    refreshAssignmentPaths(locale, actor.partnerId, jobId);
    return { error: null, ok: true };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return { error: "failed", ok: false };
  }
}
