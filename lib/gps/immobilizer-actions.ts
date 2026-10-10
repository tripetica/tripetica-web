"use server";

import { revalidatePath } from "next/cache";
import { locales } from "@/lib/i18n/config";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { recordImmobilizerRequest } from "@/lib/teltonika/immobilizer-store";
import { type ImmobilizerRequest } from "@/lib/teltonika/immobilizer";

export async function requestImmobilizerAction(input: {
  deviceId: string;
  surface: "ops" | "partner";
  request: ImmobilizerRequest;
  confirmed: boolean;
}) {
  const deviceId = input.deviceId.trim();
  if (!deviceId || (input.request !== "on" && input.request !== "off")) {
    return { ok: false as const, error: "invalid" as const };
  }
  if (input.surface !== "ops" && input.surface !== "partner") {
    return { ok: false as const, error: "invalid" as const };
  }
  let partnerScope: string | null = null;
  let actorLabel = "";
  if (input.surface === "ops") {
    const ops = await getOpsActor();
    if (!ops || !actorCan(ops, "gps.manage")) return { ok: false as const, error: "forbidden" as const };
    actorLabel = `${ops.firstName} ${ops.lastName}`.trim() || ops.email;
  } else {
    const partner = await getPartnerActor();
    if (!partner || !partner.isPrimaryPartner || !partnerHasTab(partner, "gps")) return { ok: false as const, error: "forbidden" as const };
    partnerScope = partner.partnerId;
    actorLabel = partner.partnerName;
  }
  const recorded = await recordImmobilizerRequest({
    deviceId,
    partnerScope,
    actorLabel,
    surface: input.surface,
    request: input.request,
    confirmed: input.confirmed,
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
