import { prefillUetdsFare } from "@/lib/uetds/prefill-fare";
import { notFound } from "next/navigation";
import { UetdsNotificationForm } from "@/components/uetds/uetds-notification-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { prepareAiEditDrafts } from "@/lib/uetds/ai-edit";
import { notificationHasGoldDriver } from "@/lib/uetds/ai-edit-visibility";
import {
  listUetdsDriverOptions,
  listUetdsVehicleOptions,
  withSelectedUetdsOptions,
} from "@/lib/uetds/fleet-scope";
import { snapshotToUetdsDraft } from "@/lib/uetds/manage";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { getPartnerUetdsNotification } from "@/lib/partner/uetds-notifications";
import { listAssignableEdevletAuthorities } from "@/lib/partner/fleet-pairing";

export const dynamic = "force-dynamic";

export default async function PartnerUetdsNotificationAiEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const notification = await getPartnerUetdsNotification(actor.partnerId, id);
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
    listUetdsDriverOptions({ scope: "partner", partnerId: actor.partnerId }),
    listUetdsVehicleOptions({ scope: "partner", partnerId: actor.partnerId }),
    listAssignableEdevletAuthorities({ partnerId: actor.partnerId }),
  ]);
  const { drivers, vehicles } = await withSelectedUetdsOptions({
    scope: "partner",
    partnerId: actor.partnerId,
    driverId: draft.driverId,
    vehicleId: draft.vehicleId,
    drivers: listedDrivers,
    vehicles: listedVehicles,
  });
  return (
    <UetdsNotificationForm
      locale={asPanelLocale(locale)}
      copy={uetdsFormCopyFor(locale)}
      actor="partner"
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
          plate: notification.plate,
          driverName: notification.driverName,
          vehicleLabel: vehicles.find((item) => item.id === draft.vehicleId)?.label || notification.plate,
        },
      }}
      drivers={drivers}
      vehicles={vehicles}
      authorities={authorities}
      listHref={localizedPath(locale, `/partner/uetds/notifications/${notification.id}`)}
    />
  );
}
