import { notFound } from "next/navigation";
import { OpsDriverTable } from "@/components/ops/driver-table";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { parseOpsDriverListFilters } from "@/lib/ops/driver-filters";
import { listOpsDrivers, OPS_DRIVERS_PAGE_SIZE } from "@/lib/ops/drivers";
import { parsePage, parseQuery } from "@/lib/ops/format";

export const dynamic = "force-dynamic";

export default async function OpsDriversPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/drivers">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "partners.view");
  const query = await searchParams;
  const filters = parseOpsDriverListFilters({
    q: parseQuery(query.q),
    dir: parseQuery(query.dir),
  });
  const page = parsePage(query.page);
  const { items, total, pageSize } = await listOpsDrivers({
    query: filters.query,
    dir: filters.dir,
    page,
    pageSize: OPS_DRIVERS_PAGE_SIZE,
  });

  return (
    <section className="ops-page">
      <OpsDriverTable
        locale={locale}
        copy={opsCopy[asPanelLocale(locale)]}
        initialQuery={filters.query}
        initialDir={filters.dir}
        initialPage={page}
        initialItems={items}
        initialTotal={total}
        pageSize={pageSize}
      />
    </section>
  );
}
