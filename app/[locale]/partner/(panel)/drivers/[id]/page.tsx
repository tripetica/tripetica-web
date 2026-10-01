import { notFound } from "next/navigation";
import { PartnerDriverDetail } from "@/components/partner/driver-detail";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { getPartnerDriver } from "@/lib/partner/fleet";
import { getDriverUetdsSubscription } from "@/lib/uetds/driver-subscription-store";
import {
  getDriverFleetLink,
  listAssignableEdevletAuthorities,
  listPartnerVehicleChoices,
} from "@/lib/partner/fleet-pairing";

export const dynamic = "force-dynamic";

export default async function PartnerDriverDetailPage({
  params,
}: PageProps<"/[locale]/partner/drivers/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const [driver, activeUetdsCompanies, subscription, vehicles, authorities, link] =
    await Promise.all([
      getPartnerDriver(actor.partnerId, id),
      listActiveUetdsCompanyOptions(),
      getDriverUetdsSubscription(id),
      listPartnerVehicleChoices(actor.partnerId),
      listAssignableEdevletAuthorities({ partnerId: actor.partnerId }),
      getDriverFleetLink(actor.partnerId, id),
    ]);
  if (!driver) {
    notFound();
  }

  return (
    <div className="ops-page partner-profile-page">
      <PartnerDriverDetail
        key={`${driver.id}:${driver.updatedAt}:${subscription.enrolledAt ?? "0"}`}
        locale={locale}
        copy={partnerCopy[asPanelLocale(locale)]}
        driver={driver}
        activeUetdsCompanies={activeUetdsCompanies}
        subscription={subscription}
        vehicles={vehicles}
        authorities={authorities}
        defaultVehicleId={link.defaultVehicleId}
        defaultAuthorityId={link.defaultAuthorityId}
      />
    </div>
  );
}
