import { notFound } from "next/navigation";
import { EdevletAuthorityForm } from "@/components/partner/edevlet-authority-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";

export const dynamic = "force-dynamic";

export default async function PartnerEdevletAuthorityNewPage({
  params,
}: PageProps<"/[locale]/partner/edevlet-authorities/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requirePartnerPage(locale);
  const copy = partnerCopy[asPanelLocale(locale)];
  const companies = await listActiveUetdsCompanyOptions();
  return (
    <div className="ops-page partner-profile-page">
      <div className="ops-page-head">
        <h1>{copy.edevletAuthorityNew}</h1>
      </div>
      <section className="partner-billing-card partner-profile-card">
        <EdevletAuthorityForm locale={locale} copy={copy} companies={companies} mode="create" />
      </section>
    </div>
  );
}
