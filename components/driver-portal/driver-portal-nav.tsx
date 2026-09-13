import { logoutDriverPortalAction } from "@/lib/driver-portal/actions";
import { DRIVER_PORTAL_PATH } from "@/lib/driver-portal/constants";
import { driverPortalCopy } from "@/lib/driver-portal/copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export function DriverPortalNav({
  locale,
  action = "logout",
}: {
  locale: Locale;
  action?: "logout" | "back";
}) {
  const homeHref = localizedPath(locale, DRIVER_PORTAL_PATH);
  return (
    <div className={`driver-portal-nav ${action === "back" ? "is-end" : "is-start"}`}>
      {action === "back" ? (
        <a className="driver-portal-logout" href={homeHref}>
          {driverPortalCopy.back}
        </a>
      ) : (
        <form action={logoutDriverPortalAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="driver-portal-logout">
            {driverPortalCopy.logout}
          </button>
        </form>
      )}
    </div>
  );
}
