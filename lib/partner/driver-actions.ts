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
import { resolveUetdsCompanyIdFromForm } from "@/lib/ops/uetds-company-options";
import { saveDriverAuthority, saveDriverVehiclePair, saveDriverVehicleSet } from "@/lib/partner/fleet-pairing";
import { firstPartnerTabPath, partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import { normalizeDriverNationalId } from "@/lib/partner/driver-identity";
import { isTurkishIdentityNumber } from "@/lib/uetds/qualification";
import { cachedDriverQualification } from "@/lib/uetds/qualification-query";
import { saveDriverQualification } from "@/lib/uetds/qualification-store";
import {
  driverPermissionKeys,
  emptyDriverPermissions,
  newDriverPermissions,
  type DriverPermissions,
} from "@/lib/driver-portal/permissions";

export type PartnerDriverFormState = {
  error:
    | "invalid-name"
    | "invalid-national-id"
    | "invalid-phone"
    | "invalid-languages"
    | "duplicate-national-id"
    | "invalid-email"
    | "duplicate-email"
    | "not-found"
    | "in-use"
    | "invalid-uetds-company"
    | "invalid-fleet-pair"
    | "invalid-edevlet-authority"
    | "qualification-src"
    | "qualification-unverified"
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

function permissionsFromForm(formData: FormData): DriverPermissions {
  if (!formData.has("permissionsPresent")) return newDriverPermissions();
  const selected = new Set(formData.getAll("permission").map((value) => String(value)));
  const permissions = emptyDriverPermissions();
  for (const key of driverPermissionKeys) permissions[key] = selected.has(key);
  return permissions;
}

function submittedId(formData: FormData, key: string) {
  if (!formData.has(key)) {
    return undefined;
  }
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

async function applyDriverLinks(
  formData: FormData,
  partnerId: string,
  driverId: string,
  companyId: string | null,
): Promise<PartnerDriverFormState | null> {
  if (formData.has("vehicleLinksPresent")) {
    const paired = await saveDriverVehicleSet({
      partnerId,
      driverId,
      vehicleIds: formData.getAll("defaultVehicleId").map((value) => String(value).trim()).filter(Boolean),
    });
    if (!paired.ok) {
      return { error: "invalid-fleet-pair", ok: false };
    }
  } else {
    const vehicleId = submittedId(formData, "defaultVehicleId");
    if (vehicleId !== undefined) {
      const paired = await saveDriverVehiclePair({ partnerId, driverId, vehicleId });
      if (!paired.ok) {
        return { error: "invalid-fleet-pair", ok: false };
      }
    }
  }
  const authorityId = submittedId(formData, "defaultAuthorityId");
  if (authorityId !== undefined) {
    const linked = await saveDriverAuthority({ partnerId, driverId, authorityId, companyId });
    if (!linked.ok) {
      return { error: "invalid-edevlet-authority", ok: false };
    }
  }
  return null;
}

async function requirePartnerActor(locale: Locale) {
  const actor = await getPartnerActor();
  if (!actor) {
    redirect(localizedPath(locale, "/partner/login"));
  }
  if (actor.mustChangePassword) {
    redirect(localizedPath(locale, "/partner/change-password"));
  }
  if (!partnerHasTab(actor, "drivers")) {
    redirect(localizedPath(locale, firstPartnerTabPath(actor)));
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
  const resolved = await resolveUetdsCompanyIdFromForm(formData, null);
  if (!resolved.ok || !resolved.companyId) {
    return { error: "invalid-uetds-company", ok: false };
  }
  const nationalId = normalizeDriverNationalId(String(formData.get("nationalId") ?? ""));
  if (!isTurkishIdentityNumber(nationalId)) {
    return { error: "invalid-national-id", ok: false };
  }
  if (!String(formData.get("email") ?? "").trim()) {
    return { error: "invalid-email", ok: false };
  }
  const outcome = await cachedDriverQualification({
    partnerId: actor.partnerId,
    companyId: resolved.companyId,
    nationalId,
  });
  const confirmation = String(formData.get("qualificationConfirm") ?? "");
  if (outcome.status === "unverified" && confirmation !== "unverified") {
    return { error: "qualification-unverified", ok: false };
  }
  if (outcome.status === "verified" && !outcome.srcReady && confirmation !== "src-missing") {
    return { error: "qualification-src", ok: false };
  }
  try {
    result = await createPartnerDriver({
      partnerId: actor.partnerId,
      editor: { source: "partner", userId: actor.userId },
      fullName: String(formData.get("fullName") ?? ""),
      phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
      phoneNational: String(formData.get("phoneNational") ?? ""),
      nationalId: String(formData.get("nationalId") ?? ""),
      languageCodes: languageCodesFromForm(formData),
      email: String(formData.get("email") ?? ""),
      uetdsCompanyId: resolved.companyId,
      permissions: permissionsFromForm(formData),
    });
  } catch {
    return { error: "failed", ok: false };
  }
  if (!result.ok) {
    return { error: result.error === "failed" ? "failed" : result.error, ok: false };
  }
  const linkError = await applyDriverLinks(
    formData,
    actor.partnerId,
    result.driverId,
    resolved.companyId,
  );
  if (linkError) {
    return linkError;
  }
  try {
    await saveDriverQualification({
      driverId: result.driverId,
      companyId: resolved.companyId,
      outcome,
    });
  } catch {
    // The driver record stays. A later card refresh can store the ministry result.
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
    const resolved = await resolveUetdsCompanyIdFromForm(
      formData,
      owned.uetdsCompanyId ?? null,
    );
    if (!resolved.ok) {
      return { error: "invalid-uetds-company", ok: false };
    }
    const result = await updatePartnerDriver({
      partnerId: actor.partnerId,
      driverId,
      editor: { source: "partner", userId: actor.userId },
      fullName: String(formData.get("fullName") ?? ""),
      phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
      phoneNational: String(formData.get("phoneNational") ?? ""),
      nationalId: String(formData.get("nationalId") ?? ""),
      languageCodes: languageCodesFromForm(formData),
      email: String(formData.get("email") ?? ""),
      uetdsCompanyId: resolved.companyId,
    });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    const linkError = await applyDriverLinks(
      formData,
      actor.partnerId,
      driverId,
      resolved.companyId,
    );
    if (linkError) {
      return linkError;
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
  if (String(formData.get("intent") ?? "") !== mode) {
    return { error: "failed", ok: false };
  }
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
