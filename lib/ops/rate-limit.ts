import "server-only";

import { query } from "@/lib/db/postgres";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type AttemptRow = {
  failure_count: string;
};

export async function isLoginThrottled(emailKey: string, ip: string | null) {
  const since = new Date(Date.now() - WINDOW_MS);
  const byEmail = await query<AttemptRow>(
    `SELECT COUNT(*)::text AS failure_count
     FROM ops_login_attempts
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
     FROM ops_login_attempts
     WHERE ip = $1
       AND success = FALSE
       AND attempted_at >= $2`,
    [ip, since],
  );
  return Number(byIp.rows[0]?.failure_count ?? 0) >= MAX_FAILURES;
}

export async function recordLoginAttempt(
  emailKey: string,
  ip: string | null,
  success: boolean,
) {
  await query(
    `INSERT INTO ops_login_attempts (email_key, ip, success)
     VALUES ($1, $2, $3)`,
    [emailKey, ip, success],
  );
}
