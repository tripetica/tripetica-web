import { notFound } from "next/navigation";
import { PartnerDriverCreateForm } from "@/components/partner/driver-create-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { partnerCopy } from "@/lib/partner/copy";

export const dynamic = "force-dynamic";

export default async function PartnerDriverNewPage({
  params,
}: PageProps<"/[locale]/partner/drivers/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requirePartnerPage(locale);
  const copy = partnerCopy[asPanelLocale(locale)];
  const activeUetdsCompanies = await listActiveUetdsCompanyOptions();

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
        />
      </section>
    </div>
  );
}
