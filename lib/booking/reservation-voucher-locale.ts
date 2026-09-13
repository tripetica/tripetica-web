import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

/**
 * Customer voucher language is the reservation's persisted booking locale.
 * Request / ops UI / route locale is only a fallback when that field is missing.
 */
export function resolveReservationCustomerLocale(
  stored: string | null | undefined,
  fallback?: Locale,
): Locale {
  const value = stored?.trim() ?? "";
  if (isLocale(value)) {
    return value;
  }
  if (fallback && isLocale(fallback)) {
    return fallback;
  }
  return defaultLocale;
}
