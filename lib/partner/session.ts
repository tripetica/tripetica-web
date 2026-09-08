import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { query } from "@/lib/db/postgres";
import {
  PARTNER_SESSION_COOKIE,
  PARTNER_SESSION_MAX_AGE_SECONDS,
  type PartnerStatus,
  type PartnerUserRole,
} from "@/lib/partner/constants";
import { isPartnerAccountLoginEligible } from "@/lib/partner/policy";

export { PARTNER_SESSION_COOKIE, PARTNER_SESSION_MAX_AGE_SECONDS };

export type PartnerActor = {
  userId: string;
  partnerId: string;
  email: string;
  role: PartnerUserRole;
  partnerName: string;
  partnerCode: string;
  isPrimaryPartner: boolean;
  mustChangePassword: boolean;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  email: string;
  role: string;
  user_status: PartnerStatus;
  must_change_password: boolean;
  partner_id: string;
  partner_name: string;
  partner_code: string;
  partner_status: PartnerStatus;
  is_primary_partner: boolean;
};

export function hashPartnerSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPartnerSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function createPartnerSession(userId: string) {
  const token = createPartnerSessionToken();
  const tokenHash = hashPartnerSessionToken(token);
  const expiresAt = new Date(Date.now() + PARTNER_SESSION_MAX_AGE_SECONDS * 1000);
  await query(
    `INSERT INTO partner_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
  return { token, expiresAt };
}

export async function deletePartnerSessionByToken(token: string) {
  await query(`DELETE FROM partner_sessions WHERE token_hash = $1`, [
    hashPartnerSessionToken(token),
  ]);
}

export async function deletePartnerSessionsForUser(userId: string) {
  await query(`DELETE FROM partner_sessions WHERE user_id = $1`, [userId]);
}

export async function cookieSecure() {
  const forwarded = (await headers()).get("x-forwarded-proto");
  return process.env.NODE_ENV === "production" || forwarded === "https";
}

export async function writePartnerSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set({
    name: PARTNER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearPartnerSessionCookie() {
  const jar = await cookies();
  jar.set({
    name: PARTNER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export const getPartnerActor = cache(async (): Promise<PartnerActor | null> => {
  const token = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const result = await query<SessionRow>(
    `SELECT
        s.id AS session_id,
        u.id AS user_id,
        u.email,
        u.role,
        u.status AS user_status,
        u.must_change_password,
        p.id AS partner_id,
        p.name AS partner_name,
        p.partner_code,
        p.status AS partner_status,
        p.is_primary_partner
     FROM partner_sessions s
     JOIN partner_users u ON u.id = s.user_id
     JOIN partners p ON p.id = u.partner_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [hashPartnerSessionToken(token)],
  );
  const row = result.rows[0];
  if (
    !row ||
    row.role !== "admin" ||
    !isPartnerAccountLoginEligible({
      userStatus: row.user_status,
      partnerStatus: row.partner_status,
    })
  ) {
    return null;
  }
  await query(`UPDATE partner_sessions SET last_seen_at = NOW() WHERE id = $1`, [
    row.session_id,
  ]);
  return {
    userId: row.user_id,
    partnerId: row.partner_id,
    email: row.email,
    role: row.role,
    partnerName: row.partner_name,
    partnerCode: row.partner_code,
    isPrimaryPartner: row.is_primary_partner,
    mustChangePassword: row.must_change_password,
  };
});
