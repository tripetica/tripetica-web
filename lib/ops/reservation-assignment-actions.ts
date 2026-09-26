"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { type OpsAssignmentError } from "@/lib/ops/reservation-assignment-view";
import {
  assignOpsReservationDriver,
  assignOpsReservationPartner,
  assignOpsReservationVehicle,
  clearOpsReservationDriver,
  clearOpsReservationPartner,
  clearOpsReservationVehicle,
} from "@/lib/ops/reservation-assignment";

export type OpsAssignmentFormState = {
  error: OpsAssignmentError | null;
  ok: boolean;
  reservationId: string;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

function languageCodesFromForm(formData: FormData) {
  return String(formData.get("languages") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function refreshAssignment(locale: Locale, reservationId: string, partnerIds: string[]) {
  revalidatePath(localizedPath(locale, "/ops/reservations"));
  revalidatePath(localizedPath(locale, `/ops/reservations/${reservationId}`));
  revalidatePath(localizedPath(locale, "/partner/jobs"));
  revalidatePath(localizedPath(locale, "/partner/accepted"));
  revalidatePath(localizedPath(locale, `/partner/accepted/${reservationId}`));
  revalidatePath(localizedPath(locale, `/partner/jobs/${reservationId}`));
  for (const partnerId of partnerIds) {
    if (partnerId) {
      revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
    }
  }
}

async function requireOpsAssign(): Promise<
  { ok: true } | { ok: false; error: OpsAssignmentError }
> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "reservations.manage")) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true };
}

export async function opsAssignReservationPartnerAction(
  _prev: OpsAssignmentFormState,
  formData: FormData,
): Promise<OpsAssignmentFormState> {
  const locale = localeFromForm(formData);
  const reservationId = String(formData.get("id") ?? "");
  const auth = await requireOpsAssign();
  if (!auth.ok) {
    return { error: auth.error, ok: false, reservationId };
  }
  const partnerId = String(formData.get("partnerId") ?? "");
  try {
    const result = await assignOpsReservationPartner({ reservationId, partnerId });
    if (!result.ok) {
      return { error: result.error, ok: false, reservationId };
    }
    refreshAssignment(locale, reservationId, [
      result.previousPartnerId ?? "",
      result.partnerId,
    ]);
    return { error: null, ok: true, reservationId };
  } catch {
    return { error: "failed", ok: false, reservationId };
  }
}

export async function opsClearReservationPartnerAction(
  _prev: OpsAssignmentFormState,
  formData: FormData,
): Promise<OpsAssignmentFormState> {
  const locale = localeFromForm(formData);
  const reservationId = String(formData.get("id") ?? "");
  const auth = await requireOpsAssign();
  if (!auth.ok) {
    return { error: auth.error, ok: false, reservationId };
  }
  const previousPartnerId = String(formData.get("partnerId") ?? "");
  try {
    const result = await clearOpsReservationPartner({ reservationId });
    if (!result.ok) {
      return { error: result.error, ok: false, reservationId };
    }
    refreshAssignment(locale, reservationId, [previousPartnerId]);
    return { error: null, ok: true, reservationId };
  } catch {
    return { error: "failed", ok: false, reservationId };
  }
}

export async function opsAssignReservationDriverAction(
  _prev: OpsAssignmentFormState,
  formData: FormData,
): Promise<OpsAssignmentFormState> {
  const locale = localeFromForm(formData);
  const reservationId = String(formData.get("id") ?? "");
  const auth = await requireOpsAssign();
  if (!auth.ok) {
    return { error: auth.error, ok: false, reservationId };
  }
  const partnerId = String(formData.get("partnerId") ?? "");
  try {
    const result = await assignOpsReservationDriver({
      reservationId,
      selection: String(formData.get("selection") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
      existingFirst: String(formData.get("existingFirst") ?? ""),
      existingLast: String(formData.get("existingLast") ?? ""),
      phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
      phoneNational: String(formData.get("phoneNational") ?? ""),
      languageCodes: languageCodesFromForm(formData),
      notes: String(formData.get("notes") ?? ""),
    });
    if (!result.ok) {
      return { error: result.error, ok: false, reservationId };
    }
    refreshAssignment(locale, reservationId, [partnerId]);
    return { error: null, ok: true, reservationId };
  } catch {
    return { error: "failed", ok: false, reservationId };
  }
}

export async function opsAssignReservationVehicleAction(
  _prev: OpsAssignmentFormState,
  formData: FormData,
): Promise<OpsAssignmentFormState> {
  const locale = localeFromForm(formData);
  const reservationId = String(formData.get("id") ?? "");
  const auth = await requireOpsAssign();
  if (!auth.ok) {
    return { error: auth.error, ok: false, reservationId };
  }
  const partnerId = String(formData.get("partnerId") ?? "");
  try {
    const result = await assignOpsReservationVehicle({
      reservationId,
      selection: String(formData.get("selection") ?? ""),
      plate: String(formData.get("plate") ?? ""),
      brandModel: String(formData.get("brandModel") ?? ""),
      features: String(formData.get("features") ?? ""),
    });
    if (!result.ok) {
      return { error: result.error, ok: false, reservationId };
    }
    refreshAssignment(locale, reservationId, [partnerId]);
    return { error: null, ok: true, reservationId };
  } catch {
    return { error: "failed", ok: false, reservationId };
  }
}

export async function opsClearReservationDriverAction(
  _prev: OpsAssignmentFormState,
  formData: FormData,
): Promise<OpsAssignmentFormState> {
  const locale = localeFromForm(formData);
  const reservationId = String(formData.get("id") ?? "");
  const auth = await requireOpsAssign();
  if (!auth.ok) {
    return { error: auth.error, ok: false, reservationId };
  }
  const partnerId = String(formData.get("partnerId") ?? "");
  try {
    const result = await clearOpsReservationDriver({ reservationId });
    if (!result.ok) {
      return { error: result.error, ok: false, reservationId };
    }
    refreshAssignment(locale, reservationId, [partnerId]);
    return { error: null, ok: true, reservationId };
  } catch {
    return { error: "failed", ok: false, reservationId };
  }
}

export async function opsClearReservationVehicleAction(
  _prev: OpsAssignmentFormState,
  formData: FormData,
): Promise<OpsAssignmentFormState> {
  const locale = localeFromForm(formData);
  const reservationId = String(formData.get("id") ?? "");
  const auth = await requireOpsAssign();
  if (!auth.ok) {
    return { error: auth.error, ok: false, reservationId };
  }
  const partnerId = String(formData.get("partnerId") ?? "");
  try {
    const result = await clearOpsReservationVehicle({ reservationId });
    if (!result.ok) {
      return { error: result.error, ok: false, reservationId };
    }
    refreshAssignment(locale, reservationId, [partnerId]);
    return { error: null, ok: true, reservationId };
  } catch {
    return { error: "failed", ok: false, reservationId };
  }
}
