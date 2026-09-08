import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { parsePage, parseQuery } from "@/lib/ops/format";
import { parseProcessListFilters, processQueryRecord } from "@/lib/ops/process-filters";
import { listProcesses } from "@/lib/ops/processes";
import { actorCan } from "@/lib/ops/session";
import { OpsPagination } from "@/components/ops/pagination";
import { ProcessFilters } from "@/components/ops/process-filters";
import { ProcessTable } from "@/components/ops/process-table";

export const dynamic = "force-dynamic";

export default async function OpsProcessesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/processes">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "processes.view");
  const query = await searchParams;
  const filters = parseProcessListFilters({
    q: parseQuery(query.q),
    status: parseQuery(query.status),
    locale: parseQuery(query.locale),
    conversion: parseQuery(query.conversion),
    date: parseQuery(query.date),
    from: parseQuery(query.from),
    to: parseQuery(query.to),
  });
  const page = parsePage(query.page);
  const copy = opsCopy[locale];
  const { items, total, pageSize } = await listProcesses({
    ...filters,
    page,
  });
  const canDelete = actorCan(actor, "processes.delete");

  return (
    <section className="ops-page">
      <h1>{copy.processes}</h1>
      <ProcessFilters locale={locale} copy={copy} filters={filters} />
      <ProcessTable
        locale={locale}
        copy={copy}
        items={items}
        total={total}
        filters={filters}
        canDelete={canDelete}
      />
      <OpsPagination
        locale={locale}
        copy={copy}
        pathWithoutLocale="/ops/processes"
        page={page}
        total={total}
        pageSize={pageSize}
        query={processQueryRecord(filters)}
      />
    </section>
  );
}
