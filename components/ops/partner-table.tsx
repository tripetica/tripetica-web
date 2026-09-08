import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  nextPartnerSortDir,
  partnerQueryRecord,
  type PartnerListFilters,
  type PartnerSortField,
} from "@/lib/ops/partner-filters";
import {
  partnerLevelLabel,
  partnerStatusBadgeClass,
  partnerStatusLabel,
} from "@/lib/ops/partner-labels";
import { type OpsPartnerListItem } from "@/lib/ops/partner-view";

type PartnerTableProps = {
  locale: Locale;
  copy: OpsCopy;
  items: OpsPartnerListItem[];
  filters: PartnerListFilters;
};

function SortHeader({
  locale,
  label,
  field,
  filters,
}: {
  locale: Locale;
  label: string;
  field: PartnerSortField;
  filters: PartnerListFilters;
}) {
  const active = filters.sort === field;
  const dir = active ? filters.dir || "asc" : "";
  const nextDir = nextPartnerSortDir(filters.sort, filters.dir, field);
  const params = new URLSearchParams(
    Object.entries(
      partnerQueryRecord({ ...filters, sort: field, dir: nextDir }),
    ).filter(([, value]) => value.length > 0),
  );
  const href = `${localizedPath(locale, "/ops/partners")}?${params.toString()}`;
  const arrow = dir === "asc" ? "↑" : dir === "desc" ? "↓" : "";

  return (
    <th aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}>
      <a className={`ops-sort-link${active ? " is-active" : ""}`} href={href}>
        <span>{label}</span>
        {arrow ? (
          <span className="ops-sort-arrow" aria-hidden="true">
            {arrow}
          </span>
        ) : null}
      </a>
    </th>
  );
}

export function PartnerTable({ locale, copy, items, filters }: PartnerTableProps) {
  return (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead>
          <tr>
            <SortHeader
              locale={locale}
              label={copy.partnerCode}
              field="code"
              filters={filters}
            />
            <SortHeader
              locale={locale}
              label={copy.partnerName}
              field="name"
              filters={filters}
            />
            <th>{copy.partnerContact}</th>
            <th>{copy.partnerPhone}</th>
            <SortHeader
              locale={locale}
              label={copy.status}
              field="status"
              filters={filters}
            />
            <SortHeader
              locale={locale}
              label={copy.partnerLevel}
              field="level"
              filters={filters}
            />
            <th>{copy.details}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.partnerCode}</td>
              <td>{item.name}</td>
              <td>{item.contactName ?? "—"}</td>
              <td>{item.phone ?? "—"}</td>
              <td>
                <span className={`ops-status-badge ${partnerStatusBadgeClass(item.status)}`}>
                  {partnerStatusLabel(item.status, copy)}
                </span>
              </td>
              <td>{partnerLevelLabel(item, copy)}</td>
              <td>
                <a
                  className="ops-row-detail"
                  href={localizedPath(locale, `/ops/partners/${item.id}`)}
                >
                  {copy.details}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
