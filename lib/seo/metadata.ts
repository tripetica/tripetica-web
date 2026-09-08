import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

const PRODUCTION_SITE_URL = "https://tripetica.com";
const PRODUCTION_HOSTNAME = "tripetica.com";

export function getSiteUrl(): URL {
  return new URL(PRODUCTION_SITE_URL);
}

export function resolveProductionSeoEnvironment(
  nodeEnv: string | undefined,
  configuredUrl: string | undefined,
): boolean {
  if (nodeEnv !== "production") {
    return false;
  }

  if (!configuredUrl?.trim()) {
    throw new Error(
      "APP_BASE_URL or NEXT_PUBLIC_SITE_URL must be configured for a production build",
    );
  }

  try {
    return new URL(configuredUrl).hostname === PRODUCTION_HOSTNAME;
  } catch (error) {
    throw new Error("Invalid production site URL configuration", { cause: error });
  }
}

export function isProductionSeoEnvironment() {
  return resolveProductionSeoEnvironment(
    process.env.NODE_ENV,
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
  );
}

export const publicIndexRobots = { index: true, follow: true } as const;
export const noindexFollowRobots = { index: false, follow: true } as const;
export const noindexNofollowRobots = { index: false, follow: false } as const;

export function publicPageSeo(
  locale: Locale,
  pathWithoutLocale: string = "/",
): Pick<Metadata, "alternates" | "robots"> {
  return {
    alternates: localeAlternates(locale, pathWithoutLocale),
    robots: publicIndexRobots,
  };
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
