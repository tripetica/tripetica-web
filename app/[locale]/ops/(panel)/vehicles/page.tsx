import { notFound } from "next/navigation";
import { OpsVehicleTable } from "@/components/ops/vehicle-table";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { parsePage, parseQuery } from "@/lib/ops/format";
import { actorCan } from "@/lib/ops/session";
import { listActiveUetdsCompanyOptions } from "@/lib/ops/uetds-company-options";
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
  const actor = await requireOpsPage(locale, "partners.view");
  const query = await searchParams;
  const filters = { query: parseQuery(query.q) };
  const page = parsePage(query.page);
  const [{ items, total, pageSize, fleetChoices }, companies] = await Promise.all([
    listOpsVehicles({
      query: filters.query,
      page,
      pageSize: OPS_VEHICLES_PAGE_SIZE,
    }),
    listActiveUetdsCompanyOptions(),
  ]);

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
        canManage={actorCan(actor, "partners.manage")}
        companies={companies}
        initialFleetChoices={fleetChoices}
      />
    </section>
  );
}
