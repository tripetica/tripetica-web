import { notFound } from "next/navigation";
import { UetdsNotificationDetailView } from "@/components/uetds/uetds-notification-detail";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { hydrateMinistryLastPassengerNotify } from "@/lib/uetds/manage";
import { getUetdsNotification } from "@/lib/uetds/notifications";

export const dynamic = "force-dynamic";

export default async function OpsUetdsNotificationDetailPage({
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
  await requireOpsPage(locale, "uetds.view");
  const loaded = await getUetdsNotification({ id });
  const notification = loaded ? await hydrateMinistryLastPassengerNotify({ id: loaded.id }) : null;
  if (!notification) {
    notFound();
  }
  return (
    <UetdsNotificationDetailView
      notification={notification}
      copy={uetdsFormCopyFor(locale)}
      listHref={localizedPath(locale, "/ops/uetds/notifications")}
      pdfHref={
        notification.ministryReference
          ? localizedPath(locale, `/ops/uetds/notifications/${notification.id}/pdf`)
          : null
      }
      editHref={
        notification.status === "cancelled"
          ? null
          : localizedPath(locale, `/ops/uetds/notifications/${notification.id}/edit`)
      }
      openEditMethod={query.editMethod === "1"}
      actor="ops"
      locale={locale}
    />
  );
}
