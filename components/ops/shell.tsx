import { opsLogoutAction } from "@/lib/ops/actions";
import { type OpsCopy } from "@/lib/ops/copy";
import { type OpsFxSummary } from "@/lib/ops/fx-summary";
import { OPS_NAV } from "@/lib/ops/nav";
import { actorCan, type OpsActor } from "@/lib/ops/session";
import { OpsFxRatesBanner } from "@/components/ops/fx-rates-banner";
import { OpsLanguageSwitcher } from "@/components/ops/language-switcher";
import { OpsNav } from "@/components/ops/ops-nav";
import { OpsPushControl } from "@/components/ops/push-control";
import { type Locale } from "@/lib/i18n/config";
import { type ReactNode } from "react";

type OpsShellProps = {
  locale: Locale;
  copy: OpsCopy;
  actor: OpsActor;
  pathWithoutLocale: string;
  fxSummary: OpsFxSummary | null;
  children: ReactNode;
};

export function OpsShell({
  locale,
  copy,
  actor,
  pathWithoutLocale,
  fxSummary,
  children,
}: OpsShellProps) {
  const items = OPS_NAV.filter(
    (item) => item.permission === null || actorCan(actor, item.permission),
  );

  return (
    <div className="ops-shell">
      <header className="ops-topbar">
        <div className="ops-topbar-start">
          <OpsNav
            locale={locale}
            copy={copy}
            items={items}
            pathWithoutLocale={pathWithoutLocale}
          />
        </div>
        <div className="ops-topbar-center">
          <OpsFxRatesBanner locale={locale} copy={copy} summary={fxSummary} />
        </div>
        <div className="ops-topbar-end">
          <span className="ops-actor">
            {actor.firstName} {actor.lastName}
          </span>
          <OpsPushControl locale={locale} copy={copy} />
          <OpsLanguageSwitcher
            locale={locale}
            pathWithoutLocale={pathWithoutLocale}
            label={copy.language}
          />
          <form action={opsLogoutAction}>
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
