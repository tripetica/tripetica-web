import { notFound } from "next/navigation";
import { OpsPagination } from "@/components/ops/pagination";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import {
  listOpsCustomers,
  OPS_CUSTOMERS_PAGE_SIZE,
} from "@/lib/ops/customers";
import { formatOpsDateTime, parsePage, parseQuery } from "@/lib/ops/format";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OpsCustomersPage({
  params,
  searchParams,
}: CustomersPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "customers.view");
  const query = await searchParams;
  const q = parseQuery(query.q);
  const status = parseQuery(query.status);
  const verification = parseQuery(query.verification);
  const page = parsePage(query.page);
  const copy = opsCopy[locale];
  const { items, total, pageSize } = await listOpsCustomers({
    query: q,
    status,
    verification,
    page,
    pageSize: OPS_CUSTOMERS_PAGE_SIZE,
  });

  return (
    <section className="ops-page">
      <h1>{copy.customers}</h1>
      <form className="ops-filters" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={copy.customerSearchPlaceholder}
        />
        <select name="status" defaultValue={status}>
          <option value="">
            {copy.status}: {copy.all}
          </option>
          <option value="active">{copy.active}</option>
          <option value="inactive">{copy.inactive}</option>
        </select>
        <select name="verification" defaultValue={verification}>
          <option value="">
            {copy.verification}: {copy.all}
          </option>
          <option value="verified">{copy.verified}</option>
          <option value="unverified">{copy.unverified}</option>
        </select>
        <button type="submit" className="ops-btn-secondary">
          {copy.filter}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="ops-empty">{copy.emptyCustomers}</p>
      ) : (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>{copy.firstName}</th>
                <th>{copy.lastName}</th>
                <th>{copy.email}</th>
                <th>{copy.phone}</th>
                <th>{copy.status}</th>
                <th>{copy.verification}</th>
                <th>{copy.lastLogin}</th>
                <th>{copy.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <a href={localizedPath(locale, `/ops/customers/${customer.id}`)}>
                      {customer.firstName}
                    </a>
                  </td>
                  <td>{customer.lastName}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone ?? "—"}</td>
                  <td>{customer.isActive ? copy.active : copy.inactive}</td>
                  <td>{customer.isVerified ? copy.verified : copy.unverified}</td>
                  <td>{formatOpsDateTime(customer.lastLoginAt, locale)}</td>
                  <td>{formatOpsDateTime(customer.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpsPagination
        locale={locale}
        copy={copy}
        pathWithoutLocale="/ops/customers"
        page={page}
        total={total}
        pageSize={pageSize}
        query={{ q, status, verification }}
      />
    </section>
  );
}
