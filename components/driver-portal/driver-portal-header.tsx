import { DriverGpsPushPrompt } from "@/components/driver-portal/gps-push-prompt";
import { DriverPortalNav } from "@/components/driver-portal/driver-portal-nav";
import { PanelLanguageSwitcher } from "@/components/language-switcher";
import { logoutDriverPortalAction } from "@/lib/driver-portal/actions";
import { DRIVER_PORTAL_PATH } from "@/lib/driver-portal/constants";
import { driverPortalCopyFor } from "@/lib/driver-portal/copy";
import { driverHasGpsAccess, driverHasUetdsAccess } from "@/lib/driver-portal/permissions";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export async function DriverPortalHeader({
  locale,
  title,
  action = "logout",
}: {
  locale: Locale;
  title?: string;
  action?: "logout" | "back";
}) {
  const copy = driverPortalCopyFor(locale);
  const actor = await getDriverPortalActor();
  const driverName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : "";
  const pageTitle = title && title !== copy.panelName ? title : null;

  return (
    <div className="driver-portal-header">
      <header className="partner-topbar driver-portal-topbar">
        <div className="partner-topbar-start">
          <DriverPortalNav
            locale={locale}
            driverName={driverName}
            copy={copy}
            showGps={actor ? driverHasGpsAccess(actor.permissions) : false}
            showUetds={actor ? driverHasUetdsAccess(actor.permissions) : false}
            uetdsHrefPath={actor?.permissions.uetdsList ? "/driver/uetds" : "/driver/uetds/new"}
          />
        </div>
        <p className="partner-topbar-title">{copy.panelName}</p>
        <div className="driver-portal-topbar-end">
          <DriverGpsPushPrompt locale={locale} copy={copy} />
          <PanelLanguageSwitcher locale={locale} label={copy.language} fallbackPath={DRIVER_PORTAL_PATH} />
          {action === "back" ? (
            <a className="ops-btn-ghost" href={localizedPath(locale, DRIVER_PORTAL_PATH)}>
              {copy.back}
            </a>
          ) : null}
          <form action={logoutDriverPortalAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="ops-btn-ghost">
              {copy.logout}
            </button>
          </form>
        </div>
      </header>
      {pageTitle ? <h1 className="driver-portal-page-title">{pageTitle}</h1> : null}
    </div>
  );
}
