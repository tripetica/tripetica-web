import { notFound } from "next/navigation";
import { EdevletAuthorityList } from "@/components/partner/edevlet-authority-list";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { listPartnerEdevletAuthorities } from "@/lib/uetds/partner-authority-store";

export const dynamic = "force-dynamic";

export default async function PartnerEdevletAuthoritiesPage({
  params,
}: PageProps<"/[locale]/partner/edevlet-authorities">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await requirePartnerPage(locale);
  const copy = partnerCopy[asPanelLocale(locale)];
  const authorities = await listPartnerEdevletAuthorities(actor.partnerId);
  return (
    <div className="ops-page partner-drivers-page">
      <EdevletAuthorityList locale={locale} copy={copy} authorities={authorities} />
    </div>
  );
}
