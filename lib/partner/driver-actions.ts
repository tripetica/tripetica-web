"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  activatePartnerDriver,
  createPartnerDriver,
  deactivatePartnerDriver,
  deletePartnerDriver,
  getPartnerDriver,
  updatePartnerDriver,
} from "@/lib/partner/fleet";
import { getPartnerActor } from "@/lib/partner/session";

export type PartnerDriverFormState = {
  error:
    | "invalid-name"
    | "invalid-national-id"
    | "invalid-phone"
    | "invalid-languages"
    | "duplicate-national-id"
    | "not-found"
    | "in-use"
    | "failed"
    | null;
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

function refreshPartnerDrivers(locale: Locale, partnerId: string, driverId?: string) {
  revalidatePath(localizedPath(locale, "/partner/drivers"));
  if (driverId) {
    revalidatePath(localizedPath(locale, `/partner/drivers/${driverId}`));
  }
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
  if (driverId) {
    revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}/drivers/${driverId}`));
  }
}

async function requirePartnerActor(locale: Locale) {
  const actor = await getPartnerActor();
  if (!actor) {
    redirect(localizedPath(locale, "/partner/login"));
  }
  if (actor.mustChangePassword) {
    redirect(localizedPath(locale, "/partner/change-password"));
  }
  return actor;
}

export async function partnerCreateDriverAction(
  _prev: PartnerDriverFormState,
  formData: FormData,
): Promise<PartnerDriverFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartnerActor(locale);
  let result: Awaited<ReturnType<typeof createPartnerDriver>>;
  try {
    result = await createPartnerDriver({
      partnerId: actor.partnerId,
      editor: { source: "partner", userId: actor.userId },
      fullName: String(formData.get("fullName") ?? ""),
      phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
      phoneNational: String(formData.get("phoneNational") ?? ""),
      nationalId: String(formData.get("nationalId") ?? ""),
      languageCodes: languageCodesFromForm(formData),
    });
  } catch {
    return { error: "failed", ok: false };
  }
  if (!result.ok) {
    return { error: result.error === "failed" ? "failed" : result.error, ok: false };
  }
  refreshPartnerDrivers(locale, actor.partnerId, result.driverId);
  redirect(localizedPath(locale, "/partner/drivers?added=1"));
}

export async function partnerUpdateDriverAction(
  _prev: PartnerDriverFormState,
  formData: FormData,
): Promise<PartnerDriverFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartnerActor(locale);
  const driverId = String(formData.get("id") ?? "");
  const owned = await getPartnerDriver(actor.partnerId, driverId);
  if (!owned) {
    return { error: "not-found", ok: false };
  }
  try {
    const result = await updatePartnerDriver({
      partnerId: actor.partnerId,
      driverId,
      editor: { source: "partner", userId: actor.userId },
      fullName: String(formData.get("fullName") ?? ""),
      phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
      phoneNational: String(formData.get("phoneNational") ?? ""),
      nationalId: String(formData.get("nationalId") ?? ""),
      languageCodes: languageCodesFromForm(formData),
    });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    refreshPartnerDrivers(locale, actor.partnerId, driverId);
    return { error: null, ok: true };
  } catch {
    return { error: "failed", ok: false };
  }
}

export async function partnerActivateDriverAction(
  _prev: PartnerDriverFormState,
  formData: FormData,
): Promise<PartnerDriverFormState> {
  return changeOwnDriverStatus(formData, "activate");
}

export async function partnerDeactivateDriverAction(
  _prev: PartnerDriverFormState,
  formData: FormData,
): Promise<PartnerDriverFormState> {
  return changeOwnDriverStatus(formData, "deactivate");
}

async function changeOwnDriverStatus(
  formData: FormData,
  mode: "activate" | "deactivate",
): Promise<PartnerDriverFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartnerActor(locale);
  const driverId = String(formData.get("id") ?? "");
  const owned = await getPartnerDriver(actor.partnerId, driverId);
  if (!owned) {
    return { error: "not-found", ok: false };
  }
  try {
    const result =
      mode === "activate"
        ? await activatePartnerDriver({
            partnerId: actor.partnerId,
            driverId,
            editor: { source: "partner", userId: actor.userId },
          })
        : await deactivatePartnerDriver({
            partnerId: actor.partnerId,
            driverId,
            editor: { source: "partner", userId: actor.userId },
          });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    refreshPartnerDrivers(locale, actor.partnerId, driverId);
    return { error: null, ok: true };
  } catch {
    return { error: "failed", ok: false };
  }
}

export async function partnerDeleteDriverAction(
  _prev: PartnerDriverFormState,
  formData: FormData,
): Promise<PartnerDriverFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartnerActor(locale);
  const driverId = String(formData.get("id") ?? "");
  const owned = await getPartnerDriver(actor.partnerId, driverId);
  if (!owned) {
    return { error: "not-found", ok: false };
  }
  let result: Awaited<ReturnType<typeof deletePartnerDriver>>;
  try {
    result = await deletePartnerDriver({
      partnerId: actor.partnerId,
      driverId,
      editor: { source: "partner", userId: actor.userId },
    });
  } catch {
    return { error: "failed", ok: false };
  }
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  refreshPartnerDrivers(locale, actor.partnerId);
  redirect(localizedPath(locale, "/partner/drivers"));
}
