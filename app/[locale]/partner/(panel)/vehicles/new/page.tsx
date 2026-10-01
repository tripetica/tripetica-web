import { notFound } from "next/navigation";
import { PartnerVehicleCreateForm } from "@/components/partner/vehicle-create-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { partnerCopy } from "@/lib/partner/copy";
import { listPartnerDriverChoices } from "@/lib/partner/fleet-pairing";

export const dynamic = "force-dynamic";

export default async function PartnerVehicleNewPage({
  params,
}: PageProps<"/[locale]/partner/vehicles/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const copy = partnerCopy[asPanelLocale(locale)];
  const [activeUetdsCompanies, drivers] = await Promise.all([
    listActiveUetdsCompanyOptions(),
    listPartnerDriverChoices(actor.partnerId),
  ]);

  return (
    <div className="ops-page partner-profile-page">
      <div className="ops-page-head">
        <h1>{copy.addVehicleTitle}</h1>
      </div>
      <section className="partner-billing-card partner-profile-card">
        <PartnerVehicleCreateForm
          locale={locale}
          copy={copy}
          activeUetdsCompanies={activeUetdsCompanies}
          drivers={drivers}
        />
      </section>
    </div>
  );
}
