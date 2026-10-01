import { getDriverMembership } from "@/lib/ops/driver-membership-store";
import { notFound } from "next/navigation";
import { PartnerDriverForm } from "@/components/ops/partner-driver-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getOpsDriver } from "@/lib/ops/drivers";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
import { actorCan } from "@/lib/ops/session";
import { getDriverUetdsSubscription } from "@/lib/uetds/driver-subscription-store";

export const dynamic = "force-dynamic";

export default async function OpsDriverDetailPage({
  params,
}: PageProps<"/[locale]/ops/drivers/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "partners.view");
  const [driver, activeUetdsCompanies, subscription] = await Promise.all([
    getOpsDriver(id),
    listActiveUetdsCompanyOptions(),
    getDriverUetdsSubscription(id),
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
        id: driver.partnerId,
        name: driver.partnerName,
        code: driver.partnerCode,
      }}
      backHref={localizedPath(locale, "/ops/drivers")}
      returnTo="ops-drivers"
    />
  );
}
