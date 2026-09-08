"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import {
  activatePartnerDriver,
  activatePartnerVehicle,
  approvePartnerVehicle,
  deactivatePartnerDriver,
  deactivatePartnerVehicle,
  deletePartnerDriver,
  deletePartnerVehicle,
  getPartnerDriver,
  getPartnerVehicle,
  rejectPartnerVehicle,
  updatePartnerDriver,
  updatePartnerVehicle,
} from "@/lib/partner/fleet";

export type OpsFleetFormState = {
  error:
    | "forbidden"
    | "not-found"
    | "invalid-name"
    | "invalid-national-id"
    | "invalid-languages"
    | "duplicate-national-id"
    | "invalid-phone"
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
    | "invalid-fields"
    | "in-use"
    | "failed"
    | null;
  ok: boolean;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

function idsFromForm(formData: FormData) {
  return {
    partnerId: String(formData.get("partnerId") ?? ""),
    recordId: String(formData.get("id") ?? ""),
  };
}

function refreshFleet(locale: Locale, partnerId: string, kind: "drivers" | "vehicles", recordId: string) {
  revalidatePath(localizedPath(locale, "/ops/partners"));
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}/${kind}/${recordId}`));
  if (kind === "drivers") {
    revalidatePath(localizedPath(locale, "/partner/drivers"));
    revalidatePath(localizedPath(locale, `/partner/drivers/${recordId}`));
    revalidatePath(localizedPath(locale, "/ops/drivers"));
    revalidatePath(localizedPath(locale, `/ops/drivers/${recordId}`));
  }
  if (kind === "vehicles") {
    revalidatePath(localizedPath(locale, "/partner/vehicles"));
    revalidatePath(localizedPath(locale, `/partner/vehicles/${recordId}`));
    revalidatePath(localizedPath(locale, "/ops/vehicles"));
    revalidatePath(localizedPath(locale, `/ops/vehicles/${recordId}`));
  }
}

function logFleetFailure(action: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`[ops-partner-fleet] ${action} failed`, extra ?? {}, error);
}

async function requireFleetManager() {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.manage")) {
    return null;
  }
  return actor;
}

export async function updateOpsPartnerDriverAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  const locale = localeFromForm(formData);
  const actor = await requireFleetManager();
  if (!actor) {
    return { error: "forbidden", ok: false };
  }
  const { partnerId, recordId } = idsFromForm(formData);
  try {
    const result = await updatePartnerDriver({
      partnerId,
      driverId: recordId,
      editor: { source: "ops", userId: actor.id },
      fullName: String(formData.get("fullName") ?? ""),
      phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
      phoneNational: String(formData.get("phoneNational") ?? ""),
      nationalId: String(formData.get("nationalId") ?? ""),
      languageCodes: String(formData.get("languages") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
    if (!result.ok) {
      logFleetFailure("update-driver", result.error, { partnerId, recordId });
      return { error: result.error, ok: false };
    }
    const saved = await getPartnerDriver(partnerId, recordId);
    if (!saved) {
      logFleetFailure("update-driver", "verify-missing", { partnerId, recordId });
      return { error: "failed", ok: false };
    }
    refreshFleet(locale, partnerId, "drivers", recordId);
    return { error: null, ok: true };
  } catch (error) {
    logFleetFailure("update-driver", error, { partnerId, recordId });
    return { error: "failed", ok: false };
  }
}

export async function activateOpsPartnerDriverAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  return changeDriverStatus(formData, "activate");
}

export async function deactivateOpsPartnerDriverAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  return changeDriverStatus(formData, "deactivate");
}

async function changeDriverStatus(
  formData: FormData,
  mode: "activate" | "deactivate",
): Promise<OpsFleetFormState> {
  const locale = localeFromForm(formData);
  const actor = await requireFleetManager();
  if (!actor) {
    return { error: "forbidden", ok: false };
  }
  const { partnerId, recordId } = idsFromForm(formData);
  try {
    const result =
      mode === "activate"
        ? await activatePartnerDriver({
            partnerId,
            driverId: recordId,
            editor: { source: "ops", userId: actor.id },
          })
        : await deactivatePartnerDriver({
            partnerId,
            driverId: recordId,
            editor: { source: "ops", userId: actor.id },
          });
    if (!result.ok) {
      logFleetFailure(`${mode}-driver`, result.error, { partnerId, recordId });
      return { error: result.error, ok: false };
    }
    const saved = await getPartnerDriver(partnerId, recordId);
    const expected = mode === "activate" ? "active" : "inactive";
    if (!saved || saved.status !== expected) {
      logFleetFailure(`${mode}-driver`, "status-not-updated", {
        partnerId,
        recordId,
        actual: saved?.status ?? null,
      });
      return { error: "failed", ok: false };
    }
    refreshFleet(locale, partnerId, "drivers", recordId);
    return { error: null, ok: true };
  } catch (error) {
    logFleetFailure(`${mode}-driver`, error, { partnerId, recordId });
    return { error: "failed", ok: false };
  }
}

export async function deleteOpsPartnerDriverAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  const locale = localeFromForm(formData);
  const actor = await requireFleetManager();
  if (!actor) {
    return { error: "forbidden", ok: false };
  }
  const { partnerId, recordId } = idsFromForm(formData);
  let result: Awaited<ReturnType<typeof deletePartnerDriver>>;
  try {
    result = await deletePartnerDriver({
      partnerId,
      driverId: recordId,
      editor: { source: "ops", userId: actor.id },
    });
  } catch (error) {
    logFleetFailure("delete-driver", error, { partnerId, recordId });
    return { error: "failed", ok: false };
  }
  if (!result.ok) {
    logFleetFailure("delete-driver", result.error, { partnerId, recordId });
    return { error: result.error, ok: false };
  }
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
  revalidatePath(localizedPath(locale, "/ops/drivers"));
  if (String(formData.get("returnTo") ?? "") === "ops-drivers") {
    redirect(localizedPath(locale, "/ops/drivers"));
  }
  redirect(`${localizedPath(locale, `/ops/partners/${partnerId}`)}?tab=drivers`);
}

export async function updateOpsPartnerVehicleAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  const locale = localeFromForm(formData);
  const actor = await requireFleetManager();
  if (!actor) {
    return { error: "forbidden", ok: false };
  }
  const { partnerId, recordId } = idsFromForm(formData);
  try {
    const result = await updatePartnerVehicle({
      partnerId,
      vehicleId: recordId,
      editor: { source: "ops", userId: actor.id },
      plate: String(formData.get("plate") ?? ""),
      brandCode: String(formData.get("brandCode") ?? ""),
      modelCode: String(formData.get("modelCode") ?? ""),
      modelYear: String(formData.get("modelYear") ?? ""),
      colorCode: String(formData.get("colorCode") ?? ""),
      colorOther: String(formData.get("colorOther") ?? ""),
      passengerCapacity: String(formData.get("passengerCapacity") ?? ""),
      luggageCapacity: String(formData.get("luggageCapacity") ?? ""),
      vehicleClassCode: String(formData.get("vehicleClassCode") ?? ""),
      featureCodes: String(formData.get("featureCodes") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      featureOther: String(formData.get("featureOther") ?? ""),
    });
    if (!result.ok) {
      logFleetFailure("update-vehicle", result.error, { partnerId, recordId });
      return { error: result.error, ok: false };
    }
    const saved = await getPartnerVehicle(partnerId, recordId);
    if (!saved) {
      logFleetFailure("update-vehicle", "verify-missing", { partnerId, recordId });
      return { error: "failed", ok: false };
    }
    refreshFleet(locale, partnerId, "vehicles", recordId);
    return { error: null, ok: true };
  } catch (error) {
    logFleetFailure("update-vehicle", error, { partnerId, recordId });
    return { error: "failed", ok: false };
  }
}

export async function activateOpsPartnerVehicleAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  return changeVehicleStatus(formData, "activate");
}

export async function deactivateOpsPartnerVehicleAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  return changeVehicleStatus(formData, "deactivate");
}

async function changeVehicleStatus(
  formData: FormData,
  mode: "activate" | "deactivate",
): Promise<OpsFleetFormState> {
  const locale = localeFromForm(formData);
  const actor = await requireFleetManager();
  if (!actor) {
    return { error: "forbidden", ok: false };
  }
  const { partnerId, recordId } = idsFromForm(formData);
  try {
    const result =
      mode === "activate"
        ? await activatePartnerVehicle({
            partnerId,
            vehicleId: recordId,
            editor: { source: "ops", userId: actor.id },
          })
        : await deactivatePartnerVehicle({
            partnerId,
            vehicleId: recordId,
            editor: { source: "ops", userId: actor.id },
          });
    if (!result.ok) {
      logFleetFailure(`${mode}-vehicle`, result.error, { partnerId, recordId });
      return { error: result.error, ok: false };
    }
    const saved = await getPartnerVehicle(partnerId, recordId);
    const expected = mode === "activate" ? "active" : "inactive";
    if (!saved || saved.status !== expected) {
      logFleetFailure(`${mode}-vehicle`, "status-not-updated", {
        partnerId,
        recordId,
        actual: saved?.status ?? null,
      });
      return { error: "failed", ok: false };
    }
    refreshFleet(locale, partnerId, "vehicles", recordId);
    return { error: null, ok: true };
  } catch (error) {
    logFleetFailure(`${mode}-vehicle`, error, { partnerId, recordId });
    return { error: "failed", ok: false };
  }
}

export async function deleteOpsPartnerVehicleAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  const locale = localeFromForm(formData);
  const actor = await requireFleetManager();
  if (!actor) {
    return { error: "forbidden", ok: false };
  }
  const { partnerId, recordId } = idsFromForm(formData);
  let result: Awaited<ReturnType<typeof deletePartnerVehicle>>;
  try {
    result = await deletePartnerVehicle({
      partnerId,
      vehicleId: recordId,
      editor: { source: "ops", userId: actor.id },
    });
  } catch (error) {
    logFleetFailure("delete-vehicle", error, { partnerId, recordId });
    return { error: "failed", ok: false };
  }
  if (!result.ok) {
    logFleetFailure("delete-vehicle", result.error, { partnerId, recordId });
    return { error: result.error, ok: false };
  }
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
  revalidatePath(localizedPath(locale, "/ops/vehicles"));
  revalidatePath(localizedPath(locale, "/partner/vehicles"));
  if (String(formData.get("returnTo") ?? "") === "ops-vehicles") {
    redirect(localizedPath(locale, "/ops/vehicles"));
  }
  redirect(`${localizedPath(locale, `/ops/partners/${partnerId}`)}?tab=vehicles`);
}

export async function approveOpsPartnerVehicleAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  return decideVehicleApproval(formData, "approve");
}

export async function rejectOpsPartnerVehicleAction(
  _prev: OpsFleetFormState,
  formData: FormData,
): Promise<OpsFleetFormState> {
  return decideVehicleApproval(formData, "reject");
}

async function decideVehicleApproval(
  formData: FormData,
  mode: "approve" | "reject",
): Promise<OpsFleetFormState> {
  const locale = localeFromForm(formData);
  const actor = await requireFleetManager();
  if (!actor) {
    return { error: "forbidden", ok: false };
  }
  const { partnerId, recordId } = idsFromForm(formData);
  try {
    const result =
      mode === "approve"
        ? await approvePartnerVehicle({
            partnerId,
            vehicleId: recordId,
            editor: { source: "ops", userId: actor.id },
          })
        : await rejectPartnerVehicle({
            partnerId,
            vehicleId: recordId,
            editor: { source: "ops", userId: actor.id },
          });
    if (!result.ok) {
      logFleetFailure(`${mode}-vehicle`, result.error, { partnerId, recordId });
      return { error: result.error, ok: false };
    }
    refreshFleet(locale, partnerId, "vehicles", recordId);
    return { error: null, ok: true };
  } catch (error) {
    logFleetFailure(`${mode}-vehicle`, error, { partnerId, recordId });
    return { error: "failed", ok: false };
  }
}
