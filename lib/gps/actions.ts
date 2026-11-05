"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { normalizeDeviceCode } from "@/lib/gps/contract";
import { gpsRegistrationProfile, gpsSimOperator, gpsSimPhone } from "@/lib/gps/registration";
import { trackerModel } from "@/lib/teltonika/immobilizer";
import {
  assignGpsDevice,
  createGpsDevice,
  deleteGpsDevice,
  getGpsDevice,
  setGpsDeviceStatus,
  updateGpsImei,
  updateGpsSimOperator,
  updateGpsSimPhone,
} from "@/lib/gps/queries";

export type GpsActionState = {
  ok: boolean;
  error?: string;
  deviceId?: string;
};

function revalidateGps(deviceId?: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}/ops/gps`);
    revalidatePath(`/${locale}/partner/gps`);
    if (deviceId) {
      revalidatePath(`/${locale}/ops/gps/${deviceId}`);
      revalidatePath(`/${locale}/partner/gps/${deviceId}`);
    }
  }
}

function readLocale(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  return isLocale(locale) ? locale : null;
}

function postgresCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function postgresConstraint(error: unknown) {
  if (!error || typeof error !== "object" || !("constraint" in error)) return "";
  const constraint = (error as { constraint?: unknown }).constraint;
  return typeof constraint === "string" ? constraint : "";
}

function postgresMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

export async function createGpsDeviceAction(
  _previous: GpsActionState | null,
  formData: FormData,
): Promise<GpsActionState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "gps.manage")) {
    return { ok: false, error: "forbidden" };
  }
  const receiver = String(formData.get("receiver") ?? "teltonika");
  if (receiver !== "teltonika") {
    return { ok: false, error: "invalid" };
  }
  const partnerRaw = String(formData.get("partnerId") ?? "").trim();
  const vehicleRaw = String(formData.get("vehicleId") ?? "").trim();
  const deviceCodeRaw = String(formData.get("deviceCode") ?? "").trim();
  const deviceCode = deviceCodeRaw ? normalizeDeviceCode(deviceCodeRaw) : null;
  const label = String(formData.get("label") ?? "").trim();
  const model = trackerModel(formData.get("trackerModel"));
  if (deviceCodeRaw && !deviceCode) return { ok: false, error: "device_code" };
  if (label.length > 80 || !model) return { ok: false, error: "invalid" };
  if (!partnerRaw && vehicleRaw) return { ok: false, error: "vehicle" };

  const profile = gpsRegistrationProfile({
    model,
    imei: String(formData.get("imei") ?? ""),
    serial: String(formData.get("serialNumber") ?? ""),
    simPhone: String(formData.get("simPhone") ?? ""),
    simOperator: String(formData.get("simOperator") ?? ""),
    simApn: String(formData.get("simApn") ?? ""),
  });
  if (!profile.ok) return { ok: false, error: profile.error };

  try {
    const created = await createGpsDevice({
      partnerId: partnerRaw || null,
      vehicleId: vehicleRaw || null,
      deviceCode,
      label: label || null,
      profile: profile.value,
      assignedBy: actorLabel(actor),
    });
    revalidateGps(created.id);
    return { ok: true, deviceId: created.id };
  } catch (error) {
    if (postgresMessage(error).includes("gps_device_vehicle_partner_mismatch")) {
      return { ok: false, error: "vehicle" };
    }
    if (postgresCode(error) === "23505") {
      return { ok: false, error: postgresConstraint(error).includes("imei") ? "imei" : "device_code" };
    }
    return { ok: false, error: "failed" };
  }
}

export async function assignGpsDeviceAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const partnerRaw = String(formData.get("partnerId") ?? "").trim();
  const vehicleRaw = String(formData.get("vehicleId") ?? "").trim();
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) return;
  const device = await getGpsDevice(deviceId, null);
  if (!device) return;
  const path = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (!partnerRaw && vehicleRaw) redirect(`${path}?error=vehicle`);
  try {
    await assignGpsDevice({
      deviceId,
      partnerId: partnerRaw || null,
      vehicleId: vehicleRaw || null,
      assignedBy: actorLabel(actor),
    });
  } catch (error) {
    redirect(`${path}?error=${postgresMessage(error).includes("gps_device_vehicle_partner_mismatch") ? "vehicle" : "failed"}`);
  }
  revalidateGps(deviceId);
  redirect(path);
}

export async function updateGpsImeiAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const imei = String(formData.get("imei") ?? "").trim();
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) return;
  const path = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (!/^[0-9]{14,16}$/.test(imei)) redirect(`${path}?error=imei`);
  try {
    await updateGpsImei(deviceId, imei);
  } catch (error) {
    redirect(`${path}?error=${postgresCode(error) === "23505" && postgresConstraint(error).includes("imei") ? "imei" : "failed"}`);
  }
  revalidateGps(deviceId);
  redirect(path);
}

export async function updateGpsSimOperatorAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const simOperator = gpsSimOperator(String(formData.get("simOperator") ?? ""));
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) return;
  const path = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (!simOperator || !(await getGpsDevice(deviceId, null))) redirect(`${path}?error=invalid`);
  await updateGpsSimOperator(deviceId, simOperator);
  revalidateGps(deviceId);
  redirect(path);
}

export async function updateGpsSimPhoneAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const simPhone = gpsSimPhone(String(formData.get("simPhone") ?? ""));
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) return;
  const path = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (simPhone === undefined || !(await getGpsDevice(deviceId, null))) redirect(`${path}?error=invalid`);
  await updateGpsSimPhone(deviceId, simPhone);
  revalidateGps(deviceId);
  redirect(path);
}

export async function setGpsDeviceStatusAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const actor = await getOpsActor();
  if (!locale || !deviceId || (status !== "active" && status !== "disabled")) return;
  if (!actor || !actorCan(actor, "gps.manage")) return;
  await setGpsDeviceStatus(deviceId, status);
  revalidateGps(deviceId);
  redirect(localizedPath(locale, `/ops/gps/${deviceId}`));
}

export async function deleteGpsDeviceAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const actor = await getOpsActor();
  const path = locale && deviceId ? localizedPath(locale, `/ops/gps/${deviceId}`) : null;
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage") || !path) {
    if (path) redirect(`${path}?error=forbidden`);
    return;
  }
  const result = await deleteGpsDevice(deviceId, actor.id);
  if (result === "deleted") {
    revalidateGps(deviceId);
    redirect(`${localizedPath(locale, "/ops/gps")}?tab=devices&deleted=1`);
  }
  redirect(`${localizedPath(locale, "/ops/gps")}?tab=devices&error=missing`);
}

function actorLabel(actor: { firstName: string; lastName: string }) {
  return `${actor.firstName} ${actor.lastName}`.trim().slice(0, 80) || "ops";
}
