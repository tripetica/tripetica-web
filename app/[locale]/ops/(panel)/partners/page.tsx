import { notFound } from "next/navigation";
import { OpsPagination } from "@/components/ops/pagination";
import { PartnerTable } from "@/components/ops/partner-table";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { parsePage, parseQuery } from "@/lib/ops/format";
import {
  parsePartnerListFilters,
  partnerQueryRecord,
} from "@/lib/ops/partner-filters";
import { listOpsPartners, OPS_PARTNERS_PAGE_SIZE } from "@/lib/ops/partners";

export const dynamic = "force-dynamic";

export default async function OpsPartnersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/partners">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "partners.view");
  const query = await searchParams;
  const filters = parsePartnerListFilters({
    q: parseQuery(query.q),
    status: parseQuery(query.status),
    sort: parseQuery(query.sort),
    dir: parseQuery(query.dir),
  });
  const page = parsePage(query.page);
  const copy = opsCopy[asPanelLocale(locale)];
  const { items, total } = await listOpsPartners({
    query: filters.query,
    status: filters.status,
    sort: filters.sort,
    dir: filters.dir,
    locale,
    page,
    pageSize: OPS_PARTNERS_PAGE_SIZE,
  });

  return (
    <section className="ops-page">
      <h1>{copy.partners}</h1>
      <form className="ops-filters" method="get">
        <input
          type="search"
          name="q"
          defaultValue={filters.query}
          placeholder={copy.partnerSearchPlaceholder}
        />
        <select name="status" defaultValue={filters.status}>
          <option value="">
            {copy.status}: {copy.all}
          </option>
          <option value="pending">{copy.pending}</option>
          <option value="active">{copy.active}</option>
          <option value="inactive">{copy.inactive}</option>
        </select>
        {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}
        {filters.dir ? <input type="hidden" name="dir" value={filters.dir} /> : null}
        <button type="submit" className="ops-btn-secondary">
          {copy.filter}
        </button>
      </form>
      {items.length === 0 ? (
        <p className="ops-empty">{copy.emptyPartners}</p>
      ) : (
        <PartnerTable
          locale={locale}
          copy={copy}
          items={items}
          filters={filters}
        />
      )}
      <OpsPagination
        locale={locale}
        copy={copy}
        pathWithoutLocale="/ops/partners"
        page={page}
        total={total}
        pageSize={OPS_PARTNERS_PAGE_SIZE}
        query={partnerQueryRecord(filters)}
      />
    </section>
  );
}
