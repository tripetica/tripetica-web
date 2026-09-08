import "server-only";

import { query } from "@/lib/db/postgres";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

const VERIFY_RESEND_COOLDOWN_MS = 20 * 1000;
const VERIFY_RESEND_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_RESEND_MAX_PER_WINDOW = 5;

type AttemptRow = {
  failure_count: string;
};

type CountRow = {
  c: string;
};

type CreatedAtRow = {
  created_at: Date;
};

type AuthRequestType = "registration" | "password_reset";

const AUTH_REQUEST_LIMITS: Record<
  AuthRequestType,
  { emailMax: number; ipMax: number; windowMs: number; cooldownMs: number }
> = {
  registration: {
    emailMax: 5,
    ipMax: 20,
    windowMs: 60 * 60 * 1000,
    cooldownMs: 5 * 1000,
  },
  password_reset: {
    emailMax: 5,
    ipMax: 20,
    windowMs: 60 * 60 * 1000,
    cooldownMs: 30 * 1000,
  },
};

/**
 * Records an allowed account request and returns false when its email/IP budget
 * or per-email cooldown is exhausted. All values remain query parameters.
 */
export async function recordAllowedAuthRequest(
  requestType: AuthRequestType,
  emailKey: string,
  ip: string | null,
) {
  const limits = AUTH_REQUEST_LIMITS[requestType];
  await query(
    `DELETE FROM customer_auth_requests
     WHERE requested_at < NOW() - INTERVAL '24 hours'`,
  );
  const windowStart = new Date(Date.now() - limits.windowMs);
  const cooldownStart = new Date(Date.now() - limits.cooldownMs);
  const result = await query<{ id: string }>(
    `INSERT INTO customer_auth_requests (request_type, email_key, ip)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1
       FROM customer_auth_requests
       WHERE request_type = $1
         AND email_key = $2
         AND requested_at >= $4
     )
       AND (
         SELECT COUNT(*)
         FROM customer_auth_requests
         WHERE request_type = $1
           AND email_key = $2
           AND requested_at >= $5
       ) < $6
       AND (
         $3::text IS NULL
         OR (
           SELECT COUNT(*)
           FROM customer_auth_requests
           WHERE request_type = $1
             AND ip = $3
             AND requested_at >= $5
         ) < $7
       )
     RETURNING id`,
    [
      requestType,
      emailKey,
      ip,
      cooldownStart,
      windowStart,
      limits.emailMax,
      limits.ipMax,
    ],
  );
  return Boolean(result.rows[0]);
}

export async function isCustomerLoginThrottled(emailKey: string, ip: string | null) {
  const since = new Date(Date.now() - WINDOW_MS);
  const byEmail = await query<AttemptRow>(
    `SELECT COUNT(*)::text AS failure_count
     FROM customer_login_attempts
     WHERE email_key = $1
       AND success = FALSE
       AND attempted_at >= $2`,
    [emailKey, since],
  );
  if (Number(byEmail.rows[0]?.failure_count ?? 0) >= MAX_FAILURES) {
    return true;
  }
  if (!ip) {
    return false;
  }
  const byIp = await query<AttemptRow>(
    `SELECT COUNT(*)::text AS failure_count
     FROM customer_login_attempts
     WHERE ip = $1
       AND success = FALSE
       AND attempted_at >= $2`,
    [ip, since],
  );
  return Number(byIp.rows[0]?.failure_count ?? 0) >= MAX_FAILURES;
}

export async function recordCustomerLoginAttempt(
  emailKey: string,
  ip: string | null,
  success: boolean,
) {
  await query(
    `INSERT INTO customer_login_attempts (email_key, ip, success)
     VALUES ($1, $2, $3)`,
    [emailKey, ip, success],
  );
}

/** Cooldown + window cap for verification email resend (spam guard). */
export async function isVerificationResendThrottled(userId: string) {
  const latest = await query<CreatedAtRow>(
    `SELECT created_at
     FROM customer_auth_tokens
     WHERE user_id = $1
       AND purpose = 'email_verify'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const lastAt = latest.rows[0]?.created_at;
  if (
    lastAt &&
    Date.now() - new Date(lastAt).getTime() < VERIFY_RESEND_COOLDOWN_MS
  ) {
    return true;
  }

  const since = new Date(Date.now() - VERIFY_RESEND_WINDOW_MS);
  const counted = await query<CountRow>(
    `SELECT COUNT(*)::text AS c
     FROM customer_auth_tokens
     WHERE user_id = $1
       AND purpose = 'email_verify'
       AND created_at >= $2`,
    [userId, since],
  );
  return Number(counted.rows[0]?.c ?? 0) >= VERIFY_RESEND_MAX_PER_WINDOW;
}
