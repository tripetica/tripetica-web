import { type Locale, isLocale } from "@/lib/i18n/config";

const BLOCKED_PREFIXES = ["/ops", "/api", "/_next"];

/**
 * Accept only same-site relative paths without protocol/host tricks.
 * Returns pathWithoutLocale (no locale prefix) or null.
 */
export function sanitizeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  if (value.includes("://") || value.includes("\\")) {
    return null;
  }
  const pathOnly = value.split(/[?#]/, 1)[0] ?? value;
  const lower = pathOnly.toLowerCase();
  if (BLOCKED_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`))) {
    return null;
  }
  // Strip accidental locale prefix so callers can re-localize.
  const parts = pathOnly.split("/").filter(Boolean);
  if (parts[0] && isLocale(parts[0])) {
    const rest = `/${parts.slice(1).join("/")}`;
    return rest === "/" ? "/" : rest;
  }
  return pathOnly || "/";
}

export function accountLoginPath(locale: Locale, returnPath?: string | null) {
  const safe = sanitizeReturnPath(returnPath ?? null);
  const base = `/${locale}/account/login`;
  if (!safe || safe === "/account" || safe.startsWith("/account/")) {
    return base;
  }
  return `${base}?next=${encodeURIComponent(safe)}`;
}

/** True for /account and all account subpaths (path without locale). */
export function isAccountAreaPath(pathWithoutLocale: string | null | undefined) {
  const path = (pathWithoutLocale ?? "/").trim() || "/";
  return path === "/account" || path.startsWith("/account/");
}
