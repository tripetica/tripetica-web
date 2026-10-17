import { partnerLogoutAction } from "@/lib/partner/actions";
import { type PartnerCopy } from "@/lib/partner/copy";
import { partnerHasTab, partnerTabForPath } from "@/lib/partner/access";
import { PARTNER_NAV } from "@/lib/partner/nav";
import { type PartnerActor } from "@/lib/partner/session";
import { PartnerLowBatteryWarning } from "@/components/partner/low-battery-warning";
import { PartnerNav } from "@/components/partner/nav";
import { PartnerMobileShareRuntime, type MobileShareView } from "@/components/gps/mobile-share";
import { PartnerPushControl } from "@/components/partner/push-control";
import { PartnerShareButton } from "@/components/partner/share-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { type Locale } from "@/lib/i18n/config";
import { type ReactNode } from "react";

type PartnerShellProps = {
  locale: Locale;
  copy: PartnerCopy;
  actor: PartnerActor;
  pathWithoutLocale: string;
  share?: MobileShareView | null;
  children: ReactNode;
};

export function PartnerShell({
  locale,
  copy,
  actor,
  pathWithoutLocale,
  share = null,
  children,
}: PartnerShellProps) {
  return (
    <div className="ops-shell">
      <header className="partner-topbar">
        <div className="partner-topbar-start">
          <PartnerNav
            locale={locale}
            copy={copy}
            items={PARTNER_NAV.filter((item) => {
              const tab = partnerTabForPath(item.href);
              return tab ? partnerHasTab(actor, tab) : false;
            })}
            pathWithoutLocale={pathWithoutLocale}
            partnerName={actor.partnerName}
            gpsLabel={actor.isPrimaryPartner ? copy.gps : copy.gpsOnly}
          />
        </div>
        <p className="partner-topbar-title">{copy.panelName}</p>
        <div className="partner-topbar-end">
          {share?.vehicleId ? <PartnerShareButton locale={locale} /> : null}
          <PartnerPushControl locale={locale} copy={copy} />
          <LanguageSwitcher
            appearance="panel"
            locale={locale}
            pathWithoutLocale={pathWithoutLocale}
            label={copy.language}
          />
          <form action={partnerLogoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="ops-btn-ghost">
              {copy.logout}
            </button>
          </form>
        </div>
      </header>
      <div className="ops-body">
        <main className="ops-main">
          {actor.isOwner ? <PartnerMobileShareRuntime initial={share} /> : null}
          {actor.isPrimaryPartner ? <PartnerLowBatteryWarning locale={locale} /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
