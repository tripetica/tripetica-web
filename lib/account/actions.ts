"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  requestPasswordReset,
  resendCustomerVerification,
  resetCustomerPassword,
  updateAccountProfile,
  verifyCustomerEmailToken,
  verifyEmailChangeToken,
} from "@/lib/account/auth";
import {
  createCompanyForUser,
  deleteCompanyForUser,
  updateCompanyForUser,
  validateCompanyInput,
} from "@/lib/account/companies";
import { requireVerifiedAccountActor } from "@/lib/account/reservation-access";
import { getAccountActor } from "@/lib/account/session";
import { sanitizeReturnPath } from "@/lib/account/return-url";
import {
  getAccountReservationDetail,
  type AccountReservationDetail,
} from "@/lib/account/reservations";
import { setCustomerReservationStatus } from "@/lib/account/customer-reservation-status";
import {
  abandonReservationEditDraft,
  prepareFreshBookingSession,
  startReservationEditDraft,
} from "@/lib/booking/edit-draft";
import { toE164 } from "@/lib/booking/phone";

function readLocale(formData: FormData): Locale {
  const locale = String(formData.get("locale") ?? "");
  return isLocale(locale) ? locale : "en";
}

function readPhone(formData: FormData) {
  const country = String(formData.get("phoneCountry") ?? "").trim().toUpperCase() || null;
  const national = String(formData.get("phoneNational") ?? "").trim();
  if (!country && !national) {
    return { phone: null as string | null, phoneCountryCode: null as string | null };
  }
  if (!country || !national) {
    return { error: "invalid_phone" as const };
  }
  const e164 = toE164(country, national);
  if (!e164) {
    return { error: "invalid_phone" as const };
  }
  return { phone: e164, phoneCountryCode: country };
}

export type AccountFormState = {
  ok?: boolean;
  error?: string;
  info?: string;
};

export async function accountRegisterAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const locale = readLocale(formData);
  const modal = String(formData.get("modal") ?? "") === "1";
  const phone = readPhone(formData);
  if ("error" in phone) {
    return { error: phone.error };
  }
  const result = await registerCustomer({
    locale,
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: phone.phone,
    phoneCountryCode: phone.phoneCountryCode,
    nationalityCode: String(formData.get("countryCode") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  });
  if (!result.ok) {
    return { error: result.reason };
  }
  if (modal) {
    return { ok: true, info: "registered" };
  }
  redirect(localizedPath(locale, "/account/verify?registered=1"));
}

export async function accountLoginAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const locale = readLocale(formData);
  const modal = String(formData.get("modal") ?? "") === "1";
  const next = sanitizeReturnPath(String(formData.get("next") ?? ""));
  const result = await loginCustomer(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (!result.ok) {
    return { error: result.reason };
  }
  if (modal) {
    return {
      ok: true,
      info: result.emailVerified ? "logged_in" : "unverified",
    };
  }
  if (!result.emailVerified) {
    redirect(localizedPath(locale, "/account/verify"));
  }
  redirect(localizedPath(locale, next && !next.startsWith("/account/login") ? next : "/account"));
}

export async function accountLogoutAction(formData: FormData) {
  const locale = readLocale(formData);
  await logoutCustomer();
  redirect(localizedPath(locale));
}

export async function accountForgotPasswordAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const locale = readLocale(formData);
  await requestPasswordReset(String(formData.get("email") ?? ""), locale);
  return { ok: true, info: "reset_sent" };
}

export async function accountResetPasswordAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const locale = readLocale(formData);
  const result = await resetCustomerPassword({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  });
  if (!result.ok) {
    return { error: result.reason };
  }
  redirect(localizedPath(locale, "/account"));
}

export async function accountResendVerificationFormAction(formData: FormData) {
  const locale = readLocale(formData);
  const result = await resendCustomerVerification(locale);
  if (!result.ok) {
    redirect(
      localizedPath(
        locale,
        `/account/verify?mail_error=${encodeURIComponent(result.reason)}`,
      ),
    );
  }
  redirect(localizedPath(locale, "/account/verify?resent=1"));
}

export async function accountVerifyTokenFormAction(formData: FormData) {
  const locale = readLocale(formData);
  const token = String(formData.get("token") ?? "");
  const purpose = String(formData.get("purpose") ?? "");
  const result =
    purpose === "email_change"
      ? await verifyEmailChangeToken(token)
      : await verifyCustomerEmailToken(token);
  if (result.ok) {
    redirect(localizedPath(locale, "/account"));
  }
  const reason = result.reason === "expired" ? "expired" : "invalid";
  redirect(localizedPath(locale, `/account/verify?result=${reason}`));
}

export async function accountProfileAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const locale = readLocale(formData);
  const phone = readPhone(formData);
  if ("error" in phone) {
    return { error: phone.error };
  }
  const result = await updateAccountProfile({
    locale,
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: phone.phone,
    phoneCountryCode: phone.phoneCountryCode,
    nationalityCode: String(formData.get("countryCode") ?? ""),
  });
  if (!result.ok) {
    return { error: result.reason };
  }
  return {
    ok: true,
    info: result.emailChangePending ? "email_pending" : "saved",
  };
}

export async function accountCompanySaveAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const locale = readLocale(formData);
  const actor = await getAccountActor();
  if (!actor) {
    redirect(localizedPath(locale, "/account/login"));
  }
  const companyId = String(formData.get("companyId") ?? "").trim();
  const validated = validateCompanyInput({
    companyName: String(formData.get("companyName") ?? ""),
    countryCode: String(formData.get("countryCode") ?? ""),
    addressLine: String(formData.get("addressLine") ?? ""),
    city: String(formData.get("city") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    taxOffice: String(formData.get("taxOffice") ?? ""),
    invoiceEmail: String(formData.get("invoiceEmail") ?? ""),
    phone: String(formData.get("companyPhone") ?? ""),
  });
  if (!validated.ok) {
    return { error: validated.reason };
  }
  const makeDefault = String(formData.get("isDefault") ?? "") === "1";
  if (companyId) {
    const updated = await updateCompanyForUser(
      actor.id,
      companyId,
      validated.value,
      makeDefault,
    );
    if (!updated.ok) {
      return { error: updated.reason };
    }
  } else {
    await createCompanyForUser(actor.id, validated.value, makeDefault);
  }
  redirect(localizedPath(locale, "/account/companies"));
}

export async function accountCompanyDeleteAction(formData: FormData) {
  const locale = readLocale(formData);
  const actor = await getAccountActor();
  if (!actor) {
    redirect(localizedPath(locale, "/account/login"));
  }
  const companyId = String(formData.get("companyId") ?? "");
  await deleteCompanyForUser(actor.id, companyId);
  redirect(localizedPath(locale, "/account/companies"));
}

export type AccountReservationDetailResult =
  | { ok: true; detail: AccountReservationDetail }
  | { ok: false; error: "unauthenticated" | "not_found" };

export async function accountReservationDetailAction(
  reservationId: string,
  localeRaw: string,
): Promise<AccountReservationDetailResult> {
  const locale = isLocale(localeRaw) ? localeRaw : "en";
  const access = await requireVerifiedAccountActor();
  if (!access.ok) {
    return { ok: false, error: "unauthenticated" };
  }
  const detail = await getAccountReservationDetail({
    userId: access.actor.id,
    reservationId,
    locale,
  });
  if (!detail) {
    return { ok: false, error: "not_found" };
  }
  return { ok: true, detail };
}

export type AccountReservationStatusResult =
  | { ok: true; detail: AccountReservationDetail }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "not_found"
        | "within_six_hours"
        | "bosphorus_after_cutoff"
        | "refund_failed"
        | "pending_cancel_failed"
        | "failed";
    };

export async function accountReservationSetStatusAction(
  reservationId: string,
  nextStatus: "confirmed" | "cancelled",
  localeRaw: string,
): Promise<AccountReservationStatusResult> {
  const locale = isLocale(localeRaw) ? localeRaw : "en";
  const access = await requireVerifiedAccountActor();
  if (!access.ok) {
    return { ok: false, error: "unauthenticated" };
  }
  const result = await setCustomerReservationStatus({
    userId: access.actor.id,
    reservationId,
    nextStatus,
  });
  if (!result.ok && result.reason !== "unchanged") {
    if (result.reason === "not-found") {
      return { ok: false, error: "not_found" };
    }
    if (
      result.reason === "within_six_hours" ||
      result.reason === "bosphorus_after_cutoff" ||
      result.reason === "refund_failed" ||
      result.reason === "pending_cancel_failed"
    ) {
      return { ok: false, error: result.reason };
    }
    return { ok: false, error: "failed" };
  }

  revalidatePath(localizedPath(locale, "/account/reservations"));
  revalidatePath(localizedPath(locale, "/ops/reservations"));

  const detail = await getAccountReservationDetail({
    userId: access.actor.id,
    reservationId,
    locale,
  });
  if (!detail) {
    return { ok: false, error: "not_found" };
  }
  return { ok: true, detail };
}

export type AccountStartReservationEditResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "not_found"
        | "within_six_hours"
        | "cancelled"
        | "failed";
    };

export async function accountStartReservationEditAction(
  reservationId: string,
  localeRaw: string,
): Promise<AccountStartReservationEditResult> {
  const locale = isLocale(localeRaw) ? localeRaw : "en";
  const access = await requireVerifiedAccountActor();
  if (!access.ok) {
    return { ok: false, error: "unauthenticated" };
  }
  const result = await startReservationEditDraft({
    userId: access.actor.id,
    reservationId,
    locale,
  });
  if (!result.ok) {
    return { ok: false, error: result.reason };
  }
  revalidatePath(localizedPath(locale, "/"));
  revalidatePath(localizedPath(locale, "/booking"));
  return { ok: true };
}

export async function accountAbandonReservationEditAction(
  localeRaw: string,
): Promise<
  | { ok: true; opsEdit: boolean; reservationId: string | null }
  | { ok: false; error: "failed" }
> {
  const locale = isLocale(localeRaw) ? localeRaw : "en";
  try {
    const abandoned = await abandonReservationEditDraft();
    revalidatePath(localizedPath(locale, "/"));
    revalidatePath(localizedPath(locale, "/booking"));
    if (abandoned.opsEdit && abandoned.reservationId) {
      revalidatePath(
        localizedPath(locale, `/ops/reservations/${abandoned.reservationId}`),
      );
      revalidatePath(localizedPath(locale, "/ops/reservations"));
    }
    return {
      ok: true,
      opsEdit: abandoned.opsEdit,
      reservationId: abandoned.reservationId,
    };
  } catch (error) {
    console.error("[account] abandon reservation edit failed", error);
    return { ok: false, error: "failed" };
  }
}

/** Clear leftover drafts and open a fresh booking on the homepage. */
export async function accountStartNewBookingAction(formData: FormData) {
  const locale = readLocale(formData);
  const actor = await getAccountActor();
  if (!actor) {
    redirect(localizedPath(locale, "/account/login"));
  }
  try {
    await prepareFreshBookingSession();
  } catch (error) {
    console.error("[account] start new booking failed", error);
  }
  revalidatePath(localizedPath(locale, "/"));
  revalidatePath(localizedPath(locale, "/booking"));
  redirect(localizedPath(locale, "/"));
}
