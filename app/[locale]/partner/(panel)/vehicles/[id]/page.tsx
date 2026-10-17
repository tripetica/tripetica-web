import { notFound } from "next/navigation";
import { PartnerVehicleDetail } from "@/components/partner/vehicle-detail";
import { isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopyFor } from "@/lib/partner/copy";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { getPartnerVehicle } from "@/lib/partner/fleet";
import { getVehicleFleetLink, listPartnerDriverChoices } from "@/lib/partner/fleet-pairing";
import { getVehicleUetdsSubscription } from "@/lib/uetds/vehicle-subscription-store";
import { getVehicleAtsMinistrySource } from "@/lib/gps/ats-source-store";

export const dynamic = "force-dynamic";

export default async function PartnerVehicleDetailPage({
  params,
}: PageProps<"/[locale]/partner/vehicles/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const [vehicle, activeUetdsCompanies, drivers, link, subscription, atsSource] = await Promise.all([
    getPartnerVehicle(actor.partnerId, id),
    listActiveUetdsCompanyOptions(),
    listPartnerDriverChoices(actor.partnerId),
    getVehicleFleetLink(actor.partnerId, id),
    getVehicleUetdsSubscription(id),
    getVehicleAtsMinistrySource(id),
  ]);
  if (!vehicle) {
    notFound();
  }

  return (
    <div className="ops-page partner-profile-page">
      <PartnerVehicleDetail
        key={`${vehicle.id}:${vehicle.updatedAt}`}
        locale={locale}
        copy={partnerCopyFor(locale)}
        vehicle={vehicle}
        activeUetdsCompanies={activeUetdsCompanies}
        drivers={drivers}
        defaultDriverId={link.defaultDriverId}
        subscription={subscription}
        atsSource={atsSource}
      />
    </div>
  );
}
