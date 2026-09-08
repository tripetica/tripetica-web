import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

export const SEO_REDIRECT_STATUS = 301 as const;

const BUBBLE_LANG_TO_LOCALE: Record<string, Locale> = {
  ru: "ru",
  ru_ru: "ru",
  en: "en",
  en_us: "en",
  tr: "tr",
  tr_tr: "tr",
};

export function bubbleLangToLocale(raw: string | null | undefined): Locale | null {
  if (!raw?.trim()) {
    return null;
  }
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_");
  return BUBBLE_LANG_TO_LOCALE[normalized] ?? null;
}

function stripTrailingSlash(pathname: string) {
  if (pathname.length <= 1) {
    return pathname;
  }
  return pathname.replace(/\/+$/, "") || "/";
}

function splitLocalePath(pathname: string): { locale: Locale; rest: string } | null {
  const match = pathname.match(/^\/([A-Za-z]{2})(?=\/|$)/);
  if (!match) {
    return null;
  }
  const locale = match[1].toLowerCase();
  if (!isLocale(locale)) {
    return null;
  }
  return {
    locale,
    rest: pathname.slice(match[0].length),
  };
}

export function resolveSeoRedirect(
  pathname: string,
  searchParams: URLSearchParams,
): { pathname: string; search: string; status: typeof SEO_REDIRECT_STATUS } | null {
  const langLocale = bubbleLangToLocale(searchParams.get("lang"));
  const localePath = splitLocalePath(stripTrailingSlash(pathname));
  const isRoot = stripTrailingSlash(pathname) === "/";

  if (!isRoot && !localePath) {
    return null;
  }

  let nextPath = stripTrailingSlash(pathname);

  if (langLocale) {
    if (isRoot) {
      nextPath = `/${langLocale}`;
    } else if (localePath) {
      nextPath = `/${langLocale}${localePath.rest}`;
    }
  } else if (isRoot) {
    nextPath = `/${defaultLocale}`;
  } else if (localePath) {
    nextPath = `/${localePath.locale}${localePath.rest}`;
  }

  nextPath = stripTrailingSlash(nextPath);

  const nextSearchParams = new URLSearchParams(searchParams);
  if (langLocale) {
    nextSearchParams.delete("lang");
  }
  const search = nextSearchParams.toString();
  const nextSearch = search ? `?${search}` : "";
  const currentSearch = searchParams.toString();
  const currentSearchString = currentSearch ? `?${currentSearch}` : "";

  if (nextPath === pathname && nextSearch === currentSearchString) {
    return null;
  }

  return {
    pathname: nextPath,
    search: nextSearch,
    status: SEO_REDIRECT_STATUS,
  };
}

/** Build a Location that NextURL cannot re-attach a trailing slash to. */
export function seoRedirectHref(
  requestUrl: string,
  redirect: { pathname: string; search: string },
): string {
  return new URL(`${redirect.pathname}${redirect.search}`, requestUrl).toString();
}
