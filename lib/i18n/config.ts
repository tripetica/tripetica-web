export const locales = ["ru", "en", "tr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

export const localeCatalog: Record<
  Locale,
  { code: string; nativeName: string; flag: string }
> = {
  ru: { code: "RU", nativeName: "Русский", flag: "🇷🇺" },
  en: { code: "EN", nativeName: "English", flag: "🇬🇧" },
  tr: { code: "TR", nativeName: "Türkçe", flag: "🇹🇷" },
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
