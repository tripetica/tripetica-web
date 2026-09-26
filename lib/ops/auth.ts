import "server-only";

import { redirect } from "next/navigation";
import { query } from "@/lib/db/postgres";
import { verifyPassword } from "@/lib/ops/password";
import { isLoginThrottled, recordLoginAttempt } from "@/lib/ops/rate-limit";
import { normalizeOpsEmail } from "@/lib/ops/email";
import {
  actorCan,
  clearOpsSessionCookie,
  createOpsSession,
  deleteOpsSessionByToken,
  getOpsActor,
  OPS_SESSION_COOKIE,
  writeOpsSessionCookie,
  type OpsActor,
} from "@/lib/ops/session";
import { cookies } from "next/headers";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsPermission } from "@/lib/ops/permissions";
import { requestClientIp } from "@/lib/security/request-client-ip";

type UserRow = {
  id: string;
  password_hash: string;
  is_active: boolean;
};

export async function loginOpsUser(emailRaw: string, password: string) {
  const email = normalizeOpsEmail(emailRaw);
  const ip = await requestClientIp();
  if (!email || !password) {
    return { ok: false as const, reason: "invalid" as const };
  }
  if (await isLoginThrottled(email, ip)) {
    return { ok: false as const, reason: "throttled" as const };
  }
  const result = await query<UserRow>(
    `SELECT id, password_hash, is_active
     FROM ops_users
     WHERE lower(email) = $1
     LIMIT 1`,
    [email],
  );
  const user = result.rows[0];
  const hash = user?.password_hash ?? "";
  const passwordOk = await verifyPassword(password, hash);
  if (!user || !user.is_active || !passwordOk) {
    await recordLoginAttempt(email, ip, false);
    return { ok: false as const, reason: "invalid" as const };
  }
  await recordLoginAttempt(email, ip, true);
  const session = await createOpsSession(user.id);
  await query(`UPDATE ops_users SET last_login_at = NOW() WHERE id = $1`, [
    user.id,
  ]);
  await writeOpsSessionCookie(session.token, session.expiresAt);
  return { ok: true as const };
}

export async function logoutOpsUser() {
  const token = (await cookies()).get(OPS_SESSION_COOKIE)?.value;
  if (token) {
    await deleteOpsSessionByToken(token);
  }
  await clearOpsSessionCookie();
}

export function firstOpsHome(locale: Locale, actor: OpsActor) {
  if (actorCan(actor, "reservations.view")) {
    return localizedPath(locale, "/ops/reservations");
  }
  if (actorCan(actor, "processes.view")) {
    return localizedPath(locale, "/ops/processes");
  }
  if (actorCan(actor, "customers.view")) {
    return localizedPath(locale, "/ops/customers");
  }
  if (actorCan(actor, "partners.view")) {
    return localizedPath(locale, "/ops/partners");
  }
  if (actorCan(actor, "uetds.view")) {
    return localizedPath(locale, "/ops/uetds");
  }
  if (actorCan(actor, "users.view")) {
    return localizedPath(locale, "/ops/users");
  }
  return localizedPath(locale, "/ops/login");
}

export async function requireOpsPage(
  locale: Locale,
  permission?: OpsPermission,
) {
  const actor = await getOpsActor();
  if (!actor) {
    redirect(localizedPath(locale, "/ops/login"));
  }
  if (permission && !actorCan(actor, permission)) {
    redirect(firstOpsHome(locale, actor));
  }
  return actor;
}
