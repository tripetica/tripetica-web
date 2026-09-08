import { partnerLogoutAction } from "@/lib/partner/actions";
import { type PartnerCopy } from "@/lib/partner/copy";
import { PARTNER_NAV } from "@/lib/partner/nav";
import { type PartnerActor } from "@/lib/partner/session";
import { PartnerNav } from "@/components/partner/nav";
import { PartnerPushControl } from "@/components/partner/push-control";
import { OpsLanguageSwitcher } from "@/components/ops/language-switcher";
import { type Locale } from "@/lib/i18n/config";
import { type ReactNode } from "react";

type PartnerShellProps = {
  locale: Locale;
  copy: PartnerCopy;
  actor: PartnerActor;
  pathWithoutLocale: string;
  children: ReactNode;
};

export function PartnerShell({
  locale,
  copy,
  actor,
  pathWithoutLocale,
  children,
}: PartnerShellProps) {
  return (
    <div className="ops-shell">
      <header className="partner-topbar">
        <div className="partner-topbar-start">
          <PartnerNav
            locale={locale}
            copy={copy}
            items={PARTNER_NAV}
            pathWithoutLocale={pathWithoutLocale}
            partnerName={actor.partnerName}
          />
        </div>
        <p className="partner-topbar-title">{copy.panelName}</p>
        <div className="partner-topbar-end">
          <PartnerPushControl locale={locale} copy={copy} />
          <OpsLanguageSwitcher
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
        <main className="ops-main">{children}</main>
      </div>
    </div>
  );
}
