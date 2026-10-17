"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DRIVER_PORTAL_PATH } from "@/lib/driver-portal/constants";
import { type DriverPortalCopy } from "@/lib/driver-portal/copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export function DriverPortalNav({
  locale,
  driverName,
  copy,
  showGps = false,
  showUetds = false,
  uetdsHrefPath = "/driver/uetds",
}: {
  locale: Locale;
  driverName: string;
  copy: DriverPortalCopy;
  showGps?: boolean;
  showUetds?: boolean;
  uetdsHrefPath?: "/driver/uetds" | "/driver/uetds/new";
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const jobsHref = localizedPath(locale, DRIVER_PORTAL_PATH);
  const gpsHref = localizedPath(locale, "/driver/gps");
  const uetdsHref = localizedPath(locale, uetdsHrefPath);
  const uetdsRoot = localizedPath(locale, "/driver/uetds");
  const jobsCurrent = pathname === jobsHref || (pathname.startsWith(`${jobsHref}/`) && !pathname.startsWith(uetdsRoot) && !pathname.startsWith(gpsHref));
  const gpsCurrent = pathname === gpsHref || pathname.startsWith(`${gpsHref}/`);
  const uetdsCurrent = pathname === uetdsRoot || pathname.startsWith(`${uetdsRoot}/`);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="ops-nav-root">
      <button
        type="button"
        className="ops-menu-btn"
        aria-expanded={open}
        aria-controls="driver-nav-drawer"
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
        id="driver-nav-drawer"
        className={`ops-nav-drawer partner-nav-drawer${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        {driverName ? <p className="partner-nav-identity">{driverName}</p> : null}
        <nav className="ops-nav" aria-label={copy.menu}>
          <a className={jobsCurrent ? "is-current" : undefined} href={jobsHref} aria-current={jobsCurrent ? "page" : undefined}>
            {copy.jobsNav}
          </a>
          {showGps ? (
            <a className={gpsCurrent ? "is-current" : undefined} href={gpsHref} aria-current={gpsCurrent ? "page" : undefined}>
              {copy.gps}
            </a>
          ) : null}
          {showUetds ? (
            <a className={uetdsCurrent ? "is-current" : undefined} href={uetdsHref} aria-current={uetdsCurrent ? "page" : undefined}>
              {copy.uetds}
            </a>
          ) : null}
        </nav>
      </aside>
    </div>
  );
}
