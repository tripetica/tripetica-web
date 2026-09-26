import { prefillUetdsFare } from "@/lib/uetds/prefill-fare";
import { notFound } from "next/navigation";
import { UetdsNotificationEditForm } from "@/components/uetds/uetds-notification-edit-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { evaluateUetdsEditWindow } from "@/lib/uetds/edit-policy";
import {
  listUetdsDriverOptions,
  listUetdsVehicleOptions,
  withSelectedUetdsOptions,
} from "@/lib/uetds/fleet-scope";
import { snapshotToUetdsDraft } from "@/lib/uetds/manage";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { getPartnerUetdsNotification } from "@/lib/partner/uetds-notifications";

export const dynamic = "force-dynamic";

export default async function PartnerUetdsNotificationEditPage({
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
  await prefillUetdsFare(notification, draft);
  const [listedDrivers, listedVehicles] = await Promise.all([
    listUetdsDriverOptions({ scope: "partner", partnerId: actor.partnerId }),
    listUetdsVehicleOptions({ scope: "partner", partnerId: actor.partnerId }),
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
    <UetdsNotificationEditForm
      locale={asPanelLocale(locale)}
      copy={uetdsFormCopyFor(locale)}
      actor="partner"
      ministryEnv={resolveUetdsMinistryRuntime()}
      notificationId={notification.id}
      seferReferansNo={notification.ministryReference || ""}
      initialDraft={draft}
      originalDraft={draft}
      editWindow={evaluateUetdsEditWindow(draft.startDate, draft.startTime, Date.now())}
      drivers={drivers}
      vehicles={vehicles}
      seferCompanyId={notification.companyId}
      listHref={localizedPath(locale, `/partner/uetds/notifications/${notification.id}`)}
    />
  );
}
