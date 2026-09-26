export { MIN_PASSWORD_LENGTH as PARTNER_MIN_PASSWORD_LENGTH } from "@/lib/security/password-policy";

export const PARTNER_SESSION_COOKIE = "tripetica_partner_session";
/** Absolute idle window after login or last successful sliding renewal. */
export const PARTNER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/**
 * When remaining life falls below this threshold, extend expires_at (and cookie)
 * to now + PARTNER_SESSION_MAX_AGE_SECONDS. Avoids writing on every request.
 */
export const PARTNER_SESSION_RENEW_WITHIN_SECONDS = 60 * 60 * 24 * 7;

export const PARTNER_CODE_PREFIX = "PTR";
export const PARTNER_CODE_MAX_SEQ = 9999;

export const DEV_PRIMARY_PARTNER_NAME = "Tripetica";
export const DEV_PRIMARY_PARTNER_USER_EMAIL = "info@tripetica.com";

export type PartnerStatus = "pending" | "active" | "inactive";
export type PartnerUserRole = "admin";
export type PartnerBusinessType = "individual" | "company";
export type PartnerPriorityLevel = 1 | 2 | 3;

export const PARTNER_STATUSES = ["pending", "active", "inactive"] as const;
export const PARTNER_BUSINESS_TYPES = ["individual", "company"] as const;
export const PARTNER_PRIORITY_LEVELS = [1, 2, 3] as const;
export const PARTNER_DEFAULT_COUNTRY_CODE = "TR";
export const PARTNER_NAME_MAX_LENGTH = 240;
export const PARTNER_ADDRESS_MAX_LENGTH = 500;
export const PARTNER_TAX_OFFICE_MAX_LENGTH = 120;
export const PARTNER_TAX_NUMBER_MAX_LENGTH = 32;
export const PARTNER_CONTACT_NAME_MAX_LENGTH = 80;
