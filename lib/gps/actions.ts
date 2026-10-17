"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import {
  normalizeDeviceCode,
  telemetryIntervalError,
  wifiMaxClientsError,
  wifiPasswordError,
  wifiSsidError,
} from "@/lib/gps/contract";
import { softwareRebootPayload, wifiConfigPayload } from "@/lib/gps/commands";
import { gpsRegistrationProfile, gpsSecretRegistrationField, gpsSimOperator, gpsSimPhone } from "@/lib/gps/registration";
import { gpsReceiver } from "@/lib/teltonika/accept";
import { trackerModel } from "@/lib/teltonika/immobilizer";
import { canDeleteGpsDevice } from "@/lib/gps/delete-access";
import {
  assignGpsDevice,
  createGpsDevice,
  deleteGpsDeviceForActor,
  getGpsDevice,
  queueGpsCommand,
  queueGpsLowBattery,
  queueGpsWifiShare,
  revokeGpsDeviceToken,
  rotateGpsDeviceToken,
  setGpsDeviceStatus,
  updateGpsImei,
  updateGpsSimOperator,
  updateGpsSimPhone,
} from "@/lib/gps/queries";

export type GpsActionState = {
  ok: boolean;
  error?: string;
  token?: string;
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
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "";
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function postgresConstraint(error: unknown) {
  if (!error || typeof error !== "object" || !("constraint" in error)) {
    return "";
  }
  const constraint = (error as { constraint?: unknown }).constraint;
  return typeof constraint === "string" ? constraint : "";
}

function postgresMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return "";
  }
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
  const partnerRaw = String(formData.get("partnerId") ?? "").trim();
  const vehicleRaw = String(formData.get("vehicleId") ?? "").trim();
  const deviceCodeRaw = String(formData.get("deviceCode") ?? "").trim();
  const deviceCode = deviceCodeRaw ? normalizeDeviceCode(deviceCodeRaw) : null;
  const label = String(formData.get("label") ?? "").trim();
  const imeiRaw = String(formData.get("imei") ?? "").trim();
  const receiver = gpsReceiver(formData.get("receiver"));
  const model = trackerModel(formData.get("trackerModel"));
  if (deviceCodeRaw && !deviceCode) {
    return { ok: false, error: "device_code" };
  }
  if (label.length > 80) {
    return { ok: false, error: "invalid" };
  }
  if (!partnerRaw && vehicleRaw) {
    return { ok: false, error: "vehicle" };
  }
  if (!receiver || (receiver === "teltonika" && !model)) {
    return { ok: false, error: "invalid" };
  }
  for (const key of formData.keys()) {
    if (gpsSecretRegistrationField(key)) {
      return { ok: false, error: "invalid" };
    }
  }
  const profile = gpsRegistrationProfile({
    receiver,
    model: receiver === "teltonika" ? model : null,
    imei: imeiRaw,
    serial: receiver === "teltonika" ? String(formData.get("serialNumber") ?? "") : "",
    simPhone: String(formData.get("simPhone") ?? ""),
    simOperator: String(formData.get("simOperator") ?? ""),
    simApn: receiver === "teltonika" ? String(formData.get("simApn") ?? "") : "",
  });
  if (!profile.ok) {
    return { ok: false, error: profile.error };
  }
  try {
    const created = await createGpsDevice({
      partnerId: partnerRaw || null,
      vehicleId: vehicleRaw || null,
      deviceCode,
      label: label || null,
      imei: profile.value.imei,
      receiver: profile.value.receiver,
      trackerModel: profile.value.trackerModel,
      profile: profile.value,
      assignedBy: actorLabel(actor),
    });
    revalidateGps(created.id);
    return { ok: true, token: created.token, deviceId: created.id };
  } catch (error) {
    if (postgresMessage(error).includes("gps_device_vehicle_partner_mismatch")) {
      return { ok: false, error: "vehicle" };
    }
    if (postgresCode(error) === "23505") {
      const constraint = postgresConstraint(error);
      return { ok: false, error: constraint?.includes("imei") ? "imei" : "device_code" };
    }
    return { ok: false, error: "failed" };
  }
}

export async function rotateGpsDeviceTokenAction(
  _previous: GpsActionState | null,
  formData: FormData,
): Promise<GpsActionState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "gps.manage")) {
    return { ok: false, error: "forbidden" };
  }
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const token = deviceId ? await rotateGpsDeviceToken(deviceId) : null;
  if (!token) {
    return { ok: false, error: "failed" };
  }
  revalidateGps(deviceId);
  return { ok: true, token, deviceId };
}

export async function assignGpsDeviceAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const partnerRaw = String(formData.get("partnerId") ?? "").trim();
  const vehicleRaw = String(formData.get("vehicleId") ?? "").trim();
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) {
    return;
  }
  const device = await getGpsDevice(deviceId, null);
  if (!device) {
    return;
  }
  const path = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (!partnerRaw && vehicleRaw) {
    redirect(`${path}?error=vehicle`);
  }
  try {
    await assignGpsDevice({
      deviceId,
      partnerId: partnerRaw || null,
      vehicleId: vehicleRaw || null,
      assignedBy: actorLabel(actor),
    });
  } catch (error) {
    const code = postgresMessage(error).includes("gps_device_vehicle_partner_mismatch")
      ? "vehicle"
      : "failed";
    redirect(`${path}?error=${code}`);
  }
  revalidateGps(deviceId);
  redirect(path);
}

export async function revokeGpsDeviceTokenAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) {
    return;
  }
  await revokeGpsDeviceToken(deviceId);
  revalidateGps(deviceId);
  redirect(localizedPath(locale, `/ops/gps/${deviceId}`));
}

export async function updateGpsImeiAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const imeiRaw = String(formData.get("imei") ?? "").trim();
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) {
    return;
  }
  const path = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (imeiRaw && !/^[0-9]{14,16}$/.test(imeiRaw)) {
    redirect(`${path}?error=imei`);
  }
  try {
    await updateGpsImei(deviceId, imeiRaw || null);
  } catch (error) {
    const constraint = postgresConstraint(error);
    redirect(`${path}?error=${postgresCode(error) === "23505" && constraint.includes("imei") ? "imei" : "failed"}`);
  }
  revalidateGps(deviceId);
  redirect(path);
}

export async function updateGpsSimOperatorAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const simOperator = gpsSimOperator(String(formData.get("simOperator") ?? ""));
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) {
    return;
  }
  const path = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (!simOperator) {
    redirect(`${path}?error=invalid`);
  }
  const device = await getGpsDevice(deviceId, null);
  if (!device) {
    redirect(`${path}?error=failed`);
  }
  await updateGpsSimOperator(deviceId, simOperator);
  revalidateGps(deviceId);
  redirect(path);
}

export async function updateGpsSimPhoneAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const simPhone = gpsSimPhone(String(formData.get("simPhone") ?? ""));
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) {
    return;
  }
  const path = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (simPhone === undefined) {
    redirect(`${path}?error=invalid`);
  }
  const device = await getGpsDevice(deviceId, null);
  if (!device) {
    redirect(`${path}?error=failed`);
  }
  await updateGpsSimPhone(deviceId, simPhone);
  revalidateGps(deviceId);
  redirect(path);
}

function actorLabel(actor: { firstName: string; lastName: string }) {
  return `${actor.firstName} ${actor.lastName}`.trim().slice(0, 80) || "ops";
}

export async function setGpsDeviceStatusAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const actor = await getOpsActor();
  if (!locale || !deviceId || (status !== "active" && status !== "disabled")) {
    return;
  }
  if (!actor || !actorCan(actor, "gps.manage")) {
    return;
  }
  await setGpsDeviceStatus(deviceId, status);
  revalidateGps(deviceId);
  redirect(localizedPath(locale, `/ops/gps/${deviceId}`));
}

export async function queueGpsWifiAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const surface = String(formData.get("surface") ?? "");
  if (!locale || !deviceId || (surface !== "ops" && surface !== "partner")) {
    return;
  }
  const submittedMode = String(formData.get("mode") ?? "");
  const ssid = String(formData.get("ssid") ?? "");
  const password = String(formData.get("password") ?? "");
  const maxClients = Number(formData.get("maxClients"));
  let partnerScope: string | null = null;
  let actorLabel = "";
  if (surface === "ops") {
    const ops = await getOpsActor();
    if (!ops || !actorCan(ops, "gps.manage")) {
      return;
    }
    actorLabel = `${ops.firstName} ${ops.lastName}`.trim();
  } else {
    const partner = await getPartnerActor();
    if (!partner || !partner.isPrimaryPartner || !partnerHasTab(partner, "gps")) {
      return;
    }
    partnerScope = partner.partnerId;
    actorLabel = partner.partnerName;
  }
  const device = await getGpsDevice(deviceId, partnerScope);
  if (!device) {
    return;
  }
  const mode = submittedMode || (surface === "partner" ? device.wifiMode : "");
  const path = localizedPath(
    locale,
    surface === "ops" ? `/ops/gps/${deviceId}` : `/partner/gps/${deviceId}`,
  );
  if (mode !== "on" && mode !== "off" && mode !== "auto") {
    redirect(`${path}?error=wifi`);
  }
  if (wifiMaxClientsError(maxClients)) {
    redirect(`${path}?error=wifi`);
  }
  if ((mode !== "off" || ssid.trim()) && wifiSsidError(ssid)) {
    redirect(`${path}?error=wifi`);
  }
  if (password && wifiPasswordError(password)) {
    redirect(`${path}?error=wifi`);
  }
  if (!device.partnerId) {
    redirect(`${path}?error=vehicle`);
  }
  const createdBy: "ops" | "partner" = surface === "ops" ? "ops" : "partner";
  await queueGpsCommand({
    createdBy,
    actorLabel,
    deviceId,
    partnerId: device.partnerId,
    kind: "wifi_config",
    payload: wifiConfigPayload({
      mode,
      ssid,
      password,
      maxClients,
    }),
  });
  revalidateGps(deviceId);
  redirect(path);
}

export async function queueGpsWifiShareAction(input: {
  deviceId: string;
  surface: "ops" | "partner";
  mode: "on" | "off";
}): Promise<{ ok: true; commandId: string } | { ok: false }> {
  const deviceId = input.deviceId.trim();
  if (!deviceId || (input.mode !== "on" && input.mode !== "off")) return { ok: false };
  if (input.surface !== "ops" && input.surface !== "partner") return { ok: false };
  let partnerScope: string | null = null;
  let actorLabel = "";
  let createdBy: "ops" | "partner" = "partner";
  if (input.surface === "ops") {
    const ops = await getOpsActor();
    if (!ops || !actorCan(ops, "gps.manage")) return { ok: false };
    actorLabel = `${ops.firstName} ${ops.lastName}`.trim();
    createdBy = "ops";
  } else {
    const partner = await getPartnerActor();
    if (!partner || !partner.isPrimaryPartner || !partnerHasTab(partner, "gps")) return { ok: false };
    partnerScope = partner.partnerId;
    actorLabel = partner.partnerName;
  }
  const device = await getGpsDevice(deviceId, partnerScope);
  if (!device?.partnerId) return { ok: false };
  const queued = await queueGpsWifiShare({
    deviceId,
    partnerId: device.partnerId,
    createdBy,
    actorLabel,
    mode: input.mode,
  });
  if (!queued) return { ok: false };
  revalidateGps(deviceId);
  return { ok: true, commandId: queued.id };
}

export async function queueGpsLowBatteryAction(input: {
  deviceId: string;
  action: "keep_on" | "save_power";
}): Promise<{ ok: true; commandId: string } | { ok: false }> {
  const deviceId = input.deviceId.trim();
  if (!deviceId || (input.action !== "keep_on" && input.action !== "save_power")) return { ok: false };
  const partner = await getPartnerActor();
  if (!partner || !partner.isPrimaryPartner || !partnerHasTab(partner, "gps")) return { ok: false };
  const device = await getGpsDevice(deviceId, partner.partnerId);
  if (!device?.partnerId || device.partnerId !== partner.partnerId) return { ok: false };
  const queued = await queueGpsLowBattery({
    deviceId,
    partnerId: device.partnerId,
    actorLabel: partner.partnerName,
    action: input.action,
  });
  if (!queued) return { ok: false };
  revalidateGps(deviceId);
  return { ok: true, commandId: queued.id };
}

export async function queueGpsRebootAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const surface = String(formData.get("surface") ?? "");
  if (!locale || !deviceId || (surface !== "ops" && surface !== "partner")) {
    return;
  }
  let partnerScope: string | null = null;
  let actorLabel = "";
  let createdBy: "ops" | "partner" = "partner";
  if (surface === "ops") {
    const ops = await getOpsActor();
    if (!ops || !actorCan(ops, "gps.manage")) {
      return;
    }
    actorLabel = `${ops.firstName} ${ops.lastName}`.trim();
    createdBy = "ops";
  } else {
    const partner = await getPartnerActor();
    if (!partner || !partner.isPrimaryPartner || !partnerHasTab(partner, "gps")) {
      return;
    }
    partnerScope = partner.partnerId;
    actorLabel = partner.partnerName;
  }
  const device = await getGpsDevice(deviceId, partnerScope);
  if (!device?.partnerId) {
    return;
  }
  await queueGpsCommand({
    deviceId,
    partnerId: device.partnerId,
    createdBy,
    actorLabel,
    kind: "reboot",
    payload: softwareRebootPayload(),
  });
  revalidateGps(deviceId);
  redirect(localizedPath(locale, surface === "ops" ? `/ops/gps/${deviceId}` : `/partner/gps/${deviceId}`));
}

export async function queueGpsOpsCommandAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const actor = await getOpsActor();
  if (!locale || !deviceId || !actor || !actorCan(actor, "gps.manage")) {
    return;
  }
  const remoteKinds = ["reboot", "modem_reset", "gnss_restart", "ppp_reconnect", "status", "set_telemetry"];
  if (!remoteKinds.includes(kind)) {
    return;
  }
  const device = await getGpsDevice(deviceId, null);
  if (!device) {
    return;
  }
  const path = localizedPath(locale, `/ops/gps/${deviceId}`);
  let payload: Record<string, unknown> = {};
  if (kind === "set_telemetry") {
    const interval = Number(formData.get("interval"));
    if (telemetryIntervalError(interval)) {
      redirect(`${path}?error=telemetry`);
    }
    payload = { interval_s: interval };
  }
  if (!device.partnerId) {
    redirect(`${path}?error=vehicle`);
  }
  await queueGpsCommand({
    deviceId,
    partnerId: device.partnerId,
    createdBy: "ops",
    actorLabel: `${actor.firstName} ${actor.lastName}`.trim(),
    kind,
    payload,
  });
  revalidateGps(deviceId);
  redirect(path);
}

export async function deleteGpsDeviceAction(formData: FormData) {
  const locale = readLocale(formData);
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const actor = await getOpsActor();
  const path = locale && deviceId ? localizedPath(locale, `/ops/gps/${deviceId}`) : null;
  if (!locale || !deviceId || !actor || !canDeleteGpsDevice(actor.id) || !path) {
    if (path) {
      redirect(`${path}?error=forbidden`);
    }
    return;
  }
  const result = await deleteGpsDeviceForActor(actor.id, deviceId);
  if (result === "deleted") {
    revalidateGps(deviceId);
    redirect(localizedPath(locale, "/ops/gps"));
  }
  if (result === "used") {
    redirect(`${path}?error=device_used`);
  }
  if (result === "forbidden") {
    redirect(`${path}?error=forbidden`);
  }
  redirect(localizedPath(locale, "/ops/gps"));
}
