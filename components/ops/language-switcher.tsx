"use client";

import { localeCatalog, locales, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

type OpsLanguageSwitcherProps = {
  locale: Locale;
  pathWithoutLocale: string;
  label: string;
};

export function OpsLanguageSwitcher({
  locale,
  pathWithoutLocale,
  label,
}: OpsLanguageSwitcherProps) {
  return (
    <nav className="ops-lang" aria-label={label}>
      {locales.map((item) => (
        <a
          key={item}
          href={localizedPath(item, pathWithoutLocale)}
          className={item === locale ? "is-current" : undefined}
          aria-current={item === locale ? "page" : undefined}
        >
          {localeCatalog[item].code}
        </a>
      ))}
    </nav>
  );
}
