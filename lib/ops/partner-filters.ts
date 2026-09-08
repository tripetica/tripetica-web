import { type Locale } from "@/lib/i18n/config";

export const PARTNER_SORT_FIELDS = ["code", "name", "status", "level"] as const;
export type PartnerSortField = (typeof PARTNER_SORT_FIELDS)[number];
export const PARTNER_SORT_DIRS = ["asc", "desc"] as const;
export type PartnerSortDir = (typeof PARTNER_SORT_DIRS)[number];

export type PartnerListFilters = {
  query: string;
  status: string;
  sort: PartnerSortField | "";
  dir: PartnerSortDir | "";
};

export function parsePartnerSortField(value: string): PartnerSortField | "" {
  return (PARTNER_SORT_FIELDS as readonly string[]).includes(value)
    ? (value as PartnerSortField)
    : "";
}

export function parsePartnerSortDir(value: string): PartnerSortDir | "" {
  return (PARTNER_SORT_DIRS as readonly string[]).includes(value)
    ? (value as PartnerSortDir)
    : "";
}

export function nextPartnerSortDir(
  currentSort: PartnerSortField | "",
  currentDir: PartnerSortDir | "",
  field: PartnerSortField,
): PartnerSortDir {
  if (currentSort === field && currentDir === "asc") {
    return "desc";
  }
  return "asc";
}

export function parsePartnerListFilters(input: {
  q?: string;
  status?: string;
  sort?: string;
  dir?: string;
}): PartnerListFilters {
  const sort = parsePartnerSortField(input.sort ?? "");
  return {
    query: (input.q ?? "").trim(),
    status:
      input.status === "pending" ||
      input.status === "active" ||
      input.status === "inactive"
        ? input.status
        : "",
    sort,
    dir: sort ? parsePartnerSortDir(input.dir ?? "") || "asc" : "",
  };
}

export function partnerQueryRecord(
  filters: PartnerListFilters,
): Record<string, string> {
  return {
    q: filters.query,
    status: filters.status,
    sort: filters.sort,
    dir: filters.sort ? filters.dir || "asc" : "",
  };
}

function partnerNameCollation(locale: Locale) {
  if (locale === "tr") {
    return `"tr-x-icu"`;
  }
  if (locale === "ru") {
    return `"ru-x-icu"`;
  }
  return `"en-x-icu"`;
}

export function partnerStatusRankSql(alias = "p") {
  return `CASE ${alias}.status
    WHEN 'pending' THEN 0
    WHEN 'active' THEN 1
    WHEN 'inactive' THEN 2
    ELSE 3
  END`;
}

export function partnerLevelRankSql(alias = "p") {
  return `CASE
    WHEN ${alias}.is_primary_partner THEN 0
    WHEN ${alias}.priority_level = 1 THEN 1
    WHEN ${alias}.priority_level = 2 THEN 2
    WHEN ${alias}.priority_level = 3 THEN 3
    ELSE 4
  END`;
}

export function partnerOrderBy(filters: PartnerListFilters, locale: Locale) {
  const direction = filters.dir === "desc" ? "DESC" : "ASC";
  const stable = "p.partner_code ASC, p.id ASC";
  if (filters.sort === "code") {
    return `substring(p.partner_code from '\\d+')::int ${direction} NULLS LAST, p.partner_code ${direction}, p.id ASC`;
  }
  if (filters.sort === "name") {
    return `p.name COLLATE ${partnerNameCollation(locale)} ${direction}, ${stable}`;
  }
  if (filters.sort === "status") {
    return `${partnerStatusRankSql()} ${direction}, ${stable}`;
  }
  if (filters.sort === "level") {
    return `${partnerLevelRankSql()} ${direction}, ${stable}`;
  }
  return "p.is_primary_partner DESC, p.partner_code ASC, p.id ASC";
}
