import { notFound } from "next/navigation";
import { OpsDriverTable } from "@/components/ops/driver-table";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { parseOpsDriverListFilters } from "@/lib/ops/driver-filters";
import { listOpsDrivers, OPS_DRIVERS_PAGE_SIZE } from "@/lib/ops/drivers";
import { parsePage, parseQuery } from "@/lib/ops/format";
import { actorCan } from "@/lib/ops/session";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";

export const dynamic = "force-dynamic";

export default async function OpsDriversPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/drivers">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "partners.view");
  const query = await searchParams;
  const filters = parseOpsDriverListFilters({
    q: parseQuery(query.q),
    dir: parseQuery(query.dir),
  });
  const page = parsePage(query.page);
  const [{ items, total, pageSize, fleetChoices }, companies] = await Promise.all([
    listOpsDrivers({
      query: filters.query,
      dir: filters.dir,
      page,
      pageSize: OPS_DRIVERS_PAGE_SIZE,
    }),
    listActiveUetdsCompanyOptions(),
  ]);

  return (
    <section className="ops-page">
      <OpsDriverTable
        locale={locale}
        copy={opsCopy[asPanelLocale(locale)]}
        canManage={actorCan(actor, "partners.manage")}
        initialQuery={filters.query}
        initialDir={filters.dir}
        initialPage={page}
        initialItems={items}
        initialTotal={total}
        pageSize={pageSize}
        companies={companies}
        initialFleetChoices={fleetChoices}
      />
    </section>
  );
}
