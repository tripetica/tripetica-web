"use server";

import { revalidatePath } from "next/cache";
import { locales } from "@/lib/i18n/config";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { driverMayUseDevice } from "@/lib/driver-portal/gps-scope";
import { beginImmobilizerEnable, loadImmobilizerPanelForDevice, recordImmobilizerRequest, recordStarterCircuitVerification } from "@/lib/teltonika/immobilizer-store";
import { starterVerificationDecision, type ImmobilizerRequest } from "@/lib/teltonika/immobilizer";

async function immobilizerActor(surface: "ops" | "partner", deviceId: string) {
  if (surface === "ops") {
    const ops = await getOpsActor();
    if (!ops || !actorCan(ops, "gps.manage")) return null;
    return {
      partnerScope: null,
      actorLabel: `${ops.firstName} ${ops.lastName}`.trim() || ops.email,
      actorKey: `ops:${ops.id}`,
    };
  }
  const partner = await getPartnerActor();
  if (partner && !partner.mustChangePassword && partner.isPrimaryPartner && partnerHasTab(partner, "gps")) {
    return {
      partnerScope: partner.partnerId,
      actorLabel: partner.partnerName,
      actorKey: `partner:${partner.userId}`,
    };
  }
  const driver = await driverMayUseDevice(deviceId, "gpsDevice");
  if (!driver) return null;
  return {
    partnerScope: driver.partnerId,
    actorLabel: `${driver.firstName} ${driver.lastName}`.trim() || driver.email,
    actorKey: `driver:${driver.driverId}`,
  };
}

export async function beginImmobilizerEnableAction(input: {
  deviceId: string;
  surface: "ops" | "partner";
}) {
  const deviceId = input.deviceId.trim();
  if (!deviceId || (input.surface !== "ops" && input.surface !== "partner")) {
    return { ok: false as const, error: "invalid" as const };
  }
  const actor = await immobilizerActor(input.surface, deviceId);
  if (!actor) return { ok: false as const, error: "forbidden" as const };
  return beginImmobilizerEnable({
    deviceId,
    partnerScope: actor.partnerScope,
    actorKey: actor.actorKey,
    surface: input.surface,
  });
}

export async function readImmobilizerPanelAction(input: {
  deviceId: string;
  surface: "ops" | "partner";
}) {
  const deviceId = input.deviceId.trim();
  if (!deviceId || (input.surface !== "ops" && input.surface !== "partner")) {
    return { ok: false as const, error: "invalid" as const };
  }
  const actor = await immobilizerActor(input.surface, deviceId);
  if (!actor) return { ok: false as const, error: "forbidden" as const };
  const panel = await loadImmobilizerPanelForDevice(deviceId, actor.partnerScope);
  if (!panel) return { ok: false as const, error: "forbidden" as const };
  return {
    ok: true as const,
    panel: {
      request: panel.request,
      output: panel.output,
      phase: panel.phase,
      commandAt: panel.commandAt,
      lastHeartbeatAt: panel.lastHeartbeatAt,
      readiness: panel.readiness,
      starterCircuitVerified: panel.starterCircuitVerified,
    },
  };
}

export async function requestImmobilizerAction(input: {
  deviceId: string;
  surface: "ops" | "partner";
  request: ImmobilizerRequest;
  confirmationId: string | null;
}) {
  const deviceId = input.deviceId.trim();
  if (!deviceId || (input.request !== "on" && input.request !== "off")) {
    return { ok: false as const, error: "invalid" as const };
  }
  if (input.surface !== "ops" && input.surface !== "partner") {
    return { ok: false as const, error: "invalid" as const };
  }
  const actor = await immobilizerActor(input.surface, deviceId);
  if (!actor) return { ok: false as const, error: "forbidden" as const };
  const recorded = await recordImmobilizerRequest({
    deviceId,
    partnerScope: actor.partnerScope,
    actorLabel: actor.actorLabel,
    actorKey: actor.actorKey,
    surface: input.surface,
    request: input.request,
    confirmationId: input.request === "on" ? input.confirmationId : null,
  });
  if (!recorded.ok) return recorded;
  for (const locale of locales) {
    revalidatePath(`/${locale}/ops/gps`);
    revalidatePath(`/${locale}/partner/gps`);
    revalidatePath(`/${locale}/ops/gps/${deviceId}`);
    revalidatePath(`/${locale}/partner/gps/${deviceId}`);
  }
  return { ok: true as const, panel: recorded.panel };
}

export async function recordStarterCircuitVerificationAction(formData: FormData) {
  const ops = await getOpsActor();
  if (!ops || !actorCan(ops, "gps.manage")) return;
  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const locale = String(formData.get("locale") ?? "").trim();
  if (!deviceId) return;
  const decision = starterVerificationDecision({
    intent: String(formData.get("intent") ?? ""),
    physicalMeasurement: String(formData.get("physicalMeasurement") ?? ""),
    clearConfirm: String(formData.get("clearConfirm") ?? ""),
  });
  if (decision === "refuse") return;
  const actorLabel = (`${ops.firstName} ${ops.lastName}`.trim() || ops.email).slice(0, 120);
  await recordStarterCircuitVerification({
    deviceId,
    actorLabel,
    verified: decision === "verify",
  });
  for (const item of locales) {
    revalidatePath(`/${item}/ops/gps`);
    revalidatePath(`/${item}/ops/gps/${deviceId}`);
    revalidatePath(`/${item}/partner/gps`);
  }
  if (locale) revalidatePath(`/${locale}/ops/gps/${deviceId}`);
}
