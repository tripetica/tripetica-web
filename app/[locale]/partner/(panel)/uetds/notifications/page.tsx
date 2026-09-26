import { parseUetdsListFilters } from "@/lib/uetds/list-policy";
import { notFound } from "next/navigation";
import { UetdsNotificationList } from "@/components/uetds/uetds-notification-list";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { localizedPath } from "@/lib/i18n/path";
import { listPartnerUetdsNotifications } from "@/lib/partner/uetds-notifications";

export const dynamic = "force-dynamic";

export default async function PartnerUetdsNotificationsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/uetds/notifications">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const query = await searchParams;
  const filters = parseUetdsListFilters(query);
  const search = typeof query.q === "string" ? query.q : "";
  const copy = partnerCopy[asPanelLocale(locale)];
  const items = await listPartnerUetdsNotifications(actor.partnerId, search, filters);
  return (
    <UetdsNotificationList
      items={items}
      emptyLabel={copy.uetdsEmptyNotifications}
      copy={uetdsFormCopyFor(locale)}
      detailBaseHref={localizedPath(locale, "/partner/uetds/notifications")}
      actor="partner"
      locale={locale}
      filters={filters}
      notificationDeleted={query.deleted === "1"}
      search={search}
      searchAction={localizedPath(locale, "/partner/uetds/notifications")}
    />
  );
}
