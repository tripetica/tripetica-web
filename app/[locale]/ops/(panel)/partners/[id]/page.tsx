import { notFound } from "next/navigation";
import { PartnerDetail } from "@/components/ops/partner-detail";
import { PartnerMenuAccess } from "@/components/ops/partner-menu-access";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getOpsPartner, getPrimaryPartnerId } from "@/lib/ops/partners";
import { actorCan } from "@/lib/ops/session";
import { listOpsPartnerAcceptedJobs } from "@/lib/ops/partner-jobs";
import { listPartnerDrivers, listPartnerVehicles } from "@/lib/partner/fleet";
import { listPartnerMenuDenials } from "@/lib/partner/menu-access";

export const dynamic = "force-dynamic";

function parseTab(value: string | string[] | undefined) {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "jobs" || tab === "drivers" || tab === "vehicles" || tab === "info") {
    return tab;
  }
  return "info";
}

export default async function OpsPartnerDetailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/partners/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "partners.view");
  const partner = await getOpsPartner(id);
  if (!partner) {
    notFound();
  }
  const query = await searchParams;
  const tab = parseTab(query.tab);
  const [drivers, vehicles, jobs, primaryPartnerId, denied] = await Promise.all([
    listPartnerDrivers(partner.id),
    listPartnerVehicles(partner.id),
    listOpsPartnerAcceptedJobs(partner.id, locale),
    getPrimaryPartnerId(),
    listPartnerMenuDenials(partner.id),
  ]);
  const copy = opsCopy[asPanelLocale(locale)];

  return (
    <PartnerDetail
      authoritySection={
        <PartnerMenuAccess
          locale={locale}
          partnerId={partner.id}
          copy={copy}
          denied={denied}
          canManage={actorCan(actor, "partners.manage")}
        />
      }
      locale={locale}
      copy={copy}
      partner={partner}
      canManage={actorCan(actor, "partners.manage")}
      primaryPartnerId={primaryPartnerId}
      tab={tab}
      drivers={drivers}
      vehicles={vehicles}
      jobs={jobs}
    />
  );
}
