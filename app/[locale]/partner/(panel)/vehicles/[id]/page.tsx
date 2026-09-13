import { notFound } from "next/navigation";
import { PartnerVehicleDetail } from "@/components/partner/vehicle-detail";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { getPartnerVehicle } from "@/lib/partner/fleet";

export const dynamic = "force-dynamic";

export default async function PartnerVehicleDetailPage({
  params,
}: PageProps<"/[locale]/partner/vehicles/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const vehicle = await getPartnerVehicle(actor.partnerId, id);
  if (!vehicle) {
    notFound();
  }

  return (
    <div className="ops-page partner-profile-page">
      <PartnerVehicleDetail
        key={`${vehicle.id}:${vehicle.updatedAt}`}
        locale={locale}
        copy={partnerCopy[asPanelLocale(locale)]}
        vehicle={vehicle}
      />
    </div>
  );
}
