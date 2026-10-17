import { notFound, redirect } from "next/navigation";
import { DriverPortalHeader } from "@/components/driver-portal/driver-portal-header";
import { DriverUetdsTabs } from "@/components/driver-portal/driver-uetds-tabs";
import { UetdsNotificationForm } from "@/components/uetds/uetds-notification-form";
import { driverPortalCopyFor } from "@/lib/driver-portal/copy";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { prepareAiEditDrafts } from "@/lib/uetds/ai-edit";
import { notificationHasGoldDriver } from "@/lib/uetds/ai-edit-visibility";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { driverUetdsScope, loadDriverUetdsFleet } from "@/lib/uetds/driver-access";
import { readStoredFirmaSeferNo } from "@/lib/uetds/firma-sefer-no";
import { snapshotToUetdsDraft } from "@/lib/uetds/manage";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { getUetdsNotification } from "@/lib/uetds/notifications";
import { prefillUetdsFare } from "@/lib/uetds/prefill-fare";

export const dynamic = "force-dynamic";

export default async function DriverUetdsAiEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await getDriverPortalActor();
  if (!actor?.permissions.uetdsList) redirect(localizedPath(locale, "/driver"));
  const notification = await getUetdsNotification({ id, ...await driverUetdsScope(actor.partnerId, actor.driverId) });
  const draft = notification ? snapshotToUetdsDraft(notification.snapshotJson) : null;
  if (!notification || !draft || notification.status === "cancelled") notFound();
  if (!(await notificationHasGoldDriver(notification.id, notification.partnerId))) notFound();
  await prefillUetdsFare(notification, draft);
  draft.driverId = actor.driverId;
  const prepared = prepareAiEditDrafts(draft);
  prepared.edited.driverId = actor.driverId;
  prepared.original.driverId = actor.driverId;
  const fleet = await loadDriverUetdsFleet(actor.partnerId, actor.driverId);
  return (
    <section className="driver-portal ops-app">
      <DriverPortalHeader locale={locale} title={driverPortalCopyFor(locale).uetds} action="back" />
      <DriverUetdsTabs locale={locale} current="list" allowNew={actor.permissions.uetdsNew} allowList />
      <UetdsNotificationForm
        locale={locale}
        copy={uetdsFormCopyFor(locale)}
        actor="driver"
        lockDriver
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
            vehicleLabel: fleet.vehicles.find((item) => item.id === draft.vehicleId)?.label || notification.plate,
          },
        }}
        drivers={fleet.drivers}
        vehicles={fleet.vehicles}
        authorities={fleet.authorities}
        listHref={localizedPath(locale, `/driver/uetds/${notification.id}`)}
      />
    </section>
  );
}
