import { type Locale } from "@/lib/i18n/config";
import { normalizeIso2 } from "@/lib/geo/countries";

/** Locale → default ISO 3166-1 alpha-2 for phone code and country/nationality. */
export const LOCALE_DEFAULT_COUNTRY_ISO2: Record<Locale, string> = {
  ru: "RU",
  tr: "TR",
  en: "GB",
};

export function defaultCountryIso2ForLocale(locale: Locale): string {
  return LOCALE_DEFAULT_COUNTRY_ISO2[locale];
}

/**
 * Prefer an already chosen / stored ISO code; otherwise use the locale default.
 * Never invent a localized country name — callers keep ISO codes in state/DB.
 */
export function resolveCountryIso2WithLocaleDefault(
  existing: string | null | undefined,
  locale: Locale,
): string {
  return normalizeIso2(existing) ?? defaultCountryIso2ForLocale(locale);
}
