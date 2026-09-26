import { parseUetdsListFilters } from "@/lib/uetds/list-policy";
import { notFound } from "next/navigation";
import { UetdsNotificationList } from "@/components/uetds/uetds-notification-list";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { localizedPath } from "@/lib/i18n/path";
import { listUetdsNotifications } from "@/lib/uetds/notifications";

export const dynamic = "force-dynamic";

export default async function OpsUetdsNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "uetds.view");
  const query = await searchParams;
  const filters = parseUetdsListFilters(query);
  const search = typeof query.q === "string" ? query.q : "";
  const copy = opsCopy[asPanelLocale(locale)];
  const items = await listUetdsNotifications({ query: search, filters });
  return (
    <UetdsNotificationList
      items={items}
      emptyLabel={copy.uetdsEmptyNotifications}
      copy={uetdsFormCopyFor(locale)}
      detailBaseHref={localizedPath(locale, "/ops/uetds/notifications")}
      actor="ops"
      locale={locale}
      filters={filters}
      notificationDeleted={query.deleted === "1"}
      search={search}
      searchAction={localizedPath(locale, "/ops/uetds/notifications")}
    />
  );
}
