import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PartnerShell } from "@/components/partner/shell";
import { loadMobileShare } from "@/lib/gps/mobile-store";
import { isLocale } from "@/lib/i18n/config";
import { partnerHasTab, partnerTabForPath } from "@/lib/partner/access";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopyFor } from "@/lib/partner/copy";

export const dynamic = "force-dynamic";

export default async function PartnerPanelLayout({
  children,
  params,
}: LayoutProps<"/[locale]/partner">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const copy = partnerCopyFor(locale);
  const headerList = await headers();
  const pathname = headerList.get("x-partner-pathname") ?? "";
  const pathWithoutLocale = pathname.replace(/^\/(tr|en|ru|ar)/, "") || "/partner";
  const tab = partnerTabForPath(pathWithoutLocale);
  const allowed = !tab || partnerHasTab(actor, tab);
  const share = actor.isOwner
    ? await loadMobileShare({
      surface: "partner",
      partnerId: actor.partnerId,
      email: actor.email,
      isOwner: true,
    })
    : null;

  return (
    <PartnerShell
      locale={locale}
      copy={copy}
      actor={actor}
      pathWithoutLocale={pathWithoutLocale}
      share={share?.vehicleId ? {
        driverName: share.driverName,
        plate: share.plate,
        vehicleId: share.vehicleId,
        sessionId: share.sessionId,
        sharing: share.sharing,
        tokenMatches: share.tokenMatches,
        lastFixAt: share.lastFixAt,
        lastStreamAt: share.lastStreamAt,
        accuracyM: share.accuracyM,
        fresh: share.fresh,
      } : null}
    >
          {allowed ? children : <p className="ops-form-error">{copy.accessDenied}</p>}
    </PartnerShell>
  );
}
