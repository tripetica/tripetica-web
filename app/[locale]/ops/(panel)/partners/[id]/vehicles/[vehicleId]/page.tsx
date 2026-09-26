import { notFound } from "next/navigation";
import { PartnerVehicleForm } from "@/components/ops/partner-vehicle-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getOpsPartner } from "@/lib/ops/partners";
import { actorCan } from "@/lib/ops/session";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { getPartnerVehicle } from "@/lib/partner/fleet";

export const dynamic = "force-dynamic";

export default async function OpsPartnerVehiclePage({
  params,
}: PageProps<"/[locale]/ops/partners/[id]/vehicles/[vehicleId]">) {
  const { locale, id, vehicleId } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "partners.view");
  const partner = await getOpsPartner(id);
  if (!partner) {
    notFound();
  }
  const [vehicle, activeUetdsCompanies] = await Promise.all([
    getPartnerVehicle(partner.id, vehicleId),
    listActiveUetdsCompanyOptions(),
  ]);
  if (!vehicle) {
    notFound();
  }

  return (
    <PartnerVehicleForm
      locale={locale}
      copy={opsCopy[asPanelLocale(locale)]}
      vehicle={vehicle}
      activeUetdsCompanies={activeUetdsCompanies}
      canManage={actorCan(actor, "partners.manage")}
      linkedPartner={{
        id: partner.id,
        name: partner.name,
        code: partner.partnerCode,
      }}
    />
  );
}
