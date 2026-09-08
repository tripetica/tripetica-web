"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { loginPartnerUser, logoutPartnerUser } from "@/lib/partner/auth";
import { changePartnerPassword } from "@/lib/partner/password-change";
import { partnerContactNamesFromForm } from "@/lib/partner/contact-name";
import {
  consumeVerifiedPartnerEmailChallenge,
  invalidateCurrentPartnerEmailChallenge,
  issuePartnerEmailChallenge,
  notifyPartnerPasswordChanged,
  notifyPreviousPartnerEmail,
  verifyPartnerEmailChallenge,
} from "@/lib/partner/email-verification";
import { normalizePartnerEmail } from "@/lib/partner/email";
import {
  applyVerifiedPartnerLoginEmail,
  partnerLoginEmailTaken,
  updatePartnerSelfProfile,
} from "@/lib/partner/profile";
import { createPartnerApplication } from "@/lib/partner/register";
import { createPartnerSession, getPartnerActor, writePartnerSessionCookie } from "@/lib/partner/session";
import { safePartnerReturnPath } from "@/lib/partner/push/return-path";
import { scheduleOpsPush } from "@/lib/ops/push/schedule";
import { notifyOpsPartnerApplicationCreated } from "@/lib/ops/push/notify-partner-application";
import { requestClientIp } from "@/lib/security/request-client-ip";
import { query } from "@/lib/db/postgres";
import { verifyPassword } from "@/lib/security/password";

export type PartnerLoginState = {
  error: "invalid" | "throttled" | "pending" | "inactive" | null;
};

export type PartnerPasswordState = {
  error: "short" | "mismatch" | "same-as-old" | "current-invalid" | "failed" | null;
  ok: boolean;
};

export type PartnerRegisterState = {
  error:
    | "invalid-email"
    | "invalid-phone"
    | "invalid-name"
    | "invalid-contact"
    | "invalid-business-type"
    | "invalid-address"
    | "invalid-country"
    | "invalid-tax-office"
    | "invalid-tax-number"
    | "invalid-national-id"
    | "password-short"
    | "password-mismatch"
    | "duplicate"
    | "unverified-email"
    | "failed"
    | null;
  ok: boolean;
};

export type PartnerEmailCodeState = {
  error:
    | "invalid-email"
    | "invalid"
    | "expired"
    | "used"
    | "locked"
    | "email-mismatch"
    | "throttled"
    | "mail-failed"
    | "duplicate"
    | "current-invalid"
    | "mismatch"
    | "same-email"
    | "failed"
    | null;
  ok: boolean;
  sent?: boolean;
  verified?: boolean;
};

export type PartnerProfileState = {
  error:
    | "invalid-contact"
    | "invalid-phone"
    | "invalid-address"
    | "invalid-tax-office"
    | "failed"
    | null;
  ok: boolean;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

export async function partnerLoginAction(
  _prev: PartnerLoginState,
  formData: FormData,
): Promise<PartnerLoginState> {
  const locale = localeFromForm(formData);
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await loginPartnerUser(email, password);
  if (!result.ok) {
    if (
      result.reason === "throttled" ||
      result.reason === "pending" ||
      result.reason === "inactive"
    ) {
      return { error: result.reason };
    }
    return { error: "invalid" };
  }
  const next = safePartnerReturnPath(String(formData.get("next") ?? ""), locale);
  redirect(
    result.mustChangePassword
      ? localizedPath(locale, "/partner/change-password")
      : (next ?? localizedPath(locale, "/partner/jobs")),
  );
}

export async function partnerRegisterAction(
  _prev: PartnerRegisterState,
  formData: FormData,
): Promise<PartnerRegisterState> {
  try {
    const contact = partnerContactNamesFromForm(formData);
    const result = await createPartnerApplication({
      email: String(formData.get("email") ?? ""),
      phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
      phoneNational: String(formData.get("phoneNational") ?? ""),
      contactFirstName: contact.contactFirstName,
      contactLastName: contact.contactLastName,
      businessType: String(formData.get("businessType") ?? ""),
      name: String(formData.get("name") ?? ""),
      addressLine: String(formData.get("addressLine") ?? ""),
      countryCode: String(formData.get("countryCode") ?? ""),
      taxOffice: String(formData.get("taxOffice") ?? ""),
      taxNumber: String(formData.get("taxNumber") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    scheduleOpsPush("partner-application-created", () =>
      notifyOpsPartnerApplicationCreated(result.partnerId),
    );
    return { error: null, ok: true };
  } catch {
    return { error: "failed", ok: false };
  }
}

export async function partnerLogoutAction(formData: FormData) {
  const locale = localeFromForm(formData);
  await logoutPartnerUser();
  redirect(localizedPath(locale, "/partner/login"));
}

export async function partnerForcedPasswordChangeAction(
  _prev: PartnerPasswordState,
  formData: FormData,
): Promise<PartnerPasswordState> {
  const locale = localeFromForm(formData);
  const actor = await getPartnerActor();
  if (!actor) {
    redirect(localizedPath(locale, "/partner/login"));
  }
  if (!actor.mustChangePassword) {
    redirect(localizedPath(locale, "/partner/jobs"));
  }
  const result = await changePartnerPassword({
    actor,
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    requireCurrent: false,
  });
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  const session = await createPartnerSession(actor.userId);
  await writePartnerSessionCookie(session.token, session.expiresAt);
  redirect(localizedPath(locale, "/partner/jobs"));
}

export async function partnerPasswordChangeAction(
  _prev: PartnerPasswordState,
  formData: FormData,
): Promise<PartnerPasswordState> {
  const locale = localeFromForm(formData);
  const actor = await getPartnerActor();
  if (!actor) {
    redirect(localizedPath(locale, "/partner/login"));
  }
  if (actor.mustChangePassword) {
    redirect(localizedPath(locale, "/partner/change-password"));
  }
  const result = await changePartnerPassword({
    actor,
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    requireCurrent: true,
  });
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  const session = await createPartnerSession(actor.userId);
  await writePartnerSessionCookie(session.token, session.expiresAt);
  await notifyPartnerPasswordChanged({
    email: actor.email,
    locale,
  });
  return { error: null, ok: true };
}

export async function partnerSendRegisterCodeAction(
  _prev: PartnerEmailCodeState,
  formData: FormData,
): Promise<PartnerEmailCodeState> {
  const locale = localeFromForm(formData);
  const result = await issuePartnerEmailChallenge({
    purpose: "register",
    email: String(formData.get("email") ?? ""),
    locale,
    ip: await requestClientIp(),
  });
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  return { error: null, ok: true, sent: true };
}

export async function partnerVerifyRegisterCodeAction(
  _prev: PartnerEmailCodeState,
  formData: FormData,
): Promise<PartnerEmailCodeState> {
  const result = await verifyPartnerEmailChallenge({
    purpose: "register",
    email: String(formData.get("email") ?? ""),
    code: String(formData.get("verificationCode") ?? ""),
  });
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  return { error: null, ok: true, verified: true };
}

export async function partnerInvalidateEmailChallengeAction() {
  await invalidateCurrentPartnerEmailChallenge();
}

export async function partnerUpdateProfileAction(
  _prev: PartnerProfileState,
  formData: FormData,
): Promise<PartnerProfileState> {
  const locale = localeFromForm(formData);
  const actor = await getPartnerActor();
  if (!actor) {
    redirect(localizedPath(locale, "/partner/login"));
  }
  if (actor.mustChangePassword) {
    redirect(localizedPath(locale, "/partner/change-password"));
  }
  const contact = partnerContactNamesFromForm(formData);
  const result = await updatePartnerSelfProfile({
    partnerId: actor.partnerId,
    contactFirstName: contact.contactFirstName,
    contactLastName: contact.contactLastName,
    phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
    phoneNational: String(formData.get("phoneNational") ?? ""),
    addressLine: String(formData.get("addressLine") ?? ""),
    taxOffice: String(formData.get("taxOffice") ?? ""),
  });
  if (!result.ok) {
    if (result.error === "not-found") {
      return { error: "failed", ok: false };
    }
    return { error: result.error, ok: false };
  }
  revalidatePath(localizedPath(locale, "/partner/profile"));
  return { error: null, ok: true };
}

async function requireActivePartnerActor(locale: Locale) {
  const actor = await getPartnerActor();
  if (!actor) {
    redirect(localizedPath(locale, "/partner/login"));
  }
  if (actor.mustChangePassword) {
    redirect(localizedPath(locale, "/partner/change-password"));
  }
  return actor;
}

export async function partnerSendEmailChangeCodeAction(
  _prev: PartnerEmailCodeState,
  formData: FormData,
): Promise<PartnerEmailCodeState> {
  const locale = localeFromForm(formData);
  const actor = await requireActivePartnerActor(locale);
  const nextEmail = normalizePartnerEmail(String(formData.get("newEmail") ?? ""));
  const confirmEmail = normalizePartnerEmail(String(formData.get("confirmNewEmail") ?? ""));
  const currentPassword = String(formData.get("currentPassword") ?? "");
  if (!nextEmail || nextEmail !== confirmEmail) {
    return { error: "mismatch", ok: false };
  }
  if (nextEmail === normalizePartnerEmail(actor.email)) {
    return { error: "same-email", ok: false };
  }
  if (await partnerLoginEmailTaken(nextEmail, actor.userId)) {
    return { error: "duplicate", ok: false };
  }
  const stored = await query<{ password_hash: string }>(
    `SELECT password_hash
     FROM partner_users
     WHERE id = $1
     LIMIT 1`,
    [actor.userId],
  );
  const passwordHash = stored.rows[0]?.password_hash;
  if (!passwordHash || !currentPassword || !(await verifyPassword(currentPassword, passwordHash))) {
    return { error: "current-invalid", ok: false };
  }
  const result = await issuePartnerEmailChallenge({
    purpose: "email_change",
    email: nextEmail,
    locale,
    ip: await requestClientIp(),
    userId: actor.userId,
  });
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  return { error: null, ok: true, sent: true };
}

export async function partnerVerifyEmailChangeAction(
  _prev: PartnerEmailCodeState,
  formData: FormData,
): Promise<PartnerEmailCodeState> {
  const locale = localeFromForm(formData);
  const actor = await requireActivePartnerActor(locale);
  const nextEmail = normalizePartnerEmail(String(formData.get("newEmail") ?? ""));
  const confirmEmail = normalizePartnerEmail(String(formData.get("confirmNewEmail") ?? ""));
  if (!nextEmail || nextEmail !== confirmEmail) {
    return { error: "mismatch", ok: false };
  }
  if (nextEmail === normalizePartnerEmail(actor.email)) {
    return { error: "same-email", ok: false };
  }
  if (await partnerLoginEmailTaken(nextEmail, actor.userId)) {
    return { error: "duplicate", ok: false };
  }
  const verified = await verifyPartnerEmailChallenge({
    purpose: "email_change",
    email: nextEmail,
    code: String(formData.get("verificationCode") ?? ""),
    userId: actor.userId,
  });
  if (!verified.ok) {
    return { error: verified.error, ok: false };
  }
  const consumed = await consumeVerifiedPartnerEmailChallenge({
    purpose: "email_change",
    email: nextEmail,
    userId: actor.userId,
  });
  if (!consumed.ok) {
    return { error: "failed", ok: false };
  }
  const applied = await applyVerifiedPartnerLoginEmail({
    userId: actor.userId,
    partnerId: actor.partnerId,
    nextEmail,
  });
  if (!applied.ok) {
    return { error: applied.error, ok: false };
  }
  await notifyPreviousPartnerEmail({
    previousEmail: applied.previousEmail,
    locale,
  });
  revalidatePath(localizedPath(locale, "/partner/profile"));
  return { error: null, ok: true, verified: true };
}
