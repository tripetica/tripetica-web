import { foldDriverSearchText } from "@/lib/partner/driver-list-view";
import { type OpsDriverListFilters } from "@/lib/ops/driver-filters";
import { addSubscriptionMonths } from "@/lib/uetds/driver-subscription";

export type SqlQueryPlan = {
  sql: string;
  values: unknown[];
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function foldedSql(expr: string) {
  return `translate(lower(${expr}), 'ıİğĞüÜşŞöÖçÇ', 'iigguussoocc')`;
}

function searchFilters(query: string, values: unknown[]) {
  const q = query.trim();
  if (!q) {
    return;
  }
  values.push(`%${q}%`);
  const like = `$${values.length}`;
  values.push(`%${foldDriverSearchText(q)}%`);
  const folded = `$${values.length}`;
  const clauses = [
    `(d.first_name || ' ' || d.last_name) ILIKE ${like}`,
    `d.first_name ILIKE ${like}`,
    `d.last_name ILIKE ${like}`,
    `${foldedSql("d.first_name || ' ' || d.last_name")} LIKE ${folded}`,
    `COALESCE(d.phone, '') ILIKE ${like}`,
    `p.name ILIKE ${like}`,
    `${foldedSql("p.name")} LIKE ${folded}`,
    `p.partner_code ILIKE ${like}`,
  ];
  const digits = digitsOnly(q);
  if (digits) {
    values.push(`%${digits}%`);
    clauses.push(`regexp_replace(COALESCE(d.phone, ''), '[^0-9]', '', 'g') LIKE $${values.length}`);
  }
  return `(${clauses.join(" OR ")})`;
}

/** Highest $N placeholder in SQL text, or 0 when none. */
export function sqlPlaceholderArity(sql: string): number {
  let max = 0;
  for (const match of sql.matchAll(/\$(\d+)\b/g)) {
    const n = Number(match[1]);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

export function assertSqlBindArity(plan: SqlQueryPlan) {
  const arity = sqlPlaceholderArity(plan.sql);
  if (arity !== plan.values.length) {
    throw new Error(
      `SQL bind arity mismatch: placeholders require ${arity}, values has ${plan.values.length}`,
    );
  }
}

/**
 * Pure query builder for Ops driver list COUNT + page SELECT.
 * COUNT intentionally omits period params (no period JOIN).
 * LIST binds current period as $1/$2 and the next Istanbul month as $3/$4.
 */
export function buildOpsDriverListQueryPlan(input: {
  query: string;
  dir: OpsDriverListFilters["dir"];
  page: number;
  pageSize: number;
  period: { year: number; month: number };
}): { count: SqlQueryPlan; list: SqlQueryPlan } {
  const baseFilters = ["d.deleted_at IS NULL", "p.deleted_at IS NULL"];

  const countValues: unknown[] = [];
  const countFilters = [...baseFilters];
  const countSearch = searchFilters(input.query, countValues);
  if (countSearch) {
    countFilters.push(countSearch);
  }
  const countWhere = countFilters.join(" AND ");
  const count: SqlQueryPlan = {
    sql: `SELECT COUNT(*)::text AS count
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id
     WHERE ${countWhere}`,
    values: countValues,
  };

  const nextPeriod = addSubscriptionMonths(input.period, 1);
  const listValues: unknown[] = [
    input.period.year,
    input.period.month,
    nextPeriod.year,
    nextPeriod.month,
  ];
  const listFilters = [...baseFilters];
  const listSearch = searchFilters(input.query, listValues);
  if (listSearch) {
    listFilters.push(listSearch);
  }
  const listWhere = listFilters.join(" AND ");
  const direction = input.dir === "desc" ? "DESC" : "ASC";
  const orderBy = `(d.first_name || ' ' || d.last_name) COLLATE "tr-x-icu" ${direction}, d.id ASC`;
  const page = Math.max(1, input.page);
  const offset = (page - 1) * input.pageSize;
  listValues.push(input.pageSize, offset);
  const list: SqlQueryPlan = {
    sql: `SELECT
        d.id,
        d.partner_id,
        d.first_name,
        d.last_name,
        d.phone,
        d.languages,
        d.status,
        d.uetds_company_id,
        uc.short_name AS uetds_company_short_name,
        d.uetds_subscription_enrolled_at,
        d.uetds_subscription_monthly_fee,
        d.uetds_subscription_currency,
        d.membership_status,
        per.status AS current_period_status,
        next_per.status AS next_period_status,
        dv.id AS default_vehicle_id,
        CASE
          WHEN ea.id IS NULL THEN NULL
          WHEN d.uetds_company_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM partner_uetds_authority_companies ac
            WHERE ac.authority_id = ea.id AND ac.company_id = d.uetds_company_id
          ) THEN NULL
          ELSE ea.id
        END AS default_authority_id,
        p.name AS partner_name,
        p.partner_code
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id
     LEFT JOIN uetds_companies uc ON uc.id = d.uetds_company_id
     LEFT JOIN partner_fleet_defaults fd
       ON fd.driver_id = d.id AND fd.partner_id = d.partner_id
     LEFT JOIN partner_vehicles dv
       ON dv.id = fd.vehicle_id AND dv.partner_id = d.partner_id AND dv.deleted_at IS NULL
     LEFT JOIN partner_uetds_authorities ea
       ON ea.id = d.default_edevlet_authority_id
      AND ea.partner_id = d.partner_id
      AND ea.deleted_at IS NULL
      AND ea.status = 'active'
     LEFT JOIN partner_driver_uetds_subscription_periods per
       ON per.driver_id = d.id
      AND per.period_year = $1
      AND per.period_month = $2
     LEFT JOIN partner_driver_uetds_subscription_periods next_per
       ON next_per.driver_id = d.id
      AND next_per.period_year = $3
      AND next_per.period_month = $4
     WHERE ${listWhere}
     ORDER BY ${orderBy}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    values: listValues,
  };

  return { count, list };
}

export function buildPartnerDriverListQueryPlan(input: {
  partnerId: string;
  period: { year: number; month: number };
}): SqlQueryPlan {
  const nextPeriod = addSubscriptionMonths(input.period, 1);
  return {
    sql: `SELECT d.id,
            d.membership_status,
            d.uetds_subscription_enrolled_at,
            d.uetds_subscription_monthly_fee,
            d.uetds_subscription_currency,
            per.status AS current_period_status,
            next_per.status AS next_period_status
     FROM partner_drivers d
     LEFT JOIN partner_driver_uetds_subscription_periods per
       ON per.driver_id = d.id
      AND per.period_year = $2
      AND per.period_month = $3
     LEFT JOIN partner_driver_uetds_subscription_periods next_per
       ON next_per.driver_id = d.id
      AND next_per.period_year = $4
      AND next_per.period_month = $5
     WHERE d.partner_id = $1
       AND d.deleted_at IS NULL`,
    values: [
      input.partnerId,
      input.period.year,
      input.period.month,
      nextPeriod.year,
      nextPeriod.month,
    ],
  };
}
