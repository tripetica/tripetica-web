"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { scheduleOpsPush } from "@/lib/ops/push/schedule";
import { notifyOpsVehicleApprovalRequested } from "@/lib/ops/push/notify-vehicle-approval";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  activatePartnerVehicle,
  createPartnerVehicle,
  deactivatePartnerVehicle,
  deletePartnerVehicle,
  getPartnerVehicle,
  updatePartnerVehicle,
} from "@/lib/partner/fleet";
import { resolveUetdsCompanyIdFromForm } from "@/lib/ops/uetds-company-options";
import { getPartnerActor } from "@/lib/partner/session";

export type PartnerVehicleFormState = {
  error:
    | "invalid-plate"
    | "invalid-brand"
    | "invalid-model"
    | "invalid-year"
    | "invalid-color"
    | "invalid-passengers"
    | "invalid-luggage"
    | "invalid-class"
    | "invalid-features"
    | "duplicate-plate"
    | "needs-approval"
    | "not-found"
    | "in-use"
    | "invalid-uetds-company"
    | "failed"
    | null;
  ok: boolean;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

function featureCodesFromForm(formData: FormData) {
  return String(formData.get("featureCodes") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function vehicleFieldsFromForm(formData: FormData) {
  return {
    plate: String(formData.get("plate") ?? ""),
    brandCode: String(formData.get("brandCode") ?? ""),
    modelCode: String(formData.get("modelCode") ?? ""),
    modelYear: String(formData.get("modelYear") ?? ""),
    colorCode: String(formData.get("colorCode") ?? ""),
    colorOther: String(formData.get("colorOther") ?? ""),
    passengerCapacity: String(formData.get("passengerCapacity") ?? ""),
    luggageCapacity: String(formData.get("luggageCapacity") ?? ""),
    vehicleClassCode: String(formData.get("vehicleClassCode") ?? ""),
    featureCodes: featureCodesFromForm(formData),
    featureOther: String(formData.get("featureOther") ?? ""),
  };
}

function refreshPartnerVehicles(locale: Locale, partnerId: string, vehicleId?: string) {
  revalidatePath(localizedPath(locale, "/partner/vehicles"));
  if (vehicleId) {
    revalidatePath(localizedPath(locale, `/partner/vehicles/${vehicleId}`));
  }
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
  if (vehicleId) {
    revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}/vehicles/${vehicleId}`));
    revalidatePath(localizedPath(locale, "/ops/vehicles"));
    revalidatePath(localizedPath(locale, `/ops/vehicles/${vehicleId}`));
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

export async function partnerCreateVehicleAction(
  _prev: PartnerVehicleFormState,
  formData: FormData,
): Promise<PartnerVehicleFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartnerActor(locale);
  const resolved = await resolveUetdsCompanyIdFromForm(formData, null);
  if (!resolved.ok) {
    return { error: "invalid-uetds-company", ok: false };
  }
  let result: Awaited<ReturnType<typeof createPartnerVehicle>>;
  try {
    result = await createPartnerVehicle({
      partnerId: actor.partnerId,
      editor: { source: "partner", userId: actor.userId },
      ...vehicleFieldsFromForm(formData),
      uetdsCompanyId: resolved.companyId,
    });
  } catch {
    return { error: "failed", ok: false };
  }
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  if (result.needsApproval) {
    scheduleOpsPush("partner-vehicle-approval-requested", () =>
      notifyOpsVehicleApprovalRequested(result.vehicleId),
    );
  }
  refreshPartnerVehicles(locale, actor.partnerId, result.vehicleId);
  redirect(localizedPath(locale, "/partner/vehicles?added=1"));
}

export async function partnerUpdateVehicleAction(
  _prev: PartnerVehicleFormState,
  formData: FormData,
): Promise<PartnerVehicleFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartnerActor(locale);
  const vehicleId = String(formData.get("id") ?? "");
  const owned = await getPartnerVehicle(actor.partnerId, vehicleId);
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
    const result = await updatePartnerVehicle({
      partnerId: actor.partnerId,
      vehicleId,
      editor: { source: "partner", userId: actor.userId },
      ...vehicleFieldsFromForm(formData),
      uetdsCompanyId: resolved.companyId,
    });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    if (result.needsApproval) {
      scheduleOpsPush("partner-vehicle-approval-requested", () =>
        notifyOpsVehicleApprovalRequested(vehicleId),
      );
    }
    refreshPartnerVehicles(locale, actor.partnerId, vehicleId);
    return { error: null, ok: true };
  } catch {
    return { error: "failed", ok: false };
  }
}

export async function partnerActivateVehicleAction(
  _prev: PartnerVehicleFormState,
  formData: FormData,
): Promise<PartnerVehicleFormState> {
  return changeOwnVehicleStatus(formData, "activate");
}

export async function partnerDeactivateVehicleAction(
  _prev: PartnerVehicleFormState,
  formData: FormData,
): Promise<PartnerVehicleFormState> {
  return changeOwnVehicleStatus(formData, "deactivate");
}

async function changeOwnVehicleStatus(
  formData: FormData,
  mode: "activate" | "deactivate",
): Promise<PartnerVehicleFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartnerActor(locale);
  const vehicleId = String(formData.get("id") ?? "");
  const owned = await getPartnerVehicle(actor.partnerId, vehicleId);
  if (!owned) {
    return { error: "not-found", ok: false };
  }
  try {
    const result =
      mode === "activate"
        ? await activatePartnerVehicle({
            partnerId: actor.partnerId,
            vehicleId,
            editor: { source: "partner", userId: actor.userId },
          })
        : await deactivatePartnerVehicle({
            partnerId: actor.partnerId,
            vehicleId,
            editor: { source: "partner", userId: actor.userId },
          });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    refreshPartnerVehicles(locale, actor.partnerId, vehicleId);
    return { error: null, ok: true };
  } catch {
    return { error: "failed", ok: false };
  }
}

export async function partnerDeleteVehicleAction(
  _prev: PartnerVehicleFormState,
  formData: FormData,
): Promise<PartnerVehicleFormState> {
  const locale = localeFromForm(formData);
  const actor = await requirePartnerActor(locale);
  const vehicleId = String(formData.get("id") ?? "");
  const owned = await getPartnerVehicle(actor.partnerId, vehicleId);
  if (!owned) {
    return { error: "not-found", ok: false };
  }
  let result: Awaited<ReturnType<typeof deletePartnerVehicle>>;
  try {
    result = await deletePartnerVehicle({
      partnerId: actor.partnerId,
      vehicleId,
      editor: { source: "partner", userId: actor.userId },
    });
  } catch {
    return { error: "failed", ok: false };
  }
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  refreshPartnerVehicles(locale, actor.partnerId);
  redirect(localizedPath(locale, "/partner/vehicles"));
}
