import "server-only";

import { query } from "@/lib/db/postgres";
import { isValidEmail } from "@/lib/booking/phone";
import { normalizePartnerEmail } from "@/lib/partner/email";
import {
  consumeVerifiedPartnerEmailChallenge,
  issuePartnerEmailChallenge,
  notifyPartnerPasswordChanged,
  verifyPartnerEmailChallenge,
  type PartnerEmailChallengeIssueError,
  type PartnerEmailChallengeVerifyError,
} from "@/lib/partner/email-verification";
import { partnerLoginDenialAfterPassword } from "@/lib/partner/login-status";
import {
  isPartnerPasswordLengthValid,
  partnerPasswordsMatch,
} from "@/lib/partner/policy";
import { deletePartnerSessionsForUser } from "@/lib/partner/session";
import type { PartnerStatus } from "@/lib/partner/constants";
import { type Locale } from "@/lib/i18n/config";
import { hashPassword, verifyPassword } from "@/lib/security/password";

export type PartnerPasswordResetLookup =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "invalid-email" | "not-found" | "pending" | "inactive" };

export type PartnerPasswordResetCompleteError =
  | "unverified"
  | "short"
  | "mismatch"
  | "same-as-old"
  | "failed";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  user_status: PartnerStatus;
  partner_status: PartnerStatus;
  partner_deleted: boolean;
};

async function loadPartnerUserByEmail(emailRaw: string) {
  const email = normalizePartnerEmail(emailRaw);
  if (!isValidEmail(email)) {
    return null;
  }
  const result = await query<UserRow>(
    `SELECT
        u.id,
        u.email,
        u.password_hash,
        u.status AS user_status,
        p.status AS partner_status,
        (p.deleted_at IS NOT NULL) AS partner_deleted
     FROM partner_users u
     JOIN partners p ON p.id = u.partner_id
     WHERE lower(u.email) = $1
     LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function lookupPartnerPasswordResetUser(
  emailRaw: string,
): Promise<PartnerPasswordResetLookup> {
  const email = normalizePartnerEmail(emailRaw);
  if (!isValidEmail(email)) {
    return { ok: false, reason: "invalid-email" };
  }
  const user = await loadPartnerUserByEmail(email);
  if (!user || user.partner_deleted) {
    return { ok: false, reason: "not-found" };
  }
  const denial = partnerLoginDenialAfterPassword({
    userStatus: user.user_status,
    partnerStatus: user.partner_status,
    deleted: user.partner_deleted,
  });
  if (denial === "pending") {
    return { ok: false, reason: "pending" };
  }
  if (denial === "inactive" || denial === "invalid") {
    return { ok: false, reason: "inactive" };
  }
  return { ok: true, userId: user.id, email: normalizePartnerEmail(user.email) };
}

async function invalidateOpenPasswordResetChallenges(email: string) {
  await query(
    `UPDATE partner_email_challenges
     SET consumed_at = COALESCE(consumed_at, NOW())
     WHERE email = $1
       AND purpose = 'password_reset'
       AND consumed_at IS NULL`,
    [email],
  );
}

export async function requestPartnerPasswordReset(input: {
  email: string;
  locale: Locale;
  ip: string | null;
}): Promise<
  | { ok: true; email: string }
  | {
      ok: false;
      error:
        | PartnerEmailChallengeIssueError
        | "not-found"
        | "pending"
        | "inactive";
    }
> {
  const lookup = await lookupPartnerPasswordResetUser(input.email);
  if (!lookup.ok) {
    return { ok: false, error: lookup.reason };
  }
  await invalidateOpenPasswordResetChallenges(lookup.email);
  const issued = await issuePartnerEmailChallenge({
    purpose: "password_reset",
    email: lookup.email,
    locale: input.locale,
    ip: input.ip,
    userId: lookup.userId,
  });
  if (!issued.ok) {
    return issued;
  }
  return { ok: true, email: lookup.email };
}

export async function verifyPartnerPasswordResetCode(input: {
  email: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: PartnerEmailChallengeVerifyError }> {
  const lookup = await lookupPartnerPasswordResetUser(input.email);
  if (!lookup.ok) {
    return { ok: false, error: "invalid" };
  }
  return verifyPartnerEmailChallenge({
    email: lookup.email,
    code: input.code,
    purpose: "password_reset",
    userId: lookup.userId,
  });
}

export async function completePartnerPasswordReset(input: {
  email: string;
  newPassword: string;
  confirmPassword: string;
  locale: Locale;
}): Promise<
  | { ok: true; email: string }
  | { ok: false; error: PartnerPasswordResetCompleteError }
> {
  if (!partnerPasswordsMatch(input.newPassword, input.confirmPassword)) {
    return { ok: false, error: "mismatch" };
  }
  if (!isPartnerPasswordLengthValid(input.newPassword)) {
    return { ok: false, error: "short" };
  }

  const lookup = await lookupPartnerPasswordResetUser(input.email);
  if (!lookup.ok) {
    return { ok: false, error: "failed" };
  }

  const user = await loadPartnerUserByEmail(lookup.email);
  if (!user || user.id !== lookup.userId) {
    return { ok: false, error: "failed" };
  }
  if (await verifyPassword(input.newPassword, user.password_hash)) {
    return { ok: false, error: "same-as-old" };
  }

  const consumed = await consumeVerifiedPartnerEmailChallenge({
    email: lookup.email,
    purpose: "password_reset",
    userId: lookup.userId,
  });
  if (!consumed.ok) {
    return { ok: false, error: "unverified" };
  }

  const nextHash = await hashPassword(input.newPassword);
  const updated = await query(
    `UPDATE partner_users
     SET password_hash = $1,
         must_change_password = FALSE
     WHERE id = $2
       AND status = 'active'`,
    [nextHash, lookup.userId],
  );
  if (updated.rowCount !== 1) {
    return { ok: false, error: "failed" };
  }

  await deletePartnerSessionsForUser(lookup.userId);
  await notifyPartnerPasswordChanged({
    email: lookup.email,
    locale: input.locale,
  });
  return { ok: true, email: lookup.email };
}
