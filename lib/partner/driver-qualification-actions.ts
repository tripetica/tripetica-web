"use server";

import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import { normalizeDriverNationalId } from "@/lib/partner/driver-identity";
import { getPartnerDriver } from "@/lib/partner/fleet";
import { isTurkishIdentityNumber } from "@/lib/uetds/qualification";
import { cachedDriverQualification } from "@/lib/uetds/qualification-query";
import { readDriverQualification, refreshDriverQualification } from "@/lib/uetds/qualification-store";

export async function previewDriverQualificationAction(formData: FormData) {
  const actor = await getPartnerActor();
  if (!actor || actor.mustChangePassword || !partnerHasTab(actor, "drivers")) {
    return { status: "forbidden" as const };
  }
  const nationalId = normalizeDriverNationalId(String(formData.get("nationalId") ?? ""));
  const companyId = String(formData.get("companyId") ?? "");
  if (!isTurkishIdentityNumber(nationalId)) return { status: "invalid" as const };
  let outcome;
  try {
    outcome = await cachedDriverQualification({
      partnerId: actor.partnerId,
      companyId,
      nationalId,
    });
  } catch {
    return { status: "unverified" as const };
  }
  if (outcome.status === "unverified") return { status: "unverified" as const };
  return {
    status: "verified" as const,
    documents: outcome.documents,
    srcReady: outcome.srcReady,
  };
}

export async function refreshDriverQualificationAction(driverId: string) {
  const actor = await getPartnerActor();
  if (!actor || actor.mustChangePassword || !partnerHasTab(actor, "drivers")) {
    return { ok: false as const, error: "forbidden" as const };
  }
  const driver = await getPartnerDriver(actor.partnerId, driverId);
  const companyId = driver?.uetdsCompanyId ?? null;
  const nationalId = normalizeDriverNationalId(driver?.nationalId ?? "");
  if (!driver || !companyId || !/^\d{11}$/.test(nationalId)) {
    return { ok: false as const, error: "missing" as const };
  }
  try {
    const view = await refreshDriverQualification(driverId, companyId, nationalId);
    return { ok: true as const, view };
  } catch {
    return { ok: false as const, error: "failed" as const };
  }
}

export async function loadDriverQualificationAction(driverId: string) {
  const actor = await getPartnerActor();
  if (!actor || actor.mustChangePassword || !partnerHasTab(actor, "drivers")) return null;
  const driver = await getPartnerDriver(actor.partnerId, driverId);
  if (!driver) return null;
  return readDriverQualification(driver.id, driver.uetdsCompanyId ?? null);
}
