import { notFound } from "next/navigation";
import { PartnerDriverList } from "@/components/partner/driver-list";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { listPartnerDrivers } from "@/lib/partner/fleet";

export const dynamic = "force-dynamic";

export default async function PartnerDriversPage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/drivers">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const query = await searchParams;
  const added = query.added;
  const justAdded = (Array.isArray(added) ? added[0] : added) === "1";
  const copy = partnerCopy[asPanelLocale(locale)];
  const drivers = await listPartnerDrivers(actor.partnerId);
  const addHref = localizedPath(locale, "/partner/drivers/new");

  return (
    <div className="ops-page partner-drivers-page">
      <PartnerDriverList
        locale={locale}
        copy={copy}
        drivers={drivers}
        addHref={addHref}
        justAdded={justAdded}
      />
    </div>
  );
}
