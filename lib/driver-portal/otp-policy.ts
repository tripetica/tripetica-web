import {
  PARTNER_EMAIL_CODE_TTL_MS,
  PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS,
  PARTNER_EMAIL_RESEND_COOLDOWN_MS,
  PARTNER_EMAIL_RESEND_MAX_PER_WINDOW,
  PARTNER_EMAIL_RESEND_WINDOW_MS,
  classifyPartnerEmailChallenge,
  createPartnerEmailCodeSalt,
  generatePartnerEmailCode,
  hashPartnerEmailCode,
  isPartnerEmailCodeFormatValid,
  partnerEmailCodesEqual,
} from "@/lib/partner/email-verification-policy";

export const DRIVER_PORTAL_CODE_TTL_MS = PARTNER_EMAIL_CODE_TTL_MS;
export const DRIVER_PORTAL_MAX_VERIFY_ATTEMPTS = PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS;
export const DRIVER_PORTAL_RESEND_COOLDOWN_MS = PARTNER_EMAIL_RESEND_COOLDOWN_MS;
export const DRIVER_PORTAL_RESEND_MAX_PER_WINDOW = PARTNER_EMAIL_RESEND_MAX_PER_WINDOW;
export const DRIVER_PORTAL_RESEND_WINDOW_MS = PARTNER_EMAIL_RESEND_WINDOW_MS;

export const generateDriverPortalCode = generatePartnerEmailCode;
export const createDriverPortalCodeSalt = createPartnerEmailCodeSalt;
export const hashDriverPortalCode = hashPartnerEmailCode;
export const driverPortalCodesEqual = partnerEmailCodesEqual;
export const isDriverPortalCodeFormatValid = isPartnerEmailCodeFormatValid;

export function classifyDriverPortalChallenge(input: {
  expiresAt: Date | string;
  consumedAt: Date | string | null;
  attemptCount: number;
  now?: Date;
}) {
  return classifyPartnerEmailChallenge({
    email: "same@example.com",
    expectedEmail: "same@example.com",
    expiresAt: input.expiresAt,
    verifiedAt: null,
    consumedAt: input.consumedAt,
    attemptCount: input.attemptCount,
    now: input.now,
  });
}
