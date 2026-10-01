import { notFound } from "next/navigation";
import { PartnerVehicleList } from "@/components/partner/vehicle-list";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { listPartnerVehicles } from "@/lib/partner/fleet";
import { listFleetChoicesForPartners } from "@/lib/partner/fleet-pairing";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";

export const dynamic = "force-dynamic";

export default async function PartnerVehiclesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/vehicles">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const query = await searchParams;
  const added = query.added;
  const justAdded = (Array.isArray(added) ? added[0] : added) === "1";
  const copy = partnerCopy[asPanelLocale(locale)];
  const [vehicles, companies, fleetChoices] = await Promise.all([
    listPartnerVehicles(actor.partnerId),
    listActiveUetdsCompanyOptions(),
    listFleetChoicesForPartners([actor.partnerId]),
  ]);
  const addHref = localizedPath(locale, "/partner/vehicles/new");

  return (
    <div className="ops-page partner-drivers-page partner-drivers-list-page">
      <PartnerVehicleList
        locale={locale}
        copy={copy}
        vehicles={vehicles}
        companies={companies}
        fleetChoices={fleetChoices}
        addHref={addHref}
        justAdded={justAdded}
      />
    </div>
  );
}
