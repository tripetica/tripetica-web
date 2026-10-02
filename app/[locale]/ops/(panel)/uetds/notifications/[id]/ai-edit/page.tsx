import { prefillUetdsFare } from "@/lib/uetds/prefill-fare";
import { notFound } from "next/navigation";
import { UetdsNotificationForm } from "@/components/uetds/uetds-notification-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { prepareAiEditDrafts } from "@/lib/uetds/ai-edit";
import { notificationHasGoldDriver } from "@/lib/uetds/ai-edit-visibility";
import {
  listUetdsDriverOptions,
  listUetdsVehicleOptions,
  withSelectedUetdsOptions,
} from "@/lib/uetds/fleet-scope";
import { readStoredFirmaSeferNo } from "@/lib/uetds/firma-sefer-no";
import { snapshotToUetdsDraft } from "@/lib/uetds/manage";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { getUetdsNotification } from "@/lib/uetds/notifications";
import { listAssignableEdevletAuthorities } from "@/lib/partner/fleet-pairing";

export const dynamic = "force-dynamic";

export default async function OpsUetdsNotificationAiEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "uetds.manage");
  const notification = await getUetdsNotification({ id });
  const draft = notification ? snapshotToUetdsDraft(notification.snapshotJson) : null;
  if (!notification || !draft || notification.status === "cancelled") {
    notFound();
  }
  const showAiEdit = await notificationHasGoldDriver(notification.id, notification.partnerId);
  if (!showAiEdit) {
    notFound();
  }
  await prefillUetdsFare(notification, draft);
  const prepared = prepareAiEditDrafts(draft);
  const [listedDrivers, listedVehicles, authorities] = await Promise.all([
    listUetdsDriverOptions({ scope: "ops" }),
    listUetdsVehicleOptions({ scope: "ops" }),
    listAssignableEdevletAuthorities({ partnerId: null }),
  ]);
  const { drivers, vehicles } = await withSelectedUetdsOptions({
    scope: "ops",
    driverId: draft.driverId,
    vehicleId: draft.vehicleId,
    drivers: listedDrivers,
    vehicles: listedVehicles,
  });
  return (
    <UetdsNotificationForm
      locale={asPanelLocale(locale)}
      copy={uetdsFormCopyFor(locale)}
      actor="ops"
      ministryEnv={resolveUetdsMinistryRuntime()}
      initialDraft={prepared.edited}
      aiEdit={{
        originalDraft: prepared.original,
        meta: {
          notificationId: notification.id,
          partnerId: notification.partnerId,
          companyId: notification.companyId,
          companyName: notification.companyShortName,
          seferReference: notification.ministryReference,
          firmaSeferNo: readStoredFirmaSeferNo(notification.snapshotJson),
          plate: notification.plate,
          driverName: notification.driverName,
          vehicleLabel: vehicles.find((item) => item.id === draft.vehicleId)?.label || notification.plate,
        },
      }}
      drivers={drivers}
      vehicles={vehicles}
      authorities={authorities}
      listHref={localizedPath(locale, `/ops/uetds/notifications/${notification.id}`)}
    />
  );
}
