import { type Locale } from "./config";

/** Path after the locale prefix, e.g. `/` or `/about`. */
export function localizedPath(
  locale: Locale,
  pathWithoutLocale: string = "/",
): string {
  if (!pathWithoutLocale || pathWithoutLocale === "/") {
    return `/${locale}`;
  }

  const suffix = pathWithoutLocale.startsWith("/")
    ? pathWithoutLocale
    : `/${pathWithoutLocale}`;

  return `/${locale}${suffix}`;
}
