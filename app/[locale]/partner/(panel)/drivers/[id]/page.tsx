import { notFound } from "next/navigation";
import { PartnerDriverDetail } from "@/components/partner/driver-detail";
import { isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopyFor } from "@/lib/partner/copy";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { getPartnerDriverPermissions } from "@/lib/partner/driver-permission-store";
import { getPartnerDriver } from "@/lib/partner/fleet";
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
  const [driver, activeUetdsCompanies, vehicles, authorities, link, permissions] = await Promise.all([
    getPartnerDriver(actor.partnerId, id),
    listActiveUetdsCompanyOptions(),
    listPartnerVehicleChoices(actor.partnerId),
    listAssignableEdevletAuthorities({ partnerId: actor.partnerId }),
    getDriverFleetLink(actor.partnerId, id),
    getPartnerDriverPermissions(actor.partnerId, id),
  ]);
  if (!driver) {
    notFound();
  }
  return (
    <div className="ops-page partner-profile-page">
      <PartnerDriverDetail
        key={`${driver.id}:${driver.updatedAt}`}
        locale={locale}
        copy={partnerCopyFor(locale)}
        driver={driver}
        activeUetdsCompanies={activeUetdsCompanies}
        vehicles={vehicles}
        authorities={authorities}
        defaultVehicleId={link.defaultVehicleId}
        defaultAuthorityId={link.defaultAuthorityId}
        permissions={permissions}
      />
    </div>
  );
}
