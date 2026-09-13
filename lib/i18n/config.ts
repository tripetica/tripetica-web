export const locales = ["ru", "en", "tr", "ar"] as const;

export type Locale = (typeof locales)[number];

export const panelLocales = ["ru", "en", "tr"] as const;

export type PanelLocale = (typeof panelLocales)[number];

export const defaultLocale: Locale = "ru";

export const localeCatalog: Record<
  Locale,
  { code: string; nativeName: string; flag: string }
> = {
  ru: { code: "RU", nativeName: "Русский", flag: "🇷🇺" },
  en: { code: "EN", nativeName: "English", flag: "🇬🇧" },
  tr: { code: "TR", nativeName: "Türkçe", flag: "🇹🇷" },
  ar: { code: "AR", nativeName: "العربية", flag: "🇸🇦" },
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function isPanelLocale(value: string): value is PanelLocale {
  return (panelLocales as readonly string[]).includes(value);
}

export function asPanelLocale(locale: Locale): PanelLocale {
  return isPanelLocale(locale) ? locale : "en";
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function intlLocaleTag(locale: Locale): string {
  if (locale === "ru") {
    return "ru-RU";
  }
  if (locale === "tr") {
    return "tr-TR";
  }
  if (locale === "ar") {
    return "ar-SA";
  }
  return "en-GB";
}

export function withEnglishArabicFallback<T extends { en: unknown }>(
  copy: T,
): T & { ar: T["en"] } {
  return { ...copy, ar: copy.en };
}
