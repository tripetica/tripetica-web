import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export type UetdsSubnavItem = {
  href: string;
  label: string;
};

type UetdsSubnavProps = {
  locale: Locale;
  ariaLabel: string;
  pathWithoutLocale: string;
  items: readonly UetdsSubnavItem[];
};

export function isUetdsNotificationsListHref(href: string) {
  return href.endsWith("/notifications") && !href.endsWith("/notifications/new");
}

export function isUetdsSubnavCurrent(href: string, pathWithoutLocale: string) {
  if (isUetdsNotificationsListHref(href)) {
    return pathWithoutLocale === href;
  }
  return pathWithoutLocale === href || pathWithoutLocale.startsWith(`${href}/`);
}

export function UetdsSubnav({
  locale,
  ariaLabel,
  pathWithoutLocale,
  items,
}: UetdsSubnavProps) {
  return (
    <nav className="ops-partner-tabs" aria-label={ariaLabel}>
      {items.map((item) => {
        const current = isUetdsSubnavCurrent(item.href, pathWithoutLocale);
        return (
          <a
            key={item.href}
            href={localizedPath(locale, item.href)}
            className={current ? "is-current" : undefined}
            aria-current={current ? "page" : undefined}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
