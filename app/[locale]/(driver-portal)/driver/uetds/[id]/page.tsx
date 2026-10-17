import { notFound, redirect } from "next/navigation";
import { DriverPortalHeader } from "@/components/driver-portal/driver-portal-header";
import { DriverUetdsTabs } from "@/components/driver-portal/driver-uetds-tabs";
import { UetdsNotificationDetailView } from "@/components/uetds/uetds-notification-detail";
import { driverPortalCopyFor } from "@/lib/driver-portal/copy";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { loadGpsAtsNotificationHistory } from "@/lib/gps/ats-history";
import { atsReportHref, atsReportIsOpen } from "@/lib/gps/ats-history-page";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { notificationHasGoldDriver } from "@/lib/uetds/ai-edit-visibility";
import { driverUetdsScope } from "@/lib/uetds/driver-access";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { hydrateMinistryLastPassengerNotify } from "@/lib/uetds/manage";
import { getUetdsNotification } from "@/lib/uetds/notifications";

export const dynamic = "force-dynamic";

export default async function DriverUetdsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ editMethod?: string; ats?: string; atsPage?: string }>;
}) {
  const { locale, id } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const actor = await getDriverPortalActor();
  if (!actor?.permissions.uetdsList) redirect(localizedPath(locale, "/driver"));
  const loaded = await getUetdsNotification({ id, ...await driverUetdsScope(actor.partnerId, actor.driverId) });
  const notification = loaded
    ? await hydrateMinistryLastPassengerNotify({ id: loaded.id, partnerId: actor.partnerId })
    : null;
  if (!notification) notFound();
  const showAiEdit = await notificationHasGoldDriver(notification.id, notification.partnerId);
  const atsPage = Math.max(1, Number(query.atsPage) || 1);
  const ats = await loadGpsAtsNotificationHistory(notification.id, atsPage);
  const base = localizedPath(locale, `/driver/uetds/${notification.id}`);
  const atsHref = (page: number) => atsReportHref(base, { page, editMethod: query.editMethod, open: true });
  return (
    <section className="driver-portal ops-app">
      <DriverPortalHeader locale={locale} title={driverPortalCopyFor(locale).uetds} action="back" />
      <DriverUetdsTabs locale={locale} current="list" allowNew={actor.permissions.uetdsNew} allowList />
      <UetdsNotificationDetailView
        notification={notification}
        showAiEdit={showAiEdit}
        copy={uetdsFormCopyFor(locale)}
        listHref={localizedPath(locale, "/driver/uetds")}
        pdfHref={notification.ministryReference ? `${base}/pdf` : null}
        editHref={notification.status === "cancelled" ? null : `${base}/edit`}
        aiEditHref={showAiEdit && notification.status !== "cancelled" ? `${base}/ai-edit` : null}
        openEditMethod={query.editMethod === "1"}
        actor="driver"
        locale={locale}
        ats={ats}
        atsVisible={atsReportIsOpen(query)}
        atsCloseHref={atsReportHref(base, { page: 1, editMethod: query.editMethod, open: false })}
        atsPrevHref={atsPage > 1 ? atsHref(atsPage - 1) : null}
        atsNextHref={ats.hasMore ? atsHref(atsPage + 1) : null}
      />
    </section>
  );
}
