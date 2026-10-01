import { notFound } from "next/navigation";
import { PartnerDriverCreateForm } from "@/components/partner/driver-create-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { partnerCopy } from "@/lib/partner/copy";
import {
  listAssignableEdevletAuthorities,
  listPartnerVehicleChoices,
} from "@/lib/partner/fleet-pairing";

export const dynamic = "force-dynamic";

export default async function PartnerDriverNewPage({
  params,
}: PageProps<"/[locale]/partner/drivers/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const copy = partnerCopy[asPanelLocale(locale)];
  const [activeUetdsCompanies, vehicles, authorities] = await Promise.all([
    listActiveUetdsCompanyOptions(),
    listPartnerVehicleChoices(actor.partnerId),
    listAssignableEdevletAuthorities({ partnerId: actor.partnerId }),
  ]);

  return (
    <div className="ops-page partner-profile-page">
      <div className="ops-page-head">
        <h1>{copy.addDriver}</h1>
      </div>
      <section className="partner-billing-card partner-profile-card">
        <PartnerDriverCreateForm
          locale={locale}
          copy={copy}
          activeUetdsCompanies={activeUetdsCompanies}
          vehicles={vehicles}
          authorities={authorities}
        />
      </section>
    </div>
  );
}
