import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { query } from "@/lib/db/postgres";
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_MAX_AGE_SECONDS,
} from "@/lib/account/constants";

export { ACCOUNT_SESSION_COOKIE, ACCOUNT_SESSION_MAX_AGE_SECONDS };

export type AccountActor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  phoneCountryCode: string | null;
  nationalityCode: string | null;
  emailVerifiedAt: string | null;
  pendingEmail: string | null;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  phone_country_code: string | null;
  nationality_code: string | null;
  email_verified_at: Date | null;
  pending_email: string | null;
  is_active: boolean;
};

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function cookieSecure() {
  const forwarded = (await headers()).get("x-forwarded-proto");
  return process.env.NODE_ENV === "production" || forwarded === "https";
}

export async function createAccountSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + ACCOUNT_SESSION_MAX_AGE_SECONDS * 1000);
  await query(
    `INSERT INTO customer_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
  return { token, expiresAt };
}

export async function deleteAccountSessionByToken(token: string) {
  await query(`DELETE FROM customer_sessions WHERE token_hash = $1`, [
    hashSessionToken(token),
  ]);
}

export async function deleteAccountSessionsForUser(userId: string) {
  await query(`DELETE FROM customer_sessions WHERE user_id = $1`, [userId]);
}

export async function writeAccountSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set({
    name: ACCOUNT_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearAccountSessionCookie() {
  const jar = await cookies();
  jar.set({
    name: ACCOUNT_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export const getAccountActor = cache(async (): Promise<AccountActor | null> => {
  const token = (await cookies()).get(ACCOUNT_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const result = await query<SessionRow>(
    `SELECT
        s.id AS session_id,
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.phone_country_code,
        u.nationality_code,
        u.email_verified_at,
        u.pending_email,
        u.is_active
     FROM customer_sessions s
     JOIN customer_users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
     LIMIT 1`,
    [hashSessionToken(token)],
  );
  const row = result.rows[0];
  if (!row || !row.is_active) {
    return null;
  }
  await query(`UPDATE customer_sessions SET last_seen_at = NOW() WHERE id = $1`, [
    row.session_id,
  ]);
  return {
    id: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    phoneCountryCode: row.phone_country_code,
    nationalityCode: row.nationality_code,
    emailVerifiedAt: row.email_verified_at ? row.email_verified_at.toISOString() : null,
    pendingEmail: row.pending_email,
  };
});
