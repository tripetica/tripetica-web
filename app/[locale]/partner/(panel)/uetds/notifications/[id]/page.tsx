import { notificationHasGoldDriver } from "@/lib/uetds/ai-edit-visibility";
import { notFound } from "next/navigation";
import { UetdsNotificationDetailView } from "@/components/uetds/uetds-notification-detail";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { getPartnerUetdsNotification } from "@/lib/partner/uetds-notifications";
import { hydrateMinistryLastPassengerNotify } from "@/lib/uetds/manage";

export const dynamic = "force-dynamic";

export default async function PartnerUetdsNotificationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ editMethod?: string }>;
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
    />
  );
}
