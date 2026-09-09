import "server-only";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { normalizeIso2 } from "@/lib/geo/countries";
import { buildAccountActionEmail } from "@/lib/account/action-email";
import {
  ACCOUNT_EMAIL_CHANGE_TTL_MS,
  ACCOUNT_PASSWORD_RESET_TTL_MS,
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_VERIFY_TTL_MS,
} from "@/lib/account/constants";
import { isValidEmailShape, normalizeAccountEmail } from "@/lib/account/email";
import { accountAppBaseUrl, sendAccountMail } from "@/lib/account/mail";
import {
  isCustomerLoginThrottled,
  isVerificationResendThrottled,
  recordAllowedAuthRequest,
  recordCustomerLoginAttempt,
} from "@/lib/account/rate-limit";
import { accountLoginPath } from "@/lib/account/return-url";
import { requireVerifiedAccountActor } from "@/lib/account/reservation-access";
import {
  clearAccountSessionCookie,
  createAccountSession,
  deleteAccountSessionByToken,
  deleteAccountSessionsForUser,
  getAccountActor,
  writeAccountSessionCookie,
} from "@/lib/account/session";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { isPasswordLengthValid } from "@/lib/security/password-policy";
import { requestClientIp } from "@/lib/security/request-client-ip";
import {
  createAuthTokenRecord,
  findAuthToken,
  markAuthTokenUsed,
} from "@/lib/account/tokens";
import { buildVerificationEmail } from "@/lib/account/verification-email";
import {
  applyPendingEmailChange,
  claimLegacyReservationsByVerifiedEmail,
  deleteUnverifiedCustomerUser,
  findCustomerByEmail,
  findCustomerById,
  insertCustomerUser,
  markCustomerEmailVerified,
  setPendingEmail,
  touchCustomerLogin,
  updateCustomerPassword,
  updateCustomerProfile,
} from "@/lib/account/users";

function accountMailConfigured() {
  const provider = (process.env.ACCOUNT_EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (provider !== "smtp") {
    return false;
  }
  const host = (process.env.SMTP_HOST ?? "").trim();
  const user = (process.env.SMTP_USER ?? "").trim();
  const pass = process.env.SMTP_PASS ?? "";
  return Boolean(host && user && pass);
}

function trimName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function registerCustomer(input: {
  locale: Locale;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  phoneCountryCode: string | null;
  nationalityCode: string | null;
  password: string;
  passwordConfirm: string;
}) {
  const firstName = trimName(input.firstName);
  const lastName = trimName(input.lastName);
  const email = normalizeAccountEmail(input.email);
  const nationalityCode = normalizeIso2(input.nationalityCode);
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80) {
    return { ok: false as const, reason: "invalid_name" as const };
  }
  if (!isValidEmailShape(email)) {
    return { ok: false as const, reason: "invalid_email" as const };
  }
  if (!nationalityCode) {
    return { ok: false as const, reason: "invalid_country" as const };
  }
  if (!isPasswordLengthValid(input.password) || input.password !== input.passwordConfirm) {
    return { ok: false as const, reason: "invalid_password" as const };
  }
  if (!accountMailConfigured()) {
    console.error(
      "[account-mail] registration blocked — SMTP not configured (need ACCOUNT_EMAIL_PROVIDER=smtp, SMTP_HOST, SMTP_USER, SMTP_PASS)",
    );
    return { ok: false as const, reason: "mail_send_failed" as const };
  }
  const ip = await requestClientIp();
  if (!(await recordAllowedAuthRequest("registration", email, ip))) {
    return { ok: false as const, reason: "throttled" as const };
  }
  const existing = await findCustomerByEmail(email);
  if (existing) {
    return { ok: false as const, reason: "email_taken" as const };
  }
  const passwordHash = await hashPassword(input.password);
  const userId = await insertCustomerUser({
    firstName,
    lastName,
    email,
    phone: input.phone,
    phoneCountryCode: input.phoneCountryCode,
    nationalityCode,
    passwordHash,
  });
  const mail = await issueEmailVerification(userId, email, input.locale);
  if (!mail.ok) {
    await deleteUnverifiedCustomerUser(userId);
    return { ok: false as const, reason: "mail_send_failed" as const };
  }
  const session = await createAccountSession(userId);
  await writeAccountSessionCookie(session.token, session.expiresAt);
  return { ok: true as const, userId };
}

async function issueEmailVerification(
  userId: string,
  email: string,
  locale: Locale,
) {
  const token = await createAuthTokenRecord({
    userId,
    purpose: "email_verify",
    expiresAt: new Date(Date.now() + ACCOUNT_VERIFY_TTL_MS),
    emailTarget: email,
  });
  const link = `${accountAppBaseUrl()}/${locale}/account/verify?token=${encodeURIComponent(token)}`;
  const content = buildVerificationEmail(locale, link);
  return sendAccountMail({
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

export async function resendCustomerVerification(locale: Locale) {
  const actor = await getAccountActor();
  if (!actor) {
    return { ok: false as const, reason: "unauthenticated" as const };
  }
  if (actor.emailVerifiedAt) {
    return { ok: false as const, reason: "already_verified" as const };
  }
  if (await isVerificationResendThrottled(actor.id)) {
    return { ok: false as const, reason: "throttled" as const };
  }
  if (!accountMailConfigured()) {
    console.error(
      "[account-mail] verification resend blocked — SMTP not configured (need ACCOUNT_EMAIL_PROVIDER=smtp, SMTP_HOST, SMTP_USER, SMTP_PASS)",
      { userId: actor.id },
    );
    return { ok: false as const, reason: "mail_send_failed" as const };
  }
  const mail = await issueEmailVerification(actor.id, actor.email, locale);
  if (!mail.ok) {
    console.error("[account-mail] verification resend failed", {
      userId: actor.id,
      error: mail.error,
    });
    return { ok: false as const, reason: "mail_send_failed" as const };
  }
  return { ok: true as const };
}

export async function verifyCustomerEmailToken(token: string) {
  const row = await findAuthToken(token, "email_verify");
  if (!row || row.used_at) {
    return { ok: false as const, reason: "invalid" as const };
  }
  if (row.expires_at.getTime() <= Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }
  const user = await findCustomerById(row.user_id);
  if (!user || !user.is_active) {
    return { ok: false as const, reason: "invalid" as const };
  }
  await markAuthTokenUsed(row.id);
  await markCustomerEmailVerified(user.id);
  await claimLegacyReservationsByVerifiedEmail(user.id, user.email);
  await deleteAccountSessionsForUser(user.id);
  const session = await createAccountSession(user.id);
  await touchCustomerLogin(user.id);
  await writeAccountSessionCookie(session.token, session.expiresAt);
  return { ok: true as const };
}

export async function loginCustomer(emailRaw: string, password: string) {
  const email = normalizeAccountEmail(emailRaw);
  const ip = await requestClientIp();
  if (!email || !password) {
    return { ok: false as const, reason: "invalid" as const };
  }
  if (await isCustomerLoginThrottled(email, ip)) {
    return { ok: false as const, reason: "throttled" as const };
  }
  const user = await findCustomerByEmail(email);
  const passwordOk = await verifyPassword(password, user?.password_hash ?? "");
  if (!user || !user.is_active || !passwordOk) {
    await recordCustomerLoginAttempt(email, ip, false);
    return { ok: false as const, reason: "invalid" as const };
  }
  await recordCustomerLoginAttempt(email, ip, true);
  if (user.email_verified_at) {
    await claimLegacyReservationsByVerifiedEmail(user.id, user.email);
  }
  await deleteAccountSessionsForUser(user.id);
  const session = await createAccountSession(user.id);
  await touchCustomerLogin(user.id);
  await writeAccountSessionCookie(session.token, session.expiresAt);
  return {
    ok: true as const,
    emailVerified: Boolean(user.email_verified_at),
  };
}

export async function logoutCustomer() {
  const token = (await cookies()).get(ACCOUNT_SESSION_COOKIE)?.value;
  if (token) {
    await deleteAccountSessionByToken(token);
  }
  await clearAccountSessionCookie();
}

export async function requireAccountPage(locale: Locale, options?: {
  requireVerified?: boolean;
}) {
  if (options?.requireVerified) {
    const access = await requireVerifiedAccountActor();
    if (!access.ok) {
      redirect(
        access.reason === "unverified"
          ? localizedPath(locale, "/account/verify")
          : accountLoginPath(locale, "/account"),
      );
    }
    return access.actor;
  }
  const actor = await getAccountActor();
  if (!actor) {
    redirect(accountLoginPath(locale, "/account"));
  }
  return actor;
}

export async function requestPasswordReset(emailRaw: string, locale: Locale) {
  const email = normalizeAccountEmail(emailRaw);
  // Always return ok to reduce email enumeration.
  if (!isValidEmailShape(email)) {
    return { ok: true as const };
  }
  if (!accountMailConfigured()) {
    console.error("[account-mail] password reset skipped — SMTP not configured");
    return { ok: true as const };
  }
  const ip = await requestClientIp();
  if (!(await recordAllowedAuthRequest("password_reset", email, ip))) {
    return { ok: true as const };
  }
  const user = await findCustomerByEmail(email);
  if (!user || !user.is_active) {
    return { ok: true as const };
  }
  const token = await createAuthTokenRecord({
    userId: user.id,
    purpose: "password_reset",
    expiresAt: new Date(Date.now() + ACCOUNT_PASSWORD_RESET_TTL_MS),
    emailTarget: email,
  });
  const link = `${accountAppBaseUrl()}/${locale}/account/reset-password?token=${encodeURIComponent(token)}`;
  const content = buildAccountActionEmail(locale, "password_reset", link);
  await sendAccountMail({
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  return { ok: true as const };
}

export async function resetCustomerPassword(input: {
  token: string;
  password: string;
  passwordConfirm: string;
}) {
  if (!isPasswordLengthValid(input.password) || input.password !== input.passwordConfirm) {
    return { ok: false as const, reason: "invalid_password" as const };
  }
  const row = await findAuthToken(input.token, "password_reset");
  if (!row || row.used_at) {
    return { ok: false as const, reason: "invalid" as const };
  }
  if (row.expires_at.getTime() <= Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }
  const user = await findCustomerById(row.user_id);
  if (!user || !user.is_active) {
    return { ok: false as const, reason: "invalid" as const };
  }
  const passwordHash = await hashPassword(input.password);
  await updateCustomerPassword(user.id, passwordHash);
  await markAuthTokenUsed(row.id);
  await deleteAccountSessionsForUser(user.id);
  const session = await createAccountSession(user.id);
  await touchCustomerLogin(user.id);
  await writeAccountSessionCookie(session.token, session.expiresAt);
  return { ok: true as const };
}

export async function updateAccountProfile(input: {
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneCountryCode: string | null;
  nationalityCode: string | null;
  email: string;
  locale: Locale;
}) {
  const actor = await getAccountActor();
  if (!actor) {
    return { ok: false as const, reason: "unauthenticated" as const };
  }
  const firstName = trimName(input.firstName);
  const lastName = trimName(input.lastName);
  if (!firstName || !lastName) {
    return { ok: false as const, reason: "invalid_name" as const };
  }
  const nationalityCode = normalizeIso2(input.nationalityCode);
  if (!nationalityCode) {
    return { ok: false as const, reason: "invalid_country" as const };
  }
  await updateCustomerProfile({
    userId: actor.id,
    firstName,
    lastName,
    phone: input.phone,
    phoneCountryCode: input.phoneCountryCode,
    nationalityCode,
  });
  const nextEmail = normalizeAccountEmail(input.email);
  if (nextEmail !== normalizeAccountEmail(actor.email)) {
    if (!isValidEmailShape(nextEmail)) {
      return { ok: false as const, reason: "invalid_email" as const };
    }
    const taken = await findCustomerByEmail(nextEmail);
    if (taken && taken.id !== actor.id) {
      return { ok: false as const, reason: "email_taken" as const };
    }
    if (!accountMailConfigured()) {
      return { ok: false as const, reason: "mail_send_failed" as const };
    }
    await setPendingEmail(actor.id, nextEmail);
    const token = await createAuthTokenRecord({
      userId: actor.id,
      purpose: "email_change",
      expiresAt: new Date(Date.now() + ACCOUNT_EMAIL_CHANGE_TTL_MS),
      emailTarget: nextEmail,
    });
    const link = `${accountAppBaseUrl()}/${input.locale}/account/verify?token=${encodeURIComponent(token)}&purpose=email_change`;
    const content = buildAccountActionEmail(input.locale, "email_change", link);
    const mail = await sendAccountMail({
      to: nextEmail,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    if (!mail.ok) {
      console.error("[account-mail] email change confirmation failed", {
        userId: actor.id,
        error: mail.error,
      });
      return { ok: false as const, reason: "mail_send_failed" as const };
    }
    return { ok: true as const, emailChangePending: true as const };
  }
  return { ok: true as const, emailChangePending: false as const };
}

export async function verifyEmailChangeToken(token: string) {
  const row = await findAuthToken(token, "email_change");
  if (!row || row.used_at || !row.email_target) {
    return { ok: false as const, reason: "invalid" as const };
  }
  if (row.expires_at.getTime() <= Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }
  const taken = await findCustomerByEmail(row.email_target);
  if (taken && taken.id !== row.user_id) {
    return { ok: false as const, reason: "email_taken" as const };
  }
  await markAuthTokenUsed(row.id);
  await applyPendingEmailChange(row.user_id, row.email_target);
  await claimLegacyReservationsByVerifiedEmail(row.user_id, row.email_target);
  await deleteAccountSessionsForUser(row.user_id);
  const session = await createAccountSession(row.user_id);
  await writeAccountSessionCookie(session.token, session.expiresAt);
  return { ok: true as const };
}
