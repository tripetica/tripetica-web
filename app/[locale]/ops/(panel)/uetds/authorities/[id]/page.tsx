import { notFound } from "next/navigation";
import { OpsEdevletAuthorityDetail } from "@/components/ops/edevlet-authority-detail";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { partnerCopy } from "@/lib/partner/copy";
import { actorCan } from "@/lib/ops/session";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { getOpsEdevletAuthority } from "@/lib/uetds/partner-authority-store";

export const dynamic = "force-dynamic";

export default async function OpsEdevletAuthorityDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await requireOpsPage(locale, "uetds.view");
  const authority = await getOpsEdevletAuthority(id);
  if (!authority) notFound();
  const panel = asPanelLocale(locale);
  const companies = await listActiveUetdsCompanyOptions();
  return (
    <OpsEdevletAuthorityDetail
      locale={locale}
      copy={opsCopy[panel]}
      partnerCopy={partnerCopy[panel]}
      authority={authority}
      companies={companies}
      canManage={actorCan(actor, "uetds.manage")}
    />
  );
}
