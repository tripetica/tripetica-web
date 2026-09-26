import { notFound } from "next/navigation";
import { OpsPagination } from "@/components/ops/pagination";
import { UetdsCompaniesScreen } from "@/components/ops/uetds-companies-screen";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { parsePage, parseQuery } from "@/lib/ops/format";
import { actorCan } from "@/lib/ops/session";
import {
  listOpsUetdsCompanies,
  OPS_UETDS_COMPANIES_PAGE_SIZE,
} from "@/lib/ops/uetds-companies";
import {
  parseUetdsCompanyListFilters,
  uetdsCompanyQueryRecord,
} from "@/lib/ops/uetds-company-filters";

export const dynamic = "force-dynamic";

export default async function OpsUetdsCompaniesPage({
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
  const actor = await requireOpsPage(locale, "uetds.view");
  const query = await searchParams;
  const filters = parseUetdsCompanyListFilters({
    q: parseQuery(query.q),
    status: parseQuery(query.status),
  });
  const page = parsePage(query.page);
  const copy = opsCopy[asPanelLocale(locale)];
  const { items, total } = await listOpsUetdsCompanies({ filters, page });

  return (
    <>
      <UetdsCompaniesScreen
        locale={locale}
        copy={copy}
        items={items}
        filters={filters}
        page={page}
        pageSize={OPS_UETDS_COMPANIES_PAGE_SIZE}
        canManage={actorCan(actor, "uetds.manage")}
      />
      <OpsPagination
        locale={locale}
        copy={copy}
        pathWithoutLocale="/ops/uetds/companies"
        page={page}
        total={total}
        pageSize={OPS_UETDS_COMPANIES_PAGE_SIZE}
        query={uetdsCompanyQueryRecord(filters)}
      />
    </>
  );
}
