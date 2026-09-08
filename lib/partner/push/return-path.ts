import { isLocale, type Locale } from "@/lib/i18n/config";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ROOTS = new Set([
  "jobs",
  "accepted",
  "drivers",
  "vehicles",
  "profile",
  "password",
  "employer-billing",
]);

export function safePartnerReturnPath(
  raw: string | null | undefined,
  locale: Locale,
): string | null {
  if (!raw) {
    return null;
  }
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (
    !decoded.startsWith("/") ||
    decoded.includes("//") ||
    decoded.includes("\\") ||
    decoded.includes("..") ||
    decoded.includes("@") ||
    decoded.includes(":")
  ) {
    return null;
  }
  const [pathOnly] = decoded.split(/[?#]/);
  const parts = pathOnly.split("/").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) {
    return null;
  }
  const pathLocale = parts[0];
  if (!isLocale(pathLocale) || pathLocale !== locale) {
    return null;
  }
  if (parts[1] !== "partner") {
    return null;
  }
  const section = parts[2];
  if (!section || !ALLOWED_ROOTS.has(section)) {
    return null;
  }
  if (parts.length === 3) {
    return `/${pathLocale}/partner/${section}`;
  }
  const id = parts[3];
  if (
    (section === "jobs" ||
      section === "accepted" ||
      section === "drivers" ||
      section === "vehicles") &&
    UUID_RE.test(id)
  ) {
    return `/${pathLocale}/partner/${section}/${id}`;
  }
  return null;
}
