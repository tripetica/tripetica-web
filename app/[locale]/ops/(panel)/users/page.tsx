import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { formatOpsDateTime, parsePage, parseQuery } from "@/lib/ops/format";
import { actorCan } from "@/lib/ops/session";
import { listOpsUsers } from "@/lib/ops/users";
import { OpsPagination } from "@/components/ops/pagination";

export const dynamic = "force-dynamic";

export default async function OpsUsersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/users">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "users.view");
  const query = await searchParams;
  const q = parseQuery(query.q);
  const role = parseQuery(query.role);
  const status = parseQuery(query.status);
  const page = parsePage(query.page);
  const copy = opsCopy[locale];
  const { items, total } = await listOpsUsers({
    query: q,
    role,
    status,
    page,
    pageSize: 25,
  });
  const canManage = actorCan(actor, "users.manage");

  return (
    <section className="ops-page">
      <div className="ops-page-head">
        <h1>{copy.users}</h1>
        {canManage ? (
          <a className="ops-btn-primary" href={localizedPath(locale, "/ops/users/new")}>
            {copy.newUser}
          </a>
        ) : null}
      </div>
      <form className="ops-filters" method="get">
        <input type="search" name="q" defaultValue={q} placeholder={`${copy.firstName}, ${copy.email}`} />
        <select name="role" defaultValue={role}>
          <option value="">{copy.role}: {copy.all}</option>
          <option value="owner">{copy.owner}</option>
          <option value="employee">{copy.employee}</option>
        </select>
        <select name="status" defaultValue={status}>
          <option value="">{copy.status}: {copy.all}</option>
          <option value="active">{copy.active}</option>
          <option value="inactive">{copy.inactive}</option>
        </select>
        <button type="submit" className="ops-btn-secondary">
          {copy.filter}
        </button>
      </form>
      {items.length === 0 ? (
        <p className="ops-empty">{copy.emptyUsers}</p>
      ) : (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>{copy.firstName}</th>
                <th>{copy.lastName}</th>
                <th>{copy.email}</th>
                <th>{copy.role}</th>
                <th>{copy.status}</th>
                <th>{copy.lastLogin}</th>
                <th>{copy.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a href={localizedPath(locale, `/ops/users/${item.id}`)}>
                      {item.firstName}
                    </a>
                  </td>
                  <td>{item.lastName}</td>
                  <td>{item.email}</td>
                  <td>{item.role === "owner" ? copy.owner : copy.employee}</td>
                  <td>{item.isActive ? copy.active : copy.inactive}</td>
                  <td>{formatOpsDateTime(item.lastLoginAt, locale)}</td>
                  <td>{formatOpsDateTime(item.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OpsPagination
        locale={locale}
        copy={copy}
        pathWithoutLocale="/ops/users"
        page={page}
        total={total}
        pageSize={25}
        query={{ q, role, status }}
      />
    </section>
  );
}
