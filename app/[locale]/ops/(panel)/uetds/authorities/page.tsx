import { notFound } from "next/navigation";
import { OpsEdevletAuthorityList } from "@/components/ops/edevlet-authority-list";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { partnerCopy } from "@/lib/partner/copy";
import { actorCan } from "@/lib/ops/session";
import { listOpsEdevletAuthorities } from "@/lib/uetds/partner-authority-store";

export const dynamic = "force-dynamic";

export default async function OpsEdevletAuthoritiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await requireOpsPage(locale, "uetds.view");
  const panel = asPanelLocale(locale);
  const authorities = await listOpsEdevletAuthorities();
  return (
    <OpsEdevletAuthorityList
      locale={locale}
      copy={opsCopy[panel]}
      partnerCopy={partnerCopy[panel]}
      authorities={authorities}
      canManage={actorCan(actor, "uetds.manage")}
    />
  );
}
