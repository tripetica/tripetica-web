import { getDriverMembership } from "@/lib/ops/driver-membership-store";
import { notFound } from "next/navigation";
import { PartnerDriverForm } from "@/components/ops/partner-driver-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getOpsPartner } from "@/lib/ops/partners";
import { actorCan } from "@/lib/ops/session";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { getPartnerDriver } from "@/lib/partner/fleet";
import { getDriverUetdsSubscription } from "@/lib/uetds/driver-subscription-store";

export const dynamic = "force-dynamic";

export default async function OpsPartnerDriverPage({
  params,
}: PageProps<"/[locale]/ops/partners/[id]/drivers/[driverId]">) {
  const { locale, id, driverId } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "partners.view");
  const partner = await getOpsPartner(id);
  if (!partner) {
    notFound();
  }
  const [driver, activeUetdsCompanies, subscription] = await Promise.all([
    getPartnerDriver(partner.id, driverId),
    listActiveUetdsCompanyOptions(),
    getDriverUetdsSubscription(driverId),
  ]);
  if (!driver) {
    notFound();
  }

  const membership = await getDriverMembership(driver.id);

  return (
    <PartnerDriverForm
      locale={locale}
      copy={opsCopy[asPanelLocale(locale)]}
      driver={driver}
      activeUetdsCompanies={activeUetdsCompanies}
      subscription={subscription}
      membership={membership}
      canManage={actorCan(actor, "partners.manage")}
      linkedPartner={{
        id: partner.id,
        name: partner.name,
        code: partner.partnerCode,
      }}
    />
  );
}
