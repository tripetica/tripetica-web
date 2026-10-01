"use server";

import { deleteCancelledUetdsNotifications, isUetdsCancellationConfirmed, type UetdsDeleteResult } from "@/lib/uetds/delete-notifications";
import { retryUetdsFinalVerification } from "@/lib/uetds/retry-verification";
import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { isUuid } from "@/lib/ops/process-filters";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { getPartnerActor } from "@/lib/partner/session";
import { extractAiUetdsDocument } from "@/lib/uetds/ai-extraction";
import { AiExtractionError, type AiExtractionErrorCode, type AiUetdsExtractedDraft } from "@/lib/uetds/ai-extraction-schema";
import { type UetdsFleetScope } from "@/lib/uetds/fleet-options";
import { persistAiEditTarget } from "@/lib/uetds/ai-edit-target-store";
import { saveUetdsFormDraft } from "@/lib/uetds/form-drafts";
import { cancelUetdsNotification, updateUetdsNotification, type UetdsManageError } from "@/lib/uetds/manage";
import { submitUetdsNotification, type UetdsSubmitError } from "@/lib/uetds/submit";
import { type UetdsTripTimeAdjustment } from "@/lib/uetds/trip-time";

export type UetdsExtractActionResult = {
  ok: boolean;
  extracted: AiUetdsExtractedDraft | null;
  imageOnly: boolean;
  error: AiExtractionErrorCode | null;
};

export type UetdsManageFormState = {
  ok: boolean;
  error: UetdsManageError | null;
  message: string | null;
  status?: string | null;
  warning?: UetdsManageError | null;
  cancellationVerified?: boolean;
};

export type UetdsSubmitFormState = {
  ok: boolean;
  error: UetdsSubmitError | null;
  id: string | null;
  ministryMessage?: string | null;
  seferReferansNo?: string | null;
  ministryStatus?: "submitted" | "partial" | "failed" | null;
  finalVerificationResult?: "verified" | "final-verification-failed" | null;
  timeAdjustment?: UetdsTripTimeAdjustment | null;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

function scopeFromForm(formData: FormData): UetdsFleetScope {
  return formData.get("actor") === "ops" ? "ops" : "partner";
}

async function requireActor(scope: UetdsFleetScope, permission: "uetds.view" | "uetds.manage") {
  if (scope === "ops") {
    const actor = await getOpsActor();
    if (!actor || !actorCan(actor, permission)) {
      return null;
    }
    return { type: "ops" as const, userId: actor.id, partnerId: null };
  }
  const actor = await getPartnerActor();
  if (!actor || actor.mustChangePassword) {
    return null;
  }
  return { type: "partner" as const, userId: actor.userId, partnerId: actor.partnerId };
}

export async function extractUetdsDocumentAction(formData: FormData): Promise<UetdsExtractActionResult> {
  try {
    if (!(formData instanceof FormData) || !["ops", "partner"].includes(String(formData.get("actor")))) {
      return { ok: false, extracted: null, imageOnly: false, error: "invalid" };
    }
    const actor = await requireActor(scopeFromForm(formData), "uetds.view");
    if (!actor) return { ok: false, extracted: null, imageOnly: false, error: "invalid" };
    const extracted = await extractAiUetdsDocument(
      { text: formData.get("text") ?? "", files: formData.getAll("files") },
      `${actor.type}:${actor.userId}`,
    );
    return { ok: true, extracted, imageOnly: false, error: null };
  } catch (error) {
    return { ok: false, extracted: null, imageOnly: false, error: error instanceof AiExtractionError ? error.code : "failed" };
  }
}

export async function persistAiEditTargetAction(formData: FormData) {
  const actor = await requireActor(scopeFromForm(formData), "uetds.manage");
  if (!actor) return { ok: false as const, error: "forbidden" as const };
  let draft: unknown = null;
  try {
    draft = JSON.parse(String(formData.get("draft") ?? ""));
  } catch {
    return { ok: false as const, error: "invalid" as const };
  }
  const saved = await persistAiEditTarget({
    actorType: actor.type,
    partnerId: actor.partnerId,
    notificationId: String(formData.get("id") ?? ""),
    draft,
  });
  if (!saved.ok) return saved;
  const locale = localeFromForm(formData);
  revalidatePath(localizedPath(locale, `/${actor.type}/uetds/notifications/${String(formData.get("id") ?? "")}`));
  revalidatePath(localizedPath(locale, actor.type === "ops" ? `/ops/uetds/notifications/${String(formData.get("id") ?? "")}/edit` : `/partner/uetds/notifications/${String(formData.get("id") ?? "")}/edit`));
  return saved;
}

export async function saveUetdsFormDraftAction(formData: FormData) {
  const scope = scopeFromForm(formData);
  const actor = await requireActor(scope, "uetds.view");
  if (!actor) {
    return { ok: false as const, error: "forbidden" as const };
  }
  let draft: unknown = null;
  try {
    draft = JSON.parse(String(formData.get("draft") ?? ""));
  } catch {
    return { ok: false as const, error: "invalid" as const };
  }
  return saveUetdsFormDraft({
    actor: {
      type: actor.type,
      userId: actor.userId,
      partnerId: actor.partnerId,
    },
    draft,
  });
}

export async function submitUetdsNotificationAction(
  _prev: UetdsSubmitFormState,
  formData: FormData,
): Promise<UetdsSubmitFormState> {
  const locale = localeFromForm(formData);
  const scope = scopeFromForm(formData);
  const actor = await requireActor(scope, "uetds.manage");
  if (!actor) {
    return { ok: false, error: "forbidden", id: null, ministryMessage: null, seferReferansNo: null, ministryStatus: null, timeAdjustment: null };
  }
  // A repeated submit after a stored attempt must never create another sefer.
  if (_prev.id) {
    const retry = await retryUetdsFinalVerification({ notificationId: _prev.id, actorType: actor.type, partnerId: actor.partnerId });
    if (retry.ok) {
      revalidatePath(localizedPath(locale, `/${actor.type}/uetds/notifications`));
      return { ok: true, error: null, id: retry.id, seferReferansNo: retry.seferReference,
        ministryStatus: retry.status === "submitted" ? "submitted" : "partial", finalVerificationResult: retry.verification.result };
    }
    return { ok: true, error: null, id: _prev.id, ministryStatus: "partial", finalVerificationResult: "final-verification-failed" };
  }
  let draft: unknown = null;
  try {
    draft = JSON.parse(String(formData.get("draft") ?? ""));
  } catch {
    return { ok: false, error: "invalid", id: null, ministryMessage: null, seferReferansNo: null, ministryStatus: null, timeAdjustment: null };
  }
  const result = await submitUetdsNotification({
    actorType: actor.type,
    actorUserId: actor.userId,
    partnerId: actor.partnerId,
    draft,
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      id: null,
      ministryMessage: result.ministryMessage ?? null,
      seferReferansNo: null,
      ministryStatus: null,
      timeAdjustment: result.timeAdjustment ?? null,
    };
  }
  revalidatePath(localizedPath(locale, actor.type === "ops" ? "/ops/uetds/notifications" : "/partner/uetds/notifications"));
  revalidatePath(localizedPath(locale, actor.type === "ops" ? "/ops/reservations" : "/partner/accepted"));
  const reservationId =
    draft && typeof draft === "object" && "reservationId" in draft
      ? String((draft as { reservationId?: unknown }).reservationId ?? "")
      : "";
  if (isUuid(reservationId)) {
    revalidatePath(localizedPath(locale, `/ops/reservations/${reservationId}`));
    revalidatePath(localizedPath(locale, `/partner/accepted/${reservationId}`));
  }
  return {
    ok: true,
    error: null,
    id: result.id,
    ministryMessage: result.ministry.message,
    seferReferansNo: result.ministry.seferReferansNo,
    ministryStatus: result.ministry.status,
    finalVerificationResult: result.ministry.finalVerification?.result ?? null,
    timeAdjustment: result.timeAdjustment,
  };
}

export async function cancelUetdsNotificationAction(
  _prev: UetdsManageFormState,
  formData: FormData,
): Promise<UetdsManageFormState> {
  const locale = localeFromForm(formData);
  const scope = scopeFromForm(formData);
  const actor = await requireActor(scope, "uetds.manage");
  if (!actor) {
    return { ok: false, error: "forbidden", message: null };
  }
  const result = await cancelUetdsNotification({
    actorType: actor.type,
    actorUserId: actor.userId,
    partnerId: actor.partnerId,
    notificationId: String(formData.get("id") ?? ""),
    reason: String(formData.get("reason") ?? "İptal"),
  });
  revalidatePath(localizedPath(locale, actor.type === "ops" ? "/ops/uetds/notifications" : "/partner/uetds/notifications"));
  if (!result.ok) {
    return { ok: false, error: result.error, message: result.ministryMessage ?? result.error };
  }
  revalidatePath(localizedPath(locale, `/${actor.type}/uetds/notifications/${String(formData.get("id") ?? "")}`));
  const cancellationVerified = await isUetdsCancellationConfirmed(String(formData.get("id") ?? ""), { actorType: actor.type, partnerId: actor.partnerId });
  return { ok: true, error: null, message: "cancelled", status: "cancelled", cancellationVerified };
}

export async function updateUetdsNotificationAction(
  _prev: UetdsManageFormState,
  formData: FormData,
): Promise<UetdsManageFormState> {
  const locale = localeFromForm(formData);
  const scope = scopeFromForm(formData);
  const actor = await requireActor(scope, "uetds.manage");
  if (!actor) {
    return { ok: false, error: "forbidden", message: null };
  }
  let draft: unknown = null;
  try {
    draft = JSON.parse(String(formData.get("draft") ?? ""));
  } catch {
    return { ok: false, error: "invalid", message: null };
  }
  const result = await updateUetdsNotification({
    actorType: actor.type,
    actorUserId: actor.userId,
    partnerId: actor.partnerId,
    notificationId: String(formData.get("id") ?? ""),
    draft,
  });
  revalidatePath(localizedPath(locale, actor.type === "ops" ? "/ops/uetds/notifications" : "/partner/uetds/notifications"));
  revalidatePath(localizedPath(locale, actor.type === "ops" ? "/ops/reservations" : "/partner/accepted"));
  if (!result.ok) {
    return { ok: false, error: result.error, message: result.ministryMessage ?? result.error };
  }
  return {
    ok: true,
    error: null,
    message: result.ministryMessage ?? result.warning ?? result.status,
    status: result.status,
    warning: result.warning ?? null,
  };
}

export async function retryUetdsFinalVerificationAction(
  _prev: { ok: boolean; verified: boolean }, formData: FormData,
): Promise<{ ok: boolean; verified: boolean }> {
  const actor = await requireActor(scopeFromForm(formData), "uetds.manage");
  if (!actor) return { ok: false, verified: false };
  const result = await retryUetdsFinalVerification({
    notificationId: String(formData.get("id") ?? ""), actorType: actor.type, partnerId: actor.partnerId,
  });
  if (!result.ok) return { ok: false, verified: false };
  const locale = localeFromForm(formData);
  revalidatePath(localizedPath(locale, `/${actor.type}/uetds/notifications`));
  revalidatePath(localizedPath(locale, `/${actor.type}/uetds/notifications/${result.id}`));
  return { ok: true, verified: result.verification.result === "verified" };
}

export async function deleteCancelledUetdsNotificationsAction(
  _prev: { results: UetdsDeleteResult[]; attempted: boolean }, formData: FormData,
): Promise<{ results: UetdsDeleteResult[]; attempted: boolean }> {
  const actor = await requireActor(scopeFromForm(formData), "uetds.manage");
  const ids = [...new Set(formData.getAll("ids").map(String))].slice(0, 100);
  if (!actor) return { results: ids.map(id => ({ id, reason: "unavailable" })), attempted: true };
  const results = await deleteCancelledUetdsNotifications(ids, { actorType: actor.type, partnerId: actor.partnerId });
  const locale = localeFromForm(formData);
  const listHref = localizedPath(locale, `/${actor.type}/uetds/notifications`);
  revalidatePath(listHref);
  if (formData.get("returnToList") === "1" && ids.length === 1 &&
    results.some(result => result.id === ids[0] && result.reason === "deleted")) {
    // Leave the deleted detail route before it can be rendered again.
    redirect(`${listHref}?deleted=1`, RedirectType.replace);
  }
  for (const result of results) if (result.reason === "deleted") revalidatePath(localizedPath(locale, `/${actor.type}/uetds/notifications/${result.id}`));
  return { results, attempted: true };
}
