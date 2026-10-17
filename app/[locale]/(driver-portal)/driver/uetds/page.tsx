import { notFound, redirect } from "next/navigation";
import { DriverPortalHeader } from "@/components/driver-portal/driver-portal-header";
import { DriverUetdsTabs } from "@/components/driver-portal/driver-uetds-tabs";
import { UetdsNotificationList } from "@/components/uetds/uetds-notification-list";
import { driverPortalCopyFor } from "@/lib/driver-portal/copy";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { driverUetdsScope } from "@/lib/uetds/driver-access";
import { parseUetdsListFilters } from "@/lib/uetds/list-policy";
import { listUetdsNotifications } from "@/lib/uetds/notifications";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";

export const dynamic = "force-dynamic";

export default async function DriverUetdsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await getDriverPortalActor();
  if (!actor?.permissions.uetdsList) redirect(localizedPath(locale, "/driver"));
  const query = await searchParams;
  const filters = parseUetdsListFilters(query);
  const search = typeof query.q === "string" ? query.q : "";
  const items = await listUetdsNotifications({
    ...await driverUetdsScope(actor.partnerId, actor.driverId),
    query: search,
    filters,
  });
  const copy = driverPortalCopyFor(locale);
  const listHref = localizedPath(locale, "/driver/uetds");
  return (
    <section className="driver-portal ops-app">
      <DriverPortalHeader locale={locale} title={copy.uetds} />
      <DriverUetdsTabs locale={locale} current="list" allowNew={actor.permissions.uetdsNew} allowList />
      <UetdsNotificationList
        items={items}
        emptyLabel={copy.emptyNotifications}
        copy={uetdsFormCopyFor(locale)}
        detailBaseHref={listHref}
        actor="driver"
        locale={locale}
        filters={filters}
        notificationDeleted={query.deleted === "1"}
        search={search}
        searchAction={listHref}
      />
    </section>
  );
}
