import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export function getSiteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

export function localeAlternates(
  locale: Locale,
  pathWithoutLocale: string = "/",
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};

  for (const supported of locales) {
    languages[supported] = localizedPath(supported, pathWithoutLocale);
  }

  languages["x-default"] = localizedPath(defaultLocale, pathWithoutLocale);

  return {
    canonical: localizedPath(locale, pathWithoutLocale),
    languages,
  };
}
