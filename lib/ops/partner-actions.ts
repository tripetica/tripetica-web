"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import {
  activateOpsPartner,
  deactivateOpsPartner,
  deleteOpsPartner,
  getOpsPartner,
  updateOpsPartnerProfile,
} from "@/lib/ops/partners";
import { partnerProfileFieldsFromForm } from "@/lib/ops/partner-form-state";
import { PARTNER_PRIMARY_FORM_VALUE } from "@/lib/ops/partner-priority";

export type OpsPartnerFormState = {
  error:
    | "forbidden"
    | "not-found"
    | "duplicate"
    | "invalid-email"
    | "invalid-phone"
    | "invalid-name"
    | "invalid-contact"
    | "invalid-business-type"
    | "invalid-address"
    | "invalid-country"
    | "invalid-tax-office"
    | "invalid-tax-number"
    | "invalid-priority"
    | "missing-priority"
    | "incomplete"
    | "primary"
    | "primary-taken"
    | "deleted"
    | "failed"
    | null;
  ok: boolean;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

function refreshPartner(locale: Locale, partnerId: string) {
  revalidatePath(localizedPath(locale, "/ops/partners"));
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
}

function logPartnerActionFailure(
  action: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  console.error(`[ops-partner] ${action} failed`, extra ?? {}, error);
}

export async function updateOpsPartnerAction(
  _prev: OpsPartnerFormState,
  formData: FormData,
): Promise<OpsPartnerFormState> {
  const locale = localeFromForm(formData);
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.manage")) {
    return { error: "forbidden", ok: false };
  }
  const partnerId = String(formData.get("id") ?? "");
  const fields = partnerProfileFieldsFromForm(formData);
  try {
    const result = await updateOpsPartnerProfile({
      partnerId,
      opsUserId: actor.id,
      ...fields,
    });
    if (!result.ok) {
      logPartnerActionFailure("update", result.error, { partnerId });
      if (
        result.error === "password-short" ||
        result.error === "password-mismatch" ||
        result.error === "invalid-national-id"
      ) {
        return { error: "failed", ok: false };
      }
      return { error: result.error, ok: false };
    }
    const saved = await getOpsPartner(partnerId);
    if (!saved) {
      logPartnerActionFailure("update", "verify-missing", { partnerId });
      return { error: "failed", ok: false };
    }
    const expectedPriority = fields.priorityLevel.trim();
    if (expectedPriority === PARTNER_PRIMARY_FORM_VALUE) {
      if (!saved.isPrimaryPartner) {
        logPartnerActionFailure("update", "primary-not-persisted", {
          partnerId,
        });
        return { error: "failed", ok: false };
      }
    } else if (
      saved.isPrimaryPartner ||
      (expectedPriority && String(saved.priorityLevel ?? "") !== expectedPriority)
    ) {
      logPartnerActionFailure("update", "priority-not-persisted", {
        partnerId,
        expected: expectedPriority,
        actual: saved.priorityLevel,
        isPrimary: saved.isPrimaryPartner,
      });
      return { error: "failed", ok: false };
    }
    refreshPartner(locale, partnerId);
    return { error: null, ok: true };
  } catch (error) {
    logPartnerActionFailure("update", error, { partnerId });
    return { error: "failed", ok: false };
  }
}

export async function activateOpsPartnerAction(
  _prev: OpsPartnerFormState,
  formData: FormData,
): Promise<OpsPartnerFormState> {
  const locale = localeFromForm(formData);
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.manage")) {
    return { error: "forbidden", ok: false };
  }
  const partnerId = String(formData.get("id") ?? "");
  try {
    const result = await activateOpsPartner({
      partnerId,
      opsUserId: actor.id,
    });
    if (!result.ok) {
      logPartnerActionFailure("activate", result.error, { partnerId });
      return { error: result.error, ok: false };
    }
    const saved = await getOpsPartner(partnerId);
    if (!saved || saved.status !== "active") {
      logPartnerActionFailure("activate", "status-not-active", {
        partnerId,
        actual: saved?.status ?? null,
      });
      return { error: "failed", ok: false };
    }
    refreshPartner(locale, partnerId);
    return { error: null, ok: true };
  } catch (error) {
    logPartnerActionFailure("activate", error, { partnerId });
    return { error: "failed", ok: false };
  }
}

export async function deactivateOpsPartnerAction(
  _prev: OpsPartnerFormState,
  formData: FormData,
): Promise<OpsPartnerFormState> {
  const locale = localeFromForm(formData);
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.manage")) {
    return { error: "forbidden", ok: false };
  }
  const partnerId = String(formData.get("id") ?? "");
  try {
    const result = await deactivateOpsPartner({
      partnerId,
      opsUserId: actor.id,
    });
    if (!result.ok) {
      logPartnerActionFailure("deactivate", result.error, { partnerId });
      return { error: result.error, ok: false };
    }
    refreshPartner(locale, partnerId);
    return { error: null, ok: true };
  } catch (error) {
    logPartnerActionFailure("deactivate", error, { partnerId });
    return { error: "failed", ok: false };
  }
}

export async function deleteOpsPartnerAction(
  _prev: OpsPartnerFormState,
  formData: FormData,
): Promise<OpsPartnerFormState> {
  const locale = localeFromForm(formData);
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.manage")) {
    return { error: "forbidden", ok: false };
  }
  const partnerId = String(formData.get("id") ?? "");
  let result: Awaited<ReturnType<typeof deleteOpsPartner>>;
  try {
    result = await deleteOpsPartner({
      partnerId,
      opsUserId: actor.id,
    });
  } catch (error) {
    logPartnerActionFailure("delete", error, { partnerId });
    return { error: "failed", ok: false };
  }
  if (!result.ok) {
    logPartnerActionFailure("delete", result.error, { partnerId });
    return { error: result.error, ok: false };
  }
  revalidatePath(localizedPath(locale, "/ops/partners"));
  redirect(localizedPath(locale, "/ops/partners"));
}
