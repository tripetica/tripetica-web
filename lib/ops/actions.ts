"use server";

import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { loginOpsUser, logoutOpsUser } from "@/lib/ops/auth";
import {
  actorCan,
  getOpsActor,
} from "@/lib/ops/session";
import { canDeleteOpsReservations, canEditOpsRecords, isOpsRole, normalizePermissionKeys } from "@/lib/ops/permissions";
import { opsCopy } from "@/lib/ops/copy";
import { parseProcessListFilters, uniqueUuids, isUuid } from "@/lib/ops/process-filters";
import {
  toProcessRecordDetail,
  toReservationRecordDetail,
  type OpsRecordDetail,
} from "@/lib/ops/record-detail";
import {
  deleteProcesses,
  getProcess,
  previewProcessDelete,
  type ProcessDeleteTarget,
} from "@/lib/ops/processes";
import { getReservation } from "@/lib/ops/reservations";
import { softDeleteReservation } from "@/lib/ops/reservation-delete";
import { setReservationOpsStatus } from "@/lib/ops/reservation-status";
import { requestOpsTurinvoiceRefund, requestOpsPaymentTransactionRefund } from "@/lib/ops/reservation-refund";
import { requestOpsPaymentTransactionCancel } from "@/lib/ops/reservation-payment-cancel";
import {
  processToEditForm,
  reservationToEditForm,
  updateProcessRecord,
  updateReservationRecord,
  type OpsRecordEditInput,
} from "@/lib/ops/record-edit";
import { isOpsPasswordLengthValid } from "@/lib/ops/password-policy";
import { createOpsEmployee, updateOpsUser } from "@/lib/ops/users";
import { revalidatePath } from "next/cache";

export type OpsLoginState = {
  error: "invalid" | "throttled" | null;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

export async function opsLoginAction(
  _prev: OpsLoginState,
  formData: FormData,
): Promise<OpsLoginState> {
  const locale = localeFromForm(formData);
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await loginOpsUser(email, password);
  if (!result.ok) {
    return { error: result.reason === "throttled" ? "throttled" : "invalid" };
  }
  redirect(localizedPath(locale, "/ops/reservations"));
}

export async function opsLogoutAction(formData: FormData) {
  const locale = localeFromForm(formData);
  await logoutOpsUser();
  redirect(localizedPath(locale, "/ops/login"));
}

export type OpsUserFormState = {
  error: "email" | "last-owner" | "forbidden" | "invalid" | "failed" | null;
  ok: boolean;
};

function readPermissions(formData: FormData) {
  return normalizePermissionKeys(
    formData.getAll("permission").map((value) => String(value)),
  );
}

export async function createOpsUserAction(
  _prev: OpsUserFormState,
  formData: FormData,
): Promise<OpsUserFormState> {
  const locale = localeFromForm(formData);
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "users.manage")) {
    return { error: "forbidden", ok: false };
  }
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "employee");
  if (!firstName || !lastName || !email || !isOpsPasswordLengthValid(password) || !isOpsRole(roleRaw)) {
    return { error: "invalid", ok: false };
  }
  const result = await createOpsEmployee({
    actorId: actor.id,
    firstName,
    lastName,
    email,
    password,
    role: roleRaw,
    isActive: formData.get("isActive") === "true",
    permissions: readPermissions(formData),
  });
  if (!result.ok) {
    return {
      error:
        result.reason === "email"
          ? "email"
          : result.reason === "forbidden"
            ? "forbidden"
            : "failed",
      ok: false,
    };
  }
  redirect(localizedPath(locale, `/ops/users/${result.id}`));
}

export async function updateOpsUserAction(
  _prev: OpsUserFormState,
  formData: FormData,
): Promise<OpsUserFormState> {
  const locale = localeFromForm(formData);
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "users.manage")) {
    return { error: "forbidden", ok: false };
  }
  const id = String(formData.get("id") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "employee");
  if (!id || !firstName || !lastName || !email || !isOpsRole(roleRaw)) {
    return { error: "invalid", ok: false };
  }
  if (password && !isOpsPasswordLengthValid(password)) {
    return { error: "invalid", ok: false };
  }
  const result = await updateOpsUser(id, {
    actorId: actor.id,
    firstName,
    lastName,
    email,
    password: password || undefined,
    role: roleRaw,
    isActive: formData.get("isActive") === "true",
    permissions: readPermissions(formData),
  });
  if (!result.ok) {
    return {
      error:
        result.reason === "email"
          ? "email"
          : result.reason === "last-owner"
            ? "last-owner"
            : result.reason === "forbidden"
              ? "forbidden"
              : "failed",
      ok: false,
    };
  }
  revalidatePath(localizedPath(locale, "/ops/users"));
  revalidatePath(localizedPath(locale, `/ops/users/${id}`));
  return { error: null, ok: true };
}

export type OpsProcessDeleteState = {
  error: "forbidden" | "invalid" | "failed" | null;
  selected: number;
  deletable: number;
  protectedCount: number;
  deleted: number;
};

type ProcessDeletePayload = {
  locale: string;
  mode: "ids" | "filtered";
  ids?: string[];
  filters: {
    query: string;
    status: string;
    locale: string;
    conversion: string;
    date: string;
    from: string;
    to: string;
  };
};

function readProcessDeleteTarget(input: ProcessDeletePayload): ProcessDeleteTarget | null {
  if (input.mode !== "ids" && input.mode !== "filtered") {
    return null;
  }
  const filters = parseProcessListFilters({
    q: input.filters.query,
    status: input.filters.status,
    locale: input.filters.locale,
    conversion: input.filters.conversion,
    date: input.filters.date,
    from: input.filters.from,
    to: input.filters.to,
  });
  const ids = uniqueUuids(input.ids ?? []).slice(0, 2000);
  if (input.mode === "ids" && ids.length === 0) {
    return { mode: "ids", ids: [], filters };
  }
  return { mode: input.mode, ids, filters };
}

export async function previewProcessDeleteAction(
  input: ProcessDeletePayload,
): Promise<OpsProcessDeleteState> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "processes.delete")) {
    return {
      error: "forbidden",
      selected: 0,
      deletable: 0,
      protectedCount: 0,
      deleted: 0,
    };
  }
  const target = readProcessDeleteTarget(input);
  if (!target) {
    return {
      error: "invalid",
      selected: 0,
      deletable: 0,
      protectedCount: 0,
      deleted: 0,
    };
  }
  const preview = await previewProcessDelete(target);
  return { error: null, deleted: 0, ...preview };
}

export async function deleteProcessesAction(
  input: ProcessDeletePayload,
): Promise<OpsProcessDeleteState> {
  const locale = isLocale(input.locale) ? input.locale : "tr";
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "processes.delete")) {
    return {
      error: "forbidden",
      selected: 0,
      deletable: 0,
      protectedCount: 0,
      deleted: 0,
    };
  }
  const target = readProcessDeleteTarget(input);
  if (!target) {
    return {
      error: "invalid",
      selected: 0,
      deletable: 0,
      protectedCount: 0,
      deleted: 0,
    };
  }
  try {
    const result = await deleteProcesses(target);
    revalidatePath(localizedPath(locale, "/ops/processes"));
    return { error: null, ...result };
  } catch (error) {
    console.error("[ops] deleteProcessesAction failed", error);
    return {
      error: "failed",
      selected: 0,
      deletable: 0,
      protectedCount: 0,
      deleted: 0,
    };
  }
}

export type OpsRecordDetailState = {
  error: "forbidden" | "invalid" | "not-found" | null;
  detail: OpsRecordDetail | null;
  edit: OpsRecordEditInput | null;
  canEdit: boolean;
  canDelete: boolean;
};

export async function getProcessRecordDetailAction(
  id: string,
  localeRaw: string,
): Promise<OpsRecordDetailState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "processes.view")) {
    return { error: "forbidden", detail: null, edit: null, canEdit: false, canDelete: false };
  }
  if (!isUuid(id)) {
    return { error: "invalid", detail: null, edit: null, canEdit: false, canDelete: false };
  }
  const item = await getProcess(id);
  if (!item) {
    return { error: "not-found", detail: null, edit: null, canEdit: false, canDelete: false };
  }
  const canEdit = canEditOpsRecords(actor.role);
  return {
    error: null,
    detail: toProcessRecordDetail(item, locale, opsCopy[locale]),
    edit: canEdit ? processToEditForm(item) : null,
    canEdit,
    canDelete: false,
  };
}

export async function getReservationRecordDetailAction(
  id: string,
  localeRaw: string,
): Promise<OpsRecordDetailState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "reservations.view")) {
    return { error: "forbidden", detail: null, edit: null, canEdit: false, canDelete: false };
  }
  if (!isUuid(id)) {
    return { error: "invalid", detail: null, edit: null, canEdit: false, canDelete: false };
  }
  const item = await getReservation(id);
  if (!item) {
    return { error: "not-found", detail: null, edit: null, canEdit: false, canDelete: false };
  }
  const canEdit = canEditOpsRecords(actor.role);
  const canDelete = canDeleteOpsReservations(actor.role);
  return {
    error: null,
    detail: toReservationRecordDetail(item, locale, opsCopy[locale]),
    edit: canEdit ? reservationToEditForm(item) : null,
    canEdit,
    canDelete,
  };
}

export type OpsRecordSaveState = {
  error: "forbidden" | "invalid" | "not-found" | "validation" | null;
  detail: OpsRecordDetail | null;
  edit: OpsRecordEditInput | null;
  canEdit: boolean;
};

export async function saveProcessRecordAction(
  input: OpsRecordEditInput,
  localeRaw: string,
): Promise<OpsRecordSaveState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !canEditOpsRecords(actor.role)) {
    return { error: "forbidden", detail: null, edit: null, canEdit: false };
  }
  if (!isUuid(input.id) || input.kind !== "process") {
    return { error: "invalid", detail: null, edit: null, canEdit: true };
  }
  const item = await getProcess(input.id);
  if (!item) {
    return { error: "not-found", detail: null, edit: null, canEdit: true };
  }
  const result = await updateProcessRecord(actor.id, item, input);
  if (!result.ok) {
    return { error: "validation", detail: null, edit: input, canEdit: true };
  }
  revalidatePath(localizedPath(locale, "/ops/processes"));
  const refreshed = await getProcess(input.id);
  if (!refreshed) {
    return { error: "not-found", detail: null, edit: null, canEdit: true };
  }
  return {
    error: null,
    detail: toProcessRecordDetail(refreshed, locale, opsCopy[locale]),
    edit: processToEditForm(refreshed),
    canEdit: true,
  };
}

export async function saveReservationRecordAction(
  input: OpsRecordEditInput,
  localeRaw: string,
): Promise<OpsRecordSaveState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !canEditOpsRecords(actor.role)) {
    return { error: "forbidden", detail: null, edit: null, canEdit: false };
  }
  if (!isUuid(input.id) || input.kind !== "reservation") {
    return { error: "invalid", detail: null, edit: null, canEdit: true };
  }
  const item = await getReservation(input.id);
  if (!item) {
    return { error: "not-found", detail: null, edit: null, canEdit: true };
  }
  const result = await updateReservationRecord(actor.id, item, input);
  if (!result.ok) {
    return { error: "validation", detail: null, edit: input, canEdit: true };
  }
  revalidatePath(localizedPath(locale, "/ops/reservations"));
  const refreshed = await getReservation(input.id);
  if (!refreshed) {
    return { error: "not-found", detail: null, edit: null, canEdit: true };
  }
  return {
    error: null,
    detail: toReservationRecordDetail(refreshed, locale, opsCopy[locale]),
    edit: reservationToEditForm(refreshed),
    canEdit: true,
  };
}

export type OpsReservationDeleteState = {
  error: "forbidden" | "invalid" | "not-found" | "failed" | null;
};

export async function deleteReservationRecordAction(
  id: string,
  localeRaw: string,
): Promise<OpsReservationDeleteState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !canDeleteOpsReservations(actor.role)) {
    return { error: "forbidden" };
  }
  if (!isUuid(id)) {
    return { error: "invalid" };
  }
  const item = await getReservation(id);
  if (!item) {
    return { error: "not-found" };
  }
  const result = await softDeleteReservation(actor.id, id);
  if (!result.ok) {
    if (result.reason === "not-found" || result.reason === "already-deleted") {
      return { error: "not-found" };
    }
    return { error: "failed" };
  }
  revalidatePath(localizedPath(locale, "/ops/reservations"));
  return { error: null };
}

export type OpsReservationStatusState = {
  error: "forbidden" | "invalid" | "not-found" | "failed" | null;
  detail: OpsRecordDetail | null;
  edit: OpsRecordEditInput | null;
  canEdit: boolean;
  canDelete: boolean;
};

export async function setReservationStatusAction(
  id: string,
  nextStatus: "confirmed" | "cancelled",
  localeRaw: string,
): Promise<OpsReservationStatusState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !canEditOpsRecords(actor.role)) {
    return {
      error: "forbidden",
      detail: null,
      edit: null,
      canEdit: false,
      canDelete: false,
    };
  }
  if (!isUuid(id) || (nextStatus !== "confirmed" && nextStatus !== "cancelled")) {
    return {
      error: "invalid",
      detail: null,
      edit: null,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }
  const item = await getReservation(id);
  if (!item) {
    return {
      error: "not-found",
      detail: null,
      edit: null,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }
  const result = await setReservationOpsStatus(actor.id, id, nextStatus);
  if (!result.ok && result.reason !== "unchanged") {
    if (result.reason === "not-found" || result.reason === "deleted") {
      return {
        error: "not-found",
        detail: null,
        edit: null,
        canEdit: true,
        canDelete: canDeleteOpsReservations(actor.role),
      };
    }
    return {
      error: "failed",
      detail: null,
      edit: null,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }
  revalidatePath(localizedPath(locale, "/ops/reservations"));
  const refreshed = await getReservation(id);
  if (!refreshed) {
    return {
      error: "not-found",
      detail: null,
      edit: null,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }
  return {
    error: null,
    detail: toReservationRecordDetail(refreshed, locale, opsCopy[locale]),
    edit: reservationToEditForm(refreshed),
    canEdit: true,
    canDelete: canDeleteOpsReservations(actor.role),
  };
}

export type OpsReservationRefundState = {
  error: string | null;
  reason: string | null;
  detail: OpsRecordDetail | null;
  edit: OpsRecordEditInput | null;
  canEdit: boolean;
  canDelete: boolean;
};

export async function requestReservationRefundAction(
  id: string,
  localeRaw: string,
  options: { confirmAdminOverride?: boolean } = {},
): Promise<OpsReservationRefundState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !canEditOpsRecords(actor.role)) {
    return {
      error: "forbidden",
      reason: "forbidden",
      detail: null,
      edit: null,
      canEdit: false,
      canDelete: false,
    };
  }
  if (!isUuid(id)) {
    return {
      error: "invalid",
      reason: "invalid",
      detail: null,
      edit: null,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }

  const result = await requestOpsTurinvoiceRefund(actor.id, id, {
    confirmAdminOverride: options.confirmAdminOverride === true,
  });

  const refreshed = await getReservation(id);
  const detail = refreshed
    ? toReservationRecordDetail(refreshed, locale, opsCopy[locale])
    : null;
  const edit = refreshed ? reservationToEditForm(refreshed) : null;

  if (!result.ok) {
    return {
      error: "failed",
      reason: result.reason,
      detail,
      edit,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }

  revalidatePath(localizedPath(locale, "/ops/reservations"));
  return {
    error: null,
    reason: null,
    detail,
    edit,
    canEdit: true,
    canDelete: canDeleteOpsReservations(actor.role),
  };
}

export async function requestReservationPaymentTxnRefundAction(
  reservationId: string,
  paymentTransactionId: string,
  amount: number,
  localeRaw: string,
): Promise<OpsReservationRefundState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !canEditOpsRecords(actor.role)) {
    return {
      error: "forbidden",
      reason: "forbidden",
      detail: null,
      edit: null,
      canEdit: false,
      canDelete: false,
    };
  }
  if (!isUuid(reservationId) || !isUuid(paymentTransactionId)) {
    return {
      error: "invalid",
      reason: "invalid",
      detail: null,
      edit: null,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }

  const result = await requestOpsPaymentTransactionRefund(
    actor.id,
    reservationId,
    paymentTransactionId,
    amount,
  );

  const refreshed = await getReservation(reservationId);
  const detail = refreshed
    ? toReservationRecordDetail(refreshed, locale, opsCopy[locale])
    : null;
  const edit = refreshed ? reservationToEditForm(refreshed) : null;

  if (!result.ok) {
    return {
      error: "failed",
      reason: result.reason,
      detail,
      edit,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }

  revalidatePath(localizedPath(locale, "/ops/reservations"));
  return {
    error: null,
    reason: null,
    detail,
    edit,
    canEdit: true,
    canDelete: canDeleteOpsReservations(actor.role),
  };
}

export async function requestReservationPaymentTxnCancelAction(
  reservationId: string,
  paymentTransactionId: string,
  localeRaw: string,
): Promise<OpsReservationRefundState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !canEditOpsRecords(actor.role)) {
    return {
      error: "forbidden",
      reason: "forbidden",
      detail: null,
      edit: null,
      canEdit: false,
      canDelete: false,
    };
  }
  if (!isUuid(reservationId) || !isUuid(paymentTransactionId)) {
    return {
      error: "invalid",
      reason: "invalid",
      detail: null,
      edit: null,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }

  const result = await requestOpsPaymentTransactionCancel(
    actor.id,
    reservationId,
    paymentTransactionId,
  );

  const refreshed = await getReservation(reservationId);
  const detail = refreshed
    ? toReservationRecordDetail(refreshed, locale, opsCopy[locale])
    : null;
  const edit = refreshed ? reservationToEditForm(refreshed) : null;

  if (!result.ok) {
    return {
      error: "failed",
      reason: result.reason,
      detail,
      edit,
      canEdit: true,
      canDelete: canDeleteOpsReservations(actor.role),
    };
  }

  revalidatePath(localizedPath(locale, "/ops/reservations"));
  return {
    error: null,
    reason: null,
    detail,
    edit,
    canEdit: true,
    canDelete: canDeleteOpsReservations(actor.role),
  };
}

export type OpsStartReservationEditState =
  | { ok: true; reservationCode: string }
  | {
      ok: false;
      error: "forbidden" | "invalid" | "not_found" | "cancelled" | "failed";
    };

/** Start ops edit session → customer booking funnel (not manual field form). */
export async function opsStartReservationEditAction(
  reservationIdRaw: string,
  localeRaw: string,
): Promise<OpsStartReservationEditState> {
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const actor = await getOpsActor();
  if (!actor || !canEditOpsRecords(actor.role)) {
    return { ok: false, error: "forbidden" };
  }
  if (!isUuid(reservationIdRaw)) {
    return { ok: false, error: "invalid" };
  }

  const { startOpsReservationEditDraft } = await import(
    "@/lib/booking/edit-draft"
  );
  const result = await startOpsReservationEditDraft({
    opsUserId: actor.id,
    reservationId: reservationIdRaw,
    locale,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "cancelled"
          ? "cancelled"
          : result.reason === "not_found"
            ? "not_found"
            : "failed",
    };
  }

  revalidatePath(localizedPath(locale, "/"));
  revalidatePath(localizedPath(locale, "/booking"));
  return { ok: true, reservationCode: result.reservationCode };
}
