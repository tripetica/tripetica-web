import "server-only";

import { query } from "@/lib/db/postgres";
import { type OpsDriverListFilters } from "@/lib/ops/driver-filters";
import { foldDriverSearchText } from "@/lib/partner/driver-list-view";
import { normalizePartnerDriverLanguageCodes } from "@/lib/partner/driver-languages";
import {
  partnerDriverFullName,
  type PartnerDriverRecord,
  type PartnerFleetStatus,
} from "@/lib/partner/fleet-view";

export const OPS_DRIVERS_PAGE_SIZE = 25;

export type OpsDriverListItem = {
  id: string;
  fullName: string;
  phone: string | null;
  languageCodes: string[];
  status: PartnerFleetStatus;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
};

export type OpsDriverRecord = PartnerDriverRecord & {
  partnerName: string;
  partnerCode: string;
};

type DriverListRow = {
  id: string;
  partner_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  languages: string[] | null;
  status: PartnerFleetStatus;
  partner_name: string;
  partner_code: string;
};

type DriverDetailRow = DriverListRow & {
  national_id: string | null;
  phone_country_code: string | null;
  deleted_at: Date | null;
  updated_at: Date;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function mapListItem(row: DriverListRow): OpsDriverListItem {
  return {
    id: row.id,
    fullName: partnerDriverFullName(row.first_name, row.last_name),
    phone: row.phone,
    languageCodes: normalizePartnerDriverLanguageCodes(row.languages ?? []),
    status: row.status,
    partnerId: row.partner_id,
    partnerName: row.partner_name,
    partnerCode: row.partner_code,
  };
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

export async function listOpsDrivers(input: {
  query: string;
  dir: OpsDriverListFilters["dir"];
  page: number;
  pageSize?: number;
}) {
  const pageSize = input.pageSize ?? OPS_DRIVERS_PAGE_SIZE;
  const values: unknown[] = [];
  const filters = ["d.deleted_at IS NULL", "p.deleted_at IS NULL"];
  const search = searchFilters(input.query, values);
  if (search) {
    filters.push(search);
  }
  const where = filters.join(" AND ");
  const direction = input.dir === "desc" ? "DESC" : "ASC";
  const orderBy = `(d.first_name || ' ' || d.last_name) COLLATE "tr-x-icu" ${direction}, d.id ASC`;
  const count = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id
     WHERE ${where}`,
    values,
  );
  const total = Number(count.rows[0]?.count ?? 0);
  const page = Math.max(1, input.page);
  const offset = (page - 1) * pageSize;
  values.push(pageSize, offset);
  const result = await query<DriverListRow>(
    `SELECT
        d.id,
        d.partner_id,
        d.first_name,
        d.last_name,
        d.phone,
        d.languages,
        d.status,
        p.name AS partner_name,
        p.partner_code
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { items: result.rows.map(mapListItem), total, page, pageSize };
}

export async function getOpsDriver(driverId: string): Promise<OpsDriverRecord | null> {
  const result = await query<DriverDetailRow>(
    `SELECT
        d.id,
        d.partner_id,
        d.first_name,
        d.last_name,
        d.national_id,
        d.phone,
        d.phone_country_code,
        d.languages,
        d.status,
        d.deleted_at,
        d.updated_at,
        p.name AS partner_name,
        p.partner_code
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id
     WHERE d.id = $1
       AND d.deleted_at IS NULL
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [driverId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    partnerId: row.partner_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: partnerDriverFullName(row.first_name, row.last_name),
    nationalId: row.national_id,
    phone: row.phone,
    phoneCountryCode: row.phone_country_code,
    languageCodes: normalizePartnerDriverLanguageCodes(row.languages ?? []),
    status: row.status,
    deletedAt: row.deleted_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
    partnerName: row.partner_name,
    partnerCode: row.partner_code,
  };
}
