import "server-only";

import { cookies } from "next/headers";
import { isValidEmail } from "@/lib/booking/phone";
import { query } from "@/lib/db/postgres";
import { DRIVER_PORTAL_CHALLENGE_COOKIE } from "@/lib/driver-portal/constants";
import { writeDriverPortalDevOtp } from "@/lib/driver-portal/dev-otp";
import { buildDriverPortalLoginEmail } from "@/lib/driver-portal/login-email";
import {
  DRIVER_PORTAL_CODE_TTL_MS,
  DRIVER_PORTAL_MAX_VERIFY_ATTEMPTS,
  DRIVER_PORTAL_RESEND_COOLDOWN_MS,
  DRIVER_PORTAL_RESEND_MAX_PER_WINDOW,
  DRIVER_PORTAL_RESEND_WINDOW_MS,
  classifyDriverPortalChallenge,
  createDriverPortalCodeSalt,
  driverPortalCodesEqual,
  generateDriverPortalCode,
  hashDriverPortalCode,
  isDriverPortalCodeFormatValid,
} from "@/lib/driver-portal/otp-policy";
import { cookieSecure } from "@/lib/partner/session";
import { normalizePartnerEmail } from "@/lib/partner/email";
import { sendPartnerMail } from "@/lib/partner/mail";

export type DriverPortalIssueError = "invalid-email" | "not-found" | "throttled" | "mail-failed" | "failed";
export type DriverPortalVerifyError = "invalid" | "expired" | "used" | "locked" | "failed";

type ChallengeRow = {
  id: string;
  email: string;
  driver_id: string | null;
  code_hash: string;
  code_salt: string;
  attempt_count: number;
  expires_at: Date;
  consumed_at: Date | null;
};

type PortalDriverRow = {
  id: string;
  email: string;
};

async function readChallengeCookie() {
  const jar = await cookies();
  return jar.get(DRIVER_PORTAL_CHALLENGE_COOKIE)?.value?.trim() || "";
}

async function writeChallengeCookie(challengeId: string) {
  const jar = await cookies();
  jar.set({
    name: DRIVER_PORTAL_CHALLENGE_COOKIE,
    value: challengeId,
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: Math.ceil(DRIVER_PORTAL_CODE_TTL_MS / 1000),
  });
}

async function clearChallengeCookie() {
  const jar = await cookies();
  jar.set({
    name: DRIVER_PORTAL_CHALLENGE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

async function loadChallenge(id: string) {
  if (!id) {
    return null;
  }
  const result = await query<ChallengeRow>(
    `SELECT id, email, driver_id, code_hash, code_salt, attempt_count, expires_at, consumed_at
     FROM driver_portal_challenges
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function findPortalDriverByEmail(email: string) {
  const result = await query<PortalDriverRow>(
    `SELECT id, email
     FROM partner_drivers
     WHERE lower(email) = $1
       AND deleted_at IS NULL
       AND status = 'active'
     LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

async function isIssueThrottled(email: string, ip: string | null) {
  const latest = await query<{ created_at: Date }>(
    `SELECT created_at
     FROM driver_portal_challenges
     WHERE email = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [email],
  );
  const lastAt = latest.rows[0]?.created_at;
  if (lastAt && Date.now() - lastAt.getTime() < DRIVER_PORTAL_RESEND_COOLDOWN_MS) {
    return true;
  }
  const since = new Date(Date.now() - DRIVER_PORTAL_RESEND_WINDOW_MS);
  const counted = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM driver_portal_challenges
     WHERE email = $1
       AND created_at >= $2`,
    [email, since],
  );
  if (Number(counted.rows[0]?.c ?? 0) >= DRIVER_PORTAL_RESEND_MAX_PER_WINDOW) {
    return true;
  }
  if (!ip) {
    return false;
  }
  const byIp = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM driver_portal_challenges
     WHERE ip = $1
       AND created_at >= $2`,
    [ip, since],
  );
  return Number(byIp.rows[0]?.c ?? 0) >= DRIVER_PORTAL_RESEND_MAX_PER_WINDOW;
}

async function recordUnknownEmailAttempt(email: string, ip: string | null) {
  await query(
    `INSERT INTO driver_portal_challenges (
        email, driver_id, code_hash, code_salt, ip, expires_at, consumed_at
     )
     VALUES ($1, NULL, 'unused', 'unused', $2, NOW(), NOW())`,
    [email, ip],
  );
}

export async function issueDriverPortalOtp(input: {
  email: string;
  ip: string | null;
}): Promise<{ ok: true } | { ok: false; error: DriverPortalIssueError }> {
  const email = normalizePartnerEmail(input.email);
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid-email" };
  }
  if (await isIssueThrottled(email, input.ip)) {
    return { ok: false, error: "throttled" };
  }

  const driver = await findPortalDriverByEmail(email);
  if (!driver) {
    await recordUnknownEmailAttempt(email, input.ip);
    return { ok: false, error: "not-found" };
  }

  const previousId = await readChallengeCookie();
  await query(
    `UPDATE driver_portal_challenges
     SET consumed_at = COALESCE(consumed_at, NOW())
     WHERE consumed_at IS NULL
       AND (driver_id = $1 OR id = $2)`,
    [driver.id, previousId || null],
  );

  const code = generateDriverPortalCode();
  const salt = createDriverPortalCodeSalt();
  const codeHash = hashDriverPortalCode(code, salt);
  const expiresAt = new Date(Date.now() + DRIVER_PORTAL_CODE_TTL_MS);
  const inserted = await query<{ id: string }>(
    `INSERT INTO driver_portal_challenges (
        email, driver_id, code_hash, code_salt, ip, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [email, driver.id, codeHash, salt, input.ip, expiresAt],
  );
  const challengeId = inserted.rows[0]?.id;
  if (!challengeId) {
    return { ok: false, error: "failed" };
  }

  const mail = buildDriverPortalLoginEmail(code);
  const sent = await sendPartnerMail({
    to: email,
    subject: mail.subject,
    text: mail.text,
  });
  if (!sent.ok) {
    await query(`DELETE FROM driver_portal_challenges WHERE id = $1`, [challengeId]);
    return { ok: false, error: "mail-failed" };
  }

  writeDriverPortalDevOtp(email, code);
  await writeChallengeCookie(challengeId);
  return { ok: true };
}

export async function verifyDriverPortalOtp(input: {
  email: string;
  code: string;
}): Promise<{ ok: true; driverId: string } | { ok: false; error: DriverPortalVerifyError }> {
  const email = normalizePartnerEmail(input.email);
  const challengeId = await readChallengeCookie();
  const row = await loadChallenge(challengeId);
  if (!row?.driver_id || row.email !== email) {
    return { ok: false, error: "invalid" };
  }

  const status = classifyDriverPortalChallenge({
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    attemptCount: row.attempt_count,
  });
  if (status === "expired") {
    return { ok: false, error: "expired" };
  }
  if (status === "consumed" || status === "used") {
    return { ok: false, error: "used" };
  }
  if (status === "locked") {
    return { ok: false, error: "locked" };
  }

  if (!isDriverPortalCodeFormatValid(input.code)) {
    await query(
      `UPDATE driver_portal_challenges
       SET attempt_count = attempt_count + 1
       WHERE id = $1`,
      [row.id],
    );
    return { ok: false, error: "invalid" };
  }

  const submitted = hashDriverPortalCode(input.code, row.code_salt);
  if (!driverPortalCodesEqual(submitted, row.code_hash)) {
    const updated = await query<{ attempt_count: number }>(
      `UPDATE driver_portal_challenges
       SET attempt_count = attempt_count + 1
       WHERE id = $1
       RETURNING attempt_count`,
      [row.id],
    );
    if ((updated.rows[0]?.attempt_count ?? 0) >= DRIVER_PORTAL_MAX_VERIFY_ATTEMPTS) {
      return { ok: false, error: "locked" };
    }
    return { ok: false, error: "invalid" };
  }

  const consumed = await query<{ driver_id: string }>(
    `UPDATE driver_portal_challenges
     SET consumed_at = NOW()
     WHERE id = $1
       AND consumed_at IS NULL
       AND expires_at > NOW()
     RETURNING driver_id`,
    [row.id],
  );
  const driverId = consumed.rows[0]?.driver_id;
  if (!driverId) {
    return { ok: false, error: "used" };
  }

  const driver = await findPortalDriverByEmail(email);
  if (!driver || driver.id !== driverId) {
    return { ok: false, error: "invalid" };
  }

  await clearChallengeCookie();
  return { ok: true, driverId };
}
