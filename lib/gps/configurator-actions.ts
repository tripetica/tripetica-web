"use server";

import { revalidatePath } from "next/cache";
import { locales } from "@/lib/i18n/config";
import { requestDeviceKeyword } from "@/lib/gps/device-keyword";
import { requestDeviceRestart } from "@/lib/gps/device-restart";
import { queueParameterApply } from "@/lib/gps/parameter-apply";
import { queueConfiguratorApply, queueManualConfiguratorRead, saveConfigurator, syncConfiguratorRead } from "@/lib/gps/configurator-store";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import type { ConfigValues } from "@/lib/teltonika/config-plan";

export type ConfiguratorActionState = {
  ok: boolean;
  error?: string;
  detail?: string;
  version?: number;
  queued?: number;
  unchanged?: number;
  skipped?: number;
  parameterId?: number;
  values?: ConfigValues;
  phase?: string;
  deviceId?: string;
};

function revalidateGps() {
  for (const locale of locales) revalidatePath(`/${locale}/ops/gps`);
}

function readValues(formData: FormData): ConfigValues {
  try {
    const parsed = JSON.parse(String(formData.get("values") ?? "{}")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const values: ConfigValues = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") values[key] = value;
    }
    return values;
  } catch {
    return {};
  }
}

function readDevices(formData: FormData) {
  try {
    const parsed = JSON.parse(String(formData.get("devices") ?? "[]")) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function saveConfiguratorAction(
  _previous: ConfiguratorActionState | null,
  formData: FormData,
): Promise<ConfiguratorActionState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "gps.manage")) return { ok: false, error: "forbidden" };
  const scope = formData.get("scope") === "devices" ? "devices" : "standard";
  try {
    const result = await saveConfigurator({
      actorId: actor.id,
      scope,
      deviceIds: readDevices(formData),
      values: readValues(formData),
      note: String(formData.get("note") ?? ""),
      criticalApproved: formData.get("critical") === "yes",
    });
    if (!result.ok) return { ok: false, error: result.error, detail: "detail" in result ? result.detail : undefined };
    revalidateGps();
    return {
      ok: true,
      version: "version" in result ? result.version : undefined,
      values: "values" in result ? result.values : undefined,
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function readDeviceAction(
  _previous: ConfiguratorActionState | null,
  formData: FormData,
): Promise<ConfiguratorActionState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "gps.manage")) return { ok: false, error: "forbidden" };
  const deviceId = String(formData.get("device") ?? "");
  if (!deviceId) return { ok: false, error: "devices", deviceId };
  try {
    const result = await queueManualConfiguratorRead({ actorId: actor.id, deviceId });
    if (!result.ok) return { ok: false, error: result.error, deviceId };
    revalidateGps();
    return { ok: true, queued: result.queued, deviceId, phase: result.queued === 1 ? "starting" : "pending" };
  } catch {
    return { ok: false, error: "failed", deviceId };
  }
}

export async function syncConfiguratorReadAction(
  _previous: ConfiguratorActionState | null,
  formData: FormData,
): Promise<ConfiguratorActionState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "gps.manage")) return { ok: false, error: "forbidden" };
  const device = String(formData.get("device") ?? "");
  try {
    const result = await syncConfiguratorRead({ actorId: actor.id, deviceId: device || null });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateGps();
    return { ok: true, queued: result.queued };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function applyConfiguratorAction(
  _previous: ConfiguratorActionState | null,
  formData: FormData,
): Promise<ConfiguratorActionState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "gps.manage")) return { ok: false, error: "forbidden" };
  if (formData.get("dirty") === "yes") return { ok: false, error: "unsaved" };
  try {
    const result = await queueConfiguratorApply({
      actorId: actor.id,
      deviceIds: readDevices(formData),
      criticalApproved: formData.get("critical") === "yes",
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateGps();
    return { ok: true, queued: result.queued, version: result.version };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function applyParameterAction(
  _previous: ConfiguratorActionState | null,
  formData: FormData,
): Promise<ConfiguratorActionState> {
  const actor = await getOpsActor();
  const parameterId = Number(formData.get("parameter"));
  const parameter = Number.isInteger(parameterId) ? parameterId : undefined;
  if (!actor || !actorCan(actor, "gps.manage")) return { ok: false, error: "forbidden", parameterId: parameter };
  const deviceIds = readDevices(formData);
  if (deviceIds.length === 0) return { ok: false, error: "devices", parameterId: parameter };
  if (parameter === undefined) return { ok: false, error: "unsupported" };
  try {
    const result = await queueParameterApply({
      actorId: actor.id,
      deviceIds,
      parameterId,
      value: String(formData.get("value") ?? ""),
    });
    if (!result.ok) return { ok: false, error: result.error, parameterId: parameter };
    revalidateGps();
    return { ok: true, queued: result.queued, unchanged: result.unchanged, skipped: result.skipped, parameterId: parameter };
  } catch {
    return { ok: false, error: "failed", parameterId: parameter };
  }
}

export async function restartDeviceAction(
  _previous: ConfiguratorActionState | null,
  formData: FormData,
): Promise<ConfiguratorActionState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "gps.manage")) return { ok: false, error: "forbidden" };
  const deviceId = String(formData.get("device") ?? "");
  try {
    const result = await requestDeviceRestart({ actorId: actor.id, deviceId });
    if (!result.ok) return { ok: false, error: result.error, phase: "phase" in result ? result.phase : undefined, deviceId };
    revalidateGps();
    return { ok: true, phase: result.phase, deviceId };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function keywordDeviceAction(
  _previous: ConfiguratorActionState | null,
  formData: FormData,
): Promise<ConfiguratorActionState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "gps.manage")) return { ok: false, error: "forbidden" };
  const deviceId = String(formData.get("device") ?? "");
  const action = formData.get("keywordAction") === "remove" ? "remove" : "set";
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");
  if (action === "set" && next !== repeat) return { ok: false, error: "mismatch", deviceId };
  try {
    const result = await requestDeviceKeyword({ actorId: actor.id, deviceId, action, current, next });
    if (!result.ok) return { ok: false, error: result.error, phase: "phase" in result ? result.phase : undefined, deviceId };
    revalidateGps();
    return { ok: true, phase: result.phase, deviceId };
  } catch {
    return { ok: false, error: "failed", deviceId };
  }
}
