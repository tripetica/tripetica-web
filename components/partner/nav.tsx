"use client";

import { useEffect, useState } from "react";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type PartnerNavItem } from "@/lib/partner/nav";

type PartnerNavProps = {
  locale: Locale;
  copy: PartnerCopy;
  items: PartnerNavItem[];
  pathWithoutLocale: string;
  partnerName: string;
};

export function PartnerNav({
  locale,
  copy,
  items,
  pathWithoutLocale,
  partnerName,
}: PartnerNavProps) {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(pathWithoutLocale);

  if (currentPath !== pathWithoutLocale) {
    setCurrentPath(pathWithoutLocale);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="ops-nav-root">
      <button
        type="button"
        className="ops-menu-btn"
        aria-expanded={open}
        aria-controls="partner-nav-drawer"
        onClick={() => setOpen((current) => !current)}
      >
        {copy.menu}
      </button>
      {open ? (
        <button
          type="button"
          className="ops-nav-overlay"
          aria-label={copy.closeMenu}
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        id="partner-nav-drawer"
        className={`ops-nav-drawer partner-nav-drawer${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <p className="partner-nav-identity">{partnerName}</p>
        <nav className="ops-nav" aria-label={copy.panelName}>
          {items.map((item) => {
            const href = localizedPath(locale, item.href);
            const current =
              pathWithoutLocale === item.href ||
              pathWithoutLocale.startsWith(`${item.href}/`);
            return (
              <a
                key={item.href}
                href={href}
                className={current ? "is-current" : undefined}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {copy[item.labelKey]}
              </a>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
