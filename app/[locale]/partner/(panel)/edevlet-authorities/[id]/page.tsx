import { notFound } from "next/navigation";
import { EdevletAuthorityDetail } from "@/components/partner/edevlet-authority-detail";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { getPartnerEdevletAuthority } from "@/lib/uetds/partner-authority-store";

export const dynamic = "force-dynamic";

export default async function PartnerEdevletAuthorityDetailPage({
  params,
}: PageProps<"/[locale]/partner/edevlet-authorities/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await requirePartnerPage(locale);
  const authority = await getPartnerEdevletAuthority(actor.partnerId, id);
  if (!authority) notFound();
  const copy = partnerCopy[asPanelLocale(locale)];
  const companies = await listActiveUetdsCompanyOptions();
  return (
    <div className="ops-page partner-profile-page">
      <EdevletAuthorityDetail
        locale={locale}
        copy={copy}
        authority={authority}
        companies={companies}
      />
    </div>
  );
}
