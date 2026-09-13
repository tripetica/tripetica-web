"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { issueDriverPortalOtp, verifyDriverPortalOtp } from "@/lib/driver-portal/otp";
import {
  clearDriverPortalSessionCookie,
  createDriverPortalSession,
  deleteDriverPortalSessionByToken,
  writeDriverPortalSessionCookie,
} from "@/lib/driver-portal/session";
import { DRIVER_PORTAL_PATH, DRIVER_PORTAL_SESSION_COOKIE } from "@/lib/driver-portal/constants";
import { requestClientIp } from "@/lib/security/request-client-ip";

export type DriverPortalSendState = {
  error: "invalid-email" | "not-found" | "throttled" | "mail-failed" | "failed" | null;
  ok: boolean;
  email: string;
};

export type DriverPortalVerifyState = {
  error: "invalid" | "expired" | "used" | "locked" | "failed" | null;
  ok: boolean;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

export async function sendDriverPortalCodeAction(
  _prev: DriverPortalSendState,
  formData: FormData,
): Promise<DriverPortalSendState> {
  const email = String(formData.get("email") ?? "");
  try {
    const result = await issueDriverPortalOtp({
      email,
      ip: await requestClientIp(),
    });
    if (!result.ok) {
      return { error: result.error, ok: false, email };
    }
    return { error: null, ok: true, email };
  } catch {
    return { error: "failed", ok: false, email };
  }
}

export async function verifyDriverPortalCodeAction(
  _prev: DriverPortalVerifyState,
  formData: FormData,
): Promise<DriverPortalVerifyState> {
  const locale = localeFromForm(formData);
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  try {
    const result = await verifyDriverPortalOtp({ email, code });
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    const session = await createDriverPortalSession(result.driverId);
    await writeDriverPortalSessionCookie(session.token, session.expiresAt);
  } catch {
    return { error: "failed", ok: false };
  }
  redirect(localizedPath(locale, DRIVER_PORTAL_PATH));
}

export async function logoutDriverPortalAction(formData: FormData) {
  const locale = localeFromForm(formData);
  const token = (await cookies()).get(DRIVER_PORTAL_SESSION_COOKIE)?.value;
  if (token) {
    await deleteDriverPortalSessionByToken(token);
  }
  await clearDriverPortalSessionCookie();
  redirect(localizedPath(locale, DRIVER_PORTAL_PATH));
}
