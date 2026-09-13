import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

export const SEO_REDIRECT_STATUS = 301 as const;
export const LEGACY_LANG_GONE_STATUS = 410 as const;

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

export function isRootPath(pathname: string) {
  return stripTrailingSlash(pathname) === "/";
}

/** Any root URL that still carries Bubble's ?lang= query is gone. */
export function isGoneLegacyLangRoot(
  pathname: string,
  searchParams: URLSearchParams,
) {
  return isRootPath(pathname) && searchParams.has("lang");
}

export function resolveSeoRedirect(
  pathname: string,
  searchParams: URLSearchParams,
): { pathname: string; search: string; status: typeof SEO_REDIRECT_STATUS } | null {
  if (isGoneLegacyLangRoot(pathname, searchParams)) {
    return null;
  }

  const localePath = splitLocalePath(stripTrailingSlash(pathname));
  const isRoot = isRootPath(pathname);

  if (!isRoot && !localePath) {
    return null;
  }

  let nextPath = stripTrailingSlash(pathname);

  if (isRoot) {
    nextPath = `/${defaultLocale}`;
  } else if (localePath) {
    nextPath = `/${localePath.locale}${localePath.rest}`;
  }

  nextPath = stripTrailingSlash(nextPath);

  const search = searchParams.toString();
  const nextSearch = search ? `?${search}` : "";
  const currentSearchString = search ? `?${search}` : "";

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
