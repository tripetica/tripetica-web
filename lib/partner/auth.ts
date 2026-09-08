import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db/postgres";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  PARTNER_SESSION_COOKIE,
  type PartnerStatus,
} from "@/lib/partner/constants";
import { normalizePartnerEmail } from "@/lib/partner/email";
import { partnerLoginDenialAfterPassword } from "@/lib/partner/login-status";
import { isPartnerAccountLoginEligible } from "@/lib/partner/policy";
import {
  isPartnerLoginThrottled,
  recordPartnerLoginAttempt,
} from "@/lib/partner/rate-limit";
import {
  clearPartnerSessionCookie,
  createPartnerSession,
  deletePartnerSessionByToken,
  getPartnerActor,
  writePartnerSessionCookie,
  type PartnerActor,
} from "@/lib/partner/session";
import { safePartnerReturnPath } from "@/lib/partner/push/return-path";
import { requestClientIp } from "@/lib/security/request-client-ip";
import { verifyPassword } from "@/lib/security/password";

type UserRow = {
  id: string;
  password_hash: string;
  user_status: PartnerStatus;
  partner_status: PartnerStatus;
  partner_deleted: boolean;
  must_change_password: boolean;
};

export function partnerHomePath(locale: Locale, actor: PartnerActor) {
  if (actor.mustChangePassword) {
    return localizedPath(locale, "/partner/change-password");
  }
  return localizedPath(locale, "/partner/jobs");
}

export async function loginPartnerUser(emailRaw: string, password: string) {
  const email = normalizePartnerEmail(emailRaw);
  const ip = await requestClientIp();
  if (!email || !password) {
    return { ok: false as const, reason: "invalid" as const };
  }
  if (await isPartnerLoginThrottled(email, ip)) {
    return { ok: false as const, reason: "throttled" as const };
  }
  const result = await query<UserRow>(
    `SELECT
        u.id,
        u.password_hash,
        u.status AS user_status,
        p.status AS partner_status,
        (p.deleted_at IS NOT NULL) AS partner_deleted,
        u.must_change_password
     FROM partner_users u
     JOIN partners p ON p.id = u.partner_id
     WHERE lower(u.email) = $1
     LIMIT 1`,
    [email],
  );
  const user = result.rows[0];
  const hash = user?.password_hash ?? "";
  const passwordOk = await verifyPassword(password, hash);
  if (!user || !passwordOk) {
    await recordPartnerLoginAttempt(email, ip, false);
    return { ok: false as const, reason: "invalid" as const };
  }
  const denial = partnerLoginDenialAfterPassword({
    userStatus: user.user_status,
    partnerStatus: user.partner_status,
    deleted: user.partner_deleted,
  });
  if (denial) {
    await recordPartnerLoginAttempt(email, ip, false);
    return { ok: false as const, reason: denial };
  }
  if (
    !isPartnerAccountLoginEligible({
      userStatus: user.user_status,
      partnerStatus: user.partner_status,
    })
  ) {
    await recordPartnerLoginAttempt(email, ip, false);
    return { ok: false as const, reason: "invalid" as const };
  }
  await recordPartnerLoginAttempt(email, ip, true);
  const session = await createPartnerSession(user.id);
  await query(`UPDATE partner_users SET last_login_at = NOW() WHERE id = $1`, [
    user.id,
  ]);
  await writePartnerSessionCookie(session.token, session.expiresAt);
  return {
    ok: true as const,
    mustChangePassword: user.must_change_password,
  };
}

export async function logoutPartnerUser() {
  const token = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value;
  if (token) {
    await deletePartnerSessionByToken(token);
  }
  await clearPartnerSessionCookie();
}

export async function requirePartnerPage(locale: Locale) {
  const actor = await getPartnerActor();
  if (!actor) {
    const pathname = (await headers()).get("x-partner-pathname") ?? "";
    const next = safePartnerReturnPath(pathname, locale);
    const login = localizedPath(locale, "/partner/login");
    redirect(next ? `${login}?next=${encodeURIComponent(next)}` : login);
  }
  if (actor.mustChangePassword) {
    redirect(localizedPath(locale, "/partner/change-password"));
  }
  return actor;
}

export async function requirePartnerPasswordChangePage(locale: Locale) {
  const actor = await getPartnerActor();
  if (!actor) {
    redirect(localizedPath(locale, "/partner/login"));
  }
  if (!actor.mustChangePassword) {
    redirect(localizedPath(locale, "/partner/jobs"));
  }
  return actor;
}
