import {
  PARTNER_SESSION_MAX_AGE_SECONDS,
  PARTNER_SESSION_RENEW_WITHIN_SECONDS,
} from "@/lib/partner/constants";

/** True when session is still valid but remaining life is under the renew threshold. */
export function partnerSessionNeedsRenewal(expiresAt: Date, now = new Date()) {
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return false;
  }
  return remainingMs < PARTNER_SESSION_RENEW_WITHIN_SECONDS * 1000;
}

export function nextPartnerSessionExpiry(now = new Date()) {
  return new Date(now.getTime() + PARTNER_SESSION_MAX_AGE_SECONDS * 1000);
}

export function partnerSessionCookieOptions(expiresAt: Date, secure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    expires: expiresAt,
  };
}
