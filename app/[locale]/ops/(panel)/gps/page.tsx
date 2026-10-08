import { notFound } from "next/navigation";
import { GpsDeviceBoard } from "@/components/gps/device-board";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { gpsCopy } from "@/lib/gps/copy";
import { listGpsDevices, listGpsPartners, listGpsVehicles } from "@/lib/gps/queries";
import { requireOpsPage } from "@/lib/ops/auth";
import { actorCan } from "@/lib/ops/session";

export const dynamic = "force-dynamic";

export default async function OpsGpsPage({
  params,
}: PageProps<"/[locale]/ops/gps">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "gps.view");
  const [devices, partners, vehicles] = await Promise.all([
    listGpsDevices(null),
    listGpsPartners(),
    listGpsVehicles(),
  ]);

  return (
    <GpsDeviceBoard
      locale={locale}
      copy={gpsCopy[asPanelLocale(locale)]}
      surface="ops"
      devices={devices}
      canManage={actorCan(actor, "gps.manage")}
      partners={partners}
      vehicles={vehicles}
    />
  );
}
