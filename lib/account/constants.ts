export { MIN_PASSWORD_LENGTH as ACCOUNT_MIN_PASSWORD_LENGTH } from "@/lib/security/password-policy";

export const ACCOUNT_SESSION_COOKIE = "tripetica_customer_session";
export const ACCOUNT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const ACCOUNT_VERIFY_TTL_MS = 1000 * 60 * 60 * 24;
export const ACCOUNT_PASSWORD_RESET_TTL_MS = 1000 * 60 * 60;
export const ACCOUNT_EMAIL_CHANGE_TTL_MS = 1000 * 60 * 60 * 24;
