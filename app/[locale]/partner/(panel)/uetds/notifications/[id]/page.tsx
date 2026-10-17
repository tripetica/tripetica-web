import { notificationHasGoldDriver } from "@/lib/uetds/ai-edit-visibility";
import { notFound } from "next/navigation";
import { UetdsNotificationDetailView } from "@/components/uetds/uetds-notification-detail";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { loadGpsAtsNotificationHistory } from "@/lib/gps/ats-history";
import { atsReportHref, atsReportIsOpen } from "@/lib/gps/ats-history-page";
import { getPartnerUetdsNotification } from "@/lib/partner/uetds-notifications";
import { hydrateMinistryLastPassengerNotify } from "@/lib/uetds/manage";

export const dynamic = "force-dynamic";

export default async function PartnerUetdsNotificationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ editMethod?: string; ats?: string; atsPage?: string }>;
}) {
  const { locale, id } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const loaded = await getPartnerUetdsNotification(actor.partnerId, id);
  const notification = loaded
    ? await hydrateMinistryLastPassengerNotify({ id: loaded.id, partnerId: actor.partnerId })
    : null;
  if (!notification) {
    notFound();
  }
  const showAiEdit = await notificationHasGoldDriver(notification.id, notification.partnerId);
  const atsPage = Math.max(1, Number(query.atsPage) || 1);
  const ats = await loadGpsAtsNotificationHistory(notification.id, atsPage);
  const atsPath = localizedPath(locale, `/partner/uetds/notifications/${notification.id}`);
  const atsHref = (page: number) => atsReportHref(atsPath, { page, editMethod: query.editMethod, open: true });
  return (
    <UetdsNotificationDetailView
      notification={notification}
      showAiEdit={showAiEdit}
      copy={uetdsFormCopyFor(locale)}
      listHref={localizedPath(locale, "/partner/uetds/notifications")}
      pdfHref={
        notification.ministryReference
          ? localizedPath(locale, `/partner/uetds/notifications/${notification.id}/pdf`)
          : null
      }
      editHref={
        notification.status === "cancelled"
          ? null
          : localizedPath(locale, `/partner/uetds/notifications/${notification.id}/edit`)
      }
      aiEditHref={
        showAiEdit && notification.status !== "cancelled"
          ? localizedPath(locale, `/partner/uetds/notifications/${notification.id}/ai-edit`)
          : null
      }
      openEditMethod={query.editMethod === "1"}
      actor="partner"
      locale={locale}
      ats={ats}
      atsVisible={atsReportIsOpen(query)}
      atsCloseHref={atsReportHref(atsPath, { page: 1, editMethod: query.editMethod, open: false })}
      atsPrevHref={atsPage > 1 ? atsHref(atsPage - 1) : null}
      atsNextHref={ats.hasMore ? atsHref(atsPage + 1) : null}
    />
  );
}
