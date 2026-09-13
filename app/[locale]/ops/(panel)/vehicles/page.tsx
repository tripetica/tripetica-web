import { notFound } from "next/navigation";
import { OpsVehicleTable } from "@/components/ops/vehicle-table";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { parsePage, parseQuery } from "@/lib/ops/format";
import { listOpsVehicles, OPS_VEHICLES_PAGE_SIZE } from "@/lib/ops/vehicles";

export const dynamic = "force-dynamic";

export default async function OpsVehiclesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/vehicles">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "partners.view");
  const query = await searchParams;
  const filters = { query: parseQuery(query.q) };
  const page = parsePage(query.page);
  const { items, total, pageSize } = await listOpsVehicles({
    query: filters.query,
    page,
    pageSize: OPS_VEHICLES_PAGE_SIZE,
  });

  return (
    <section className="ops-page">
      <OpsVehicleTable
        locale={locale}
        copy={opsCopy[asPanelLocale(locale)]}
        initialQuery={filters.query}
        initialPage={page}
        initialItems={items}
        initialTotal={total}
        pageSize={pageSize}
      />
    </section>
  );
}
