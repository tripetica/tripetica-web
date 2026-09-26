import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { normalizePartnerEmail } from "@/lib/partner/email";

export const PARTNER_EMAIL_CODE_LENGTH = 6;
export const PARTNER_EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
export const PARTNER_EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
export const PARTNER_EMAIL_RESEND_WINDOW_MS = 60 * 60 * 1000;
export const PARTNER_EMAIL_RESEND_MAX_PER_WINDOW = 5;
export const PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS = 5;
export const PARTNER_EMAIL_CHALLENGE_COOKIE = "tripetica_partner_email_challenge";

export type PartnerEmailChallengePurpose =
  | "register"
  | "email_change"
  | "password_reset";

export type PartnerEmailChallengeStatus =
  | "pending"
  | "verified"
  | "consumed"
  | "expired"
  | "used"
  | "locked"
  | "email-mismatch";

export function generatePartnerEmailCode() {
  return String(randomInt(0, 1_000_000)).padStart(PARTNER_EMAIL_CODE_LENGTH, "0");
}

export function createPartnerEmailCodeSalt() {
  return randomBytes(16).toString("hex");
}

export function hashPartnerEmailCode(code: string, salt: string) {
  return createHash("sha256").update(`${salt}:${code.trim()}`).digest("hex");
}

export function partnerEmailCodesEqual(leftHash: string, rightHash: string) {
  const left = Buffer.from(leftHash, "hex");
  const right = Buffer.from(rightHash, "hex");
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function isPartnerEmailCodeFormatValid(code: string) {
  return new RegExp(`^\\d{${PARTNER_EMAIL_CODE_LENGTH}}$`).test(code.trim());
}

export function classifyPartnerEmailChallenge(input: {
  email: string;
  expectedEmail: string;
  expiresAt: Date | string;
  verifiedAt: Date | string | null;
  consumedAt: Date | string | null;
  attemptCount: number;
  now?: Date;
}): PartnerEmailChallengeStatus {
  const now = input.now ?? new Date();
  const expiresAt = new Date(input.expiresAt);
  if (normalizePartnerEmail(input.email) !== normalizePartnerEmail(input.expectedEmail)) {
    return "email-mismatch";
  }
  if (input.consumedAt) {
    return "consumed";
  }
  if (now.getTime() > expiresAt.getTime()) {
    return "expired";
  }
  if (input.attemptCount >= PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS && !input.verifiedAt) {
    return "locked";
  }
  if (input.verifiedAt) {
    return "verified";
  }
  return "pending";
}

export function partnerEmailVerificationStillBound(input: {
  verifiedEmail: string;
  currentEmail: string;
}) {
  return (
    normalizePartnerEmail(input.verifiedEmail) === normalizePartnerEmail(input.currentEmail)
  );
}
