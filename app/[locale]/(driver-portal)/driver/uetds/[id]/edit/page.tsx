import { notFound, redirect } from "next/navigation";
import { DriverPortalHeader } from "@/components/driver-portal/driver-portal-header";
import { DriverUetdsTabs } from "@/components/driver-portal/driver-uetds-tabs";
import { UetdsNotificationEditForm } from "@/components/uetds/uetds-notification-edit-form";
import { driverPortalCopyFor } from "@/lib/driver-portal/copy";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { driverUetdsScope, loadDriverUetdsFleet } from "@/lib/uetds/driver-access";
import { evaluateUetdsEditWindow } from "@/lib/uetds/edit-policy";
import { snapshotToUetdsDraft, hydrateMinistryLastPassengerNotify } from "@/lib/uetds/manage";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { getUetdsNotification } from "@/lib/uetds/notifications";
import { prefillUetdsFare } from "@/lib/uetds/prefill-fare";

export const dynamic = "force-dynamic";

export default async function DriverUetdsEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await getDriverPortalActor();
  if (!actor?.permissions.uetdsList) redirect(localizedPath(locale, "/driver"));
  const loaded = await getUetdsNotification({ id, ...await driverUetdsScope(actor.partnerId, actor.driverId) });
  const notification = loaded
    ? await hydrateMinistryLastPassengerNotify({ id: loaded.id, partnerId: actor.partnerId })
    : null;
  const draft = notification ? snapshotToUetdsDraft(notification.snapshotJson) : null;
  if (!notification || !draft || notification.status === "cancelled") notFound();
  await prefillUetdsFare(notification, draft);
  draft.driverId = actor.driverId;
  const fleet = await loadDriverUetdsFleet(actor.partnerId, actor.driverId);
  const vehicles = fleet.vehicles;
  return (
    <section className="driver-portal ops-app">
      <DriverPortalHeader locale={locale} title={driverPortalCopyFor(locale).uetds} action="back" />
      <DriverUetdsTabs locale={locale} current="list" allowNew={actor.permissions.uetdsNew} allowList />
      <UetdsNotificationEditForm
        locale={locale}
        copy={uetdsFormCopyFor(locale)}
        actor="driver"
        lockDriver
        ministryEnv={resolveUetdsMinistryRuntime()}
        notificationId={notification.id}
        seferReferansNo={notification.ministryReference || ""}
        initialDraft={draft}
        originalDraft={draft}
        editWindow={evaluateUetdsEditWindow(draft.startDate, draft.startTime, Date.now())}
        drivers={fleet.drivers}
        vehicles={vehicles}
        authorities={fleet.authorities}
        seferCompanyId={notification.companyId}
        listHref={localizedPath(locale, `/driver/uetds/${notification.id}`)}
      />
    </section>
  );
}
