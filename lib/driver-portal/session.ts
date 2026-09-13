import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { query } from "@/lib/db/postgres";
import {
  DRIVER_PORTAL_SESSION_COOKIE,
  DRIVER_PORTAL_SESSION_MAX_AGE_SECONDS,
} from "@/lib/driver-portal/constants";
import { cookieSecure } from "@/lib/partner/session";

export { DRIVER_PORTAL_SESSION_COOKIE, DRIVER_PORTAL_SESSION_MAX_AGE_SECONDS };

export type DriverPortalActor = {
  driverId: string;
  partnerId: string;
  email: string;
  firstName: string;
  lastName: string;
};

type SessionRow = {
  session_id: string;
  driver_id: string;
  partner_id: string;
  email: string;
  first_name: string;
  last_name: string;
};

export function hashDriverPortalSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createDriverPortalSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function createDriverPortalSession(driverId: string) {
  const token = createDriverPortalSessionToken();
  const tokenHash = hashDriverPortalSessionToken(token);
  const expiresAt = new Date(Date.now() + DRIVER_PORTAL_SESSION_MAX_AGE_SECONDS * 1000);
  await query(
    `INSERT INTO driver_portal_sessions (driver_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [driverId, tokenHash, expiresAt],
  );
  return { token, expiresAt };
}

export async function deleteDriverPortalSessionByToken(token: string) {
  await query(`DELETE FROM driver_portal_sessions WHERE token_hash = $1`, [
    hashDriverPortalSessionToken(token),
  ]);
}

export async function writeDriverPortalSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set({
    name: DRIVER_PORTAL_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearDriverPortalSessionCookie() {
  const jar = await cookies();
  jar.set({
    name: DRIVER_PORTAL_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export const getDriverPortalActor = cache(async (): Promise<DriverPortalActor | null> => {
  const token = (await cookies()).get(DRIVER_PORTAL_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const result = await query<SessionRow>(
    `SELECT
        s.id AS session_id,
        d.id AS driver_id,
        d.partner_id,
        d.email,
        d.first_name,
        d.last_name
     FROM driver_portal_sessions s
     JOIN partner_drivers d ON d.id = s.driver_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
       AND d.deleted_at IS NULL
       AND d.status = 'active'
       AND d.email IS NOT NULL
     LIMIT 1`,
    [hashDriverPortalSessionToken(token)],
  );
  const row = result.rows[0];
  if (!row?.email) {
    return null;
  }
  await query(`UPDATE driver_portal_sessions SET last_seen_at = NOW() WHERE id = $1`, [
    row.session_id,
  ]);
  return {
    driverId: row.driver_id,
    partnerId: row.partner_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
  };
});
