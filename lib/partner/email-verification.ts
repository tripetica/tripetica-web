import "server-only";

import { cookies } from "next/headers";
import { query } from "@/lib/db/postgres";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { isValidEmail } from "@/lib/booking/phone";
import { normalizePartnerEmail } from "@/lib/partner/email";
import {
  PARTNER_EMAIL_CHALLENGE_COOKIE,
  PARTNER_EMAIL_CODE_TTL_MS,
  PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS,
  PARTNER_EMAIL_RESEND_COOLDOWN_MS,
  PARTNER_EMAIL_RESEND_MAX_PER_WINDOW,
  PARTNER_EMAIL_RESEND_WINDOW_MS,
  classifyPartnerEmailChallenge,
  createPartnerEmailCodeSalt,
  generatePartnerEmailCode,
  hashPartnerEmailCode,
  isPartnerEmailCodeFormatValid,
  partnerEmailCodesEqual,
  type PartnerEmailChallengePurpose,
} from "@/lib/partner/email-verification-policy";
import { sendPartnerMail } from "@/lib/partner/mail";
import {
  buildPartnerEmailChangeCodeEmail,
  buildPartnerEmailChangedNotice,
  buildPartnerPasswordChangedNotice,
  buildPartnerRegisterCodeEmail,
} from "@/lib/partner/verification-email";
import { cookieSecure } from "@/lib/partner/session";

export type PartnerEmailChallengeIssueError =
  | "invalid-email"
  | "throttled"
  | "mail-failed"
  | "failed";

export type PartnerEmailChallengeVerifyError =
  | "invalid"
  | "expired"
  | "used"
  | "locked"
  | "email-mismatch"
  | "failed";

type ChallengeRow = {
  id: string;
  purpose: PartnerEmailChallengePurpose;
  email: string;
  code_hash: string;
  code_salt: string;
  user_id: string | null;
  attempt_count: number;
  expires_at: Date;
  verified_at: Date | null;
  consumed_at: Date | null;
};

async function readChallengeCookie() {
  const jar = await cookies();
  return jar.get(PARTNER_EMAIL_CHALLENGE_COOKIE)?.value?.trim() || "";
}

export async function writePartnerEmailChallengeCookie(challengeId: string) {
  const jar = await cookies();
  jar.set({
    name: PARTNER_EMAIL_CHALLENGE_COOKIE,
    value: challengeId,
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: Math.ceil(PARTNER_EMAIL_CODE_TTL_MS / 1000),
  });
}

export async function clearPartnerEmailChallengeCookie() {
  const jar = await cookies();
  jar.delete(PARTNER_EMAIL_CHALLENGE_COOKIE);
}

async function loadChallenge(id: string) {
  if (!id) {
    return null;
  }
  const result = await query<ChallengeRow>(
    `SELECT id, purpose, email, code_hash, code_salt, user_id,
            attempt_count, expires_at, verified_at, consumed_at
     FROM partner_email_challenges
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function isIssueThrottled(email: string, purpose: PartnerEmailChallengePurpose, ip: string | null) {
  const latest = await query<{ created_at: Date }>(
    `SELECT created_at
     FROM partner_email_challenges
     WHERE email = $1
       AND purpose = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, purpose],
  );
  const lastAt = latest.rows[0]?.created_at;
  if (lastAt && Date.now() - lastAt.getTime() < PARTNER_EMAIL_RESEND_COOLDOWN_MS) {
    return true;
  }
  const since = new Date(Date.now() - PARTNER_EMAIL_RESEND_WINDOW_MS);
  const counted = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM partner_email_challenges
     WHERE email = $1
       AND purpose = $2
       AND created_at >= $3`,
    [email, purpose, since],
  );
  if (Number(counted.rows[0]?.c ?? 0) >= PARTNER_EMAIL_RESEND_MAX_PER_WINDOW) {
    return true;
  }
  if (!ip) {
    return false;
  }
  const byIp = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM partner_email_challenges
     WHERE ip = $1
       AND purpose = $2
       AND created_at >= $3`,
    [ip, purpose, since],
  );
  return Number(byIp.rows[0]?.c ?? 0) >= PARTNER_EMAIL_RESEND_MAX_PER_WINDOW;
}

export async function issuePartnerEmailChallenge(input: {
  purpose: PartnerEmailChallengePurpose;
  email: string;
  locale: Locale;
  ip: string | null;
  userId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: PartnerEmailChallengeIssueError }> {
  const email = normalizePartnerEmail(input.email);
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid-email" };
  }
  if (await isIssueThrottled(email, input.purpose, input.ip)) {
    return { ok: false, error: "throttled" };
  }

  const previousId = await readChallengeCookie();
  if (previousId) {
    await query(
      `UPDATE partner_email_challenges
       SET consumed_at = COALESCE(consumed_at, NOW())
       WHERE id = $1
         AND consumed_at IS NULL`,
      [previousId],
    );
  }

  const code = generatePartnerEmailCode();
  const salt = createPartnerEmailCodeSalt();
  const codeHash = hashPartnerEmailCode(code, salt);
  const expiresAt = new Date(Date.now() + PARTNER_EMAIL_CODE_TTL_MS);
  const inserted = await query<{ id: string }>(
    `INSERT INTO partner_email_challenges (
        purpose, email, code_hash, code_salt, user_id, ip, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [input.purpose, email, codeHash, salt, input.userId ?? null, input.ip, expiresAt],
  );
  const challengeId = inserted.rows[0]?.id;
  if (!challengeId) {
    return { ok: false, error: "failed" };
  }

  const mail =
    input.purpose === "register"
      ? buildPartnerRegisterCodeEmail(input.locale, code)
      : buildPartnerEmailChangeCodeEmail(input.locale, code);
  const sent = await sendPartnerMail({
    to: email,
    subject: mail.subject,
    text: mail.text,
  });
  if (!sent.ok) {
    console.error("[partner-mail] verification code was not delivered", {
      purpose: input.purpose,
      error: sent.error,
    });
    await query(`DELETE FROM partner_email_challenges WHERE id = $1`, [challengeId]);
    return { ok: false, error: "mail-failed" };
  }

  await writePartnerEmailChallengeCookie(challengeId);
  return { ok: true };
}

export async function verifyPartnerEmailChallenge(input: {
  email: string;
  code: string;
  purpose: PartnerEmailChallengePurpose;
  userId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: PartnerEmailChallengeVerifyError }> {
  const email = normalizePartnerEmail(input.email);
  const challengeId = await readChallengeCookie();
  const row = await loadChallenge(challengeId);
  if (!row || row.purpose !== input.purpose) {
    return { ok: false, error: "invalid" };
  }
  if (input.userId && row.user_id && row.user_id !== input.userId) {
    return { ok: false, error: "invalid" };
  }
  const status = classifyPartnerEmailChallenge({
    email,
    expectedEmail: row.email,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
    consumedAt: row.consumed_at,
    attemptCount: row.attempt_count,
  });
  if (status === "email-mismatch") {
    return { ok: false, error: "email-mismatch" };
  }
  if (status === "expired") {
    return { ok: false, error: "expired" };
  }
  if (status === "consumed") {
    return { ok: false, error: "used" };
  }
  if (status === "verified") {
    return { ok: true };
  }
  if (status === "locked") {
    return { ok: false, error: "locked" };
  }
  if (!isPartnerEmailCodeFormatValid(input.code)) {
    await query(
      `UPDATE partner_email_challenges
       SET attempt_count = attempt_count + 1
       WHERE id = $1`,
      [row.id],
    );
    return { ok: false, error: "invalid" };
  }
  const submitted = hashPartnerEmailCode(input.code, row.code_salt);
  if (!partnerEmailCodesEqual(submitted, row.code_hash)) {
    const updated = await query<{ attempt_count: number }>(
      `UPDATE partner_email_challenges
       SET attempt_count = attempt_count + 1
       WHERE id = $1
       RETURNING attempt_count`,
      [row.id],
    );
    if ((updated.rows[0]?.attempt_count ?? 0) >= PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS) {
      return { ok: false, error: "locked" };
    }
    return { ok: false, error: "invalid" };
  }
  await query(
    `UPDATE partner_email_challenges
     SET verified_at = NOW()
     WHERE id = $1
       AND verified_at IS NULL
       AND consumed_at IS NULL`,
    [row.id],
  );
  return { ok: true };
}

export async function consumeVerifiedPartnerEmailChallenge(input: {
  email: string;
  purpose: PartnerEmailChallengePurpose;
  userId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: "unverified" }> {
  const email = normalizePartnerEmail(input.email);
  const challengeId = await readChallengeCookie();
  const consumed = await query<{ id: string }>(
    `UPDATE partner_email_challenges
     SET consumed_at = NOW()
     WHERE id = $1
       AND purpose = $2
       AND email = $3
       AND verified_at IS NOT NULL
       AND consumed_at IS NULL
       AND expires_at > NOW()
       AND ($4::uuid IS NULL OR user_id IS NULL OR user_id = $4)
     RETURNING id`,
    [challengeId || null, input.purpose, email, input.userId ?? null],
  );
  if (!consumed.rows[0]) {
    return { ok: false, error: "unverified" };
  }
  await clearPartnerEmailChallengeCookie();
  return { ok: true };
}

export async function invalidateCurrentPartnerEmailChallenge() {
  const challengeId = await readChallengeCookie();
  if (!challengeId) {
    return;
  }
  await query(
    `UPDATE partner_email_challenges
     SET consumed_at = COALESCE(consumed_at, NOW())
     WHERE id = $1
       AND consumed_at IS NULL`,
    [challengeId],
  );
  await clearPartnerEmailChallengeCookie();
}

export async function notifyPreviousPartnerEmail(input: {
  previousEmail: string;
  locale: Locale;
}) {
  const mail = buildPartnerEmailChangedNotice(isLocale(input.locale) ? input.locale : "tr");
  const sent = await sendPartnerMail({
    to: normalizePartnerEmail(input.previousEmail),
    subject: mail.subject,
    text: mail.text,
  });
  if (!sent.ok) {
    console.error("[partner-mail] email-changed notice was not delivered", sent.error);
  }
}

export async function notifyPartnerPasswordChanged(input: {
  email: string;
  locale: Locale;
}) {
  const mail = buildPartnerPasswordChangedNotice(isLocale(input.locale) ? input.locale : "tr");
  const sent = await sendPartnerMail({
    to: normalizePartnerEmail(input.email),
    subject: mail.subject,
    text: mail.text,
  });
  if (!sent.ok) {
    console.error("[partner-mail] password-changed notice was not delivered", sent.error);
  }
}
