import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { query } from "@/lib/db/postgres";
import {
  hasPermission,
  permissionsForRole,
  type OpsPermission,
  type OpsRole,
} from "@/lib/ops/permissions";
import {
  OPS_SESSION_COOKIE,
  OPS_SESSION_MAX_AGE_SECONDS,
} from "@/lib/ops/constants";

export { OPS_SESSION_COOKIE, OPS_SESSION_MAX_AGE_SECONDS };

export type OpsActor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: OpsRole;
  permissions: OpsPermission[];
};

type SessionRow = {
  session_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
};

type PermissionRow = {
  permission_key: string;
};

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function createOpsSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + OPS_SESSION_MAX_AGE_SECONDS * 1000);
  await query(
    `INSERT INTO ops_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
  return { token, expiresAt };
}

export async function deleteOpsSessionByToken(token: string) {
  await query(`DELETE FROM ops_sessions WHERE token_hash = $1`, [
    hashSessionToken(token),
  ]);
}

export async function deleteOpsSessionsForUser(userId: string) {
  await query(`DELETE FROM ops_sessions WHERE user_id = $1`, [userId]);
}

export async function cookieSecure() {
  const forwarded = (await headers()).get("x-forwarded-proto");
  return process.env.NODE_ENV === "production" || forwarded === "https";
}

export async function writeOpsSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set({
    name: OPS_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearOpsSessionCookie() {
  const jar = await cookies();
  jar.set({
    name: OPS_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export const getOpsActor = cache(async (): Promise<OpsActor | null> => {
  const token = (await cookies()).get(OPS_SESSION_COOKIE)?.value;
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
        u.role,
        u.is_active
     FROM ops_sessions s
     JOIN ops_users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
     LIMIT 1`,
    [hashSessionToken(token)],
  );
  const row = result.rows[0];
  if (!row || !row.is_active || (row.role !== "owner" && row.role !== "employee")) {
    return null;
  }
  const grants = await query<PermissionRow>(
    `SELECT permission_key
     FROM ops_user_permissions
     WHERE user_id = $1`,
    [row.user_id],
  );
  await query(
    `UPDATE ops_sessions SET last_seen_at = NOW() WHERE id = $1`,
    [row.session_id],
  );
  const role = row.role as OpsRole;
  return {
    id: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role,
    permissions: permissionsForRole(
      role,
      grants.rows.map((item) => item.permission_key),
    ),
  };
});

export async function requireOpsActor() {
  return getOpsActor();
}

export function actorCan(actor: OpsActor, permission: OpsPermission) {
  return hasPermission(actor.role, actor.permissions, permission);
}
