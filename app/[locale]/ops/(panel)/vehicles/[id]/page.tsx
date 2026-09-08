import { notFound } from "next/navigation";
import { PartnerVehicleForm } from "@/components/ops/partner-vehicle-form";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getOpsVehicle } from "@/lib/ops/vehicles";
import { actorCan } from "@/lib/ops/session";

export const dynamic = "force-dynamic";

export default async function OpsVehicleDetailPage({
  params,
}: PageProps<"/[locale]/ops/vehicles/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "partners.view");
  const vehicle = await getOpsVehicle(id);
  if (!vehicle) {
    notFound();
  }

  return (
    <PartnerVehicleForm
      locale={locale}
      copy={opsCopy[locale]}
      vehicle={vehicle}
      canManage={actorCan(actor, "partners.manage")}
      linkedPartner={{
        id: vehicle.partnerId,
        name: vehicle.partnerName,
        code: vehicle.partnerCode,
      }}
      backHref={localizedPath(locale, "/ops/vehicles")}
      returnTo="ops-vehicles"
    />
  );
}
