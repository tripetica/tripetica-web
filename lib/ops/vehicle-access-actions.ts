"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { isUuid } from "@/lib/ops/process-filters";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import {
  listVehiclePartnerAccess,
  saveVehiclePartnerAccess,
} from "@/lib/partner/vehicle-access";

export type VehicleAccessFormState = {
  ok: boolean;
  error: "forbidden" | "invalid" | "requires-partner" | "not-found" | "failed" | null;
};

export async function saveOpsVehiclePartnerAccessAction(
  _previous: VehicleAccessFormState,
  formData: FormData,
): Promise<VehicleAccessFormState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.manage")) {
    return { ok: false, error: "forbidden" };
  }
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const rawIds = String(formData.get("partnerIds") ?? "");
  const partnerIds = [...new Set(rawIds.split(",").map((id) => id.trim()).filter(Boolean))];
  if (!isUuid(vehicleId) || partnerIds.some((id) => !isUuid(id))) {
    return { ok: false, error: "invalid" };
  }
  if (partnerIds.length === 0) {
    return { ok: false, error: "requires-partner" };
  }

  try {
    const before = await listVehiclePartnerAccess(vehicleId);
    const companies = new Map(before.map((access) => [access.id, access.uetdsCompanyId]));
    const saved = await saveVehiclePartnerAccess({
      vehicleId,
      actorOpsUserId: actor.id,
      grants: partnerIds.map((partnerId) => ({
        partnerId,
        uetdsCompanyId: companies.get(partnerId) ?? null,
      })),
    });
    if (!saved.ok) return { ok: false, error: saved.error };

    const localeRaw = String(formData.get("locale") ?? "tr");
    const locale: Locale = isLocale(localeRaw) ? localeRaw : "tr";
    revalidatePath(localizedPath(locale, "/ops/vehicles"));
    revalidatePath(localizedPath(locale, `/ops/vehicles/${vehicleId}`));
    revalidatePath(localizedPath(locale, "/partner/vehicles"));
    revalidatePath(localizedPath(locale, "/partner/drivers"));
    for (const partnerId of new Set([...before.map((access) => access.id), ...partnerIds])) {
      revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
    }
    return { ok: true, error: null };
  } catch (error) {
    console.error("[ops-vehicle-access] save failed", { vehicleId }, error);
    return { ok: false, error: "failed" };
  }
}
