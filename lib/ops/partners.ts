import "server-only";

import { type Locale } from "@/lib/i18n/config";
import { getPool, query } from "@/lib/db/postgres";
import { partnerOrderBy, type PartnerListFilters } from "@/lib/ops/partner-filters";
import { parsePartnerApplicationInput } from "@/lib/partner/application-fields";
import {
  type PartnerBusinessType,
  type PartnerPriorityLevel,
  type PartnerStatus,
} from "@/lib/partner/constants";
import { normalizePartnerEmail } from "@/lib/partner/email";
import { parsePartnerPriorityFormValue } from "@/lib/ops/partner-priority";
import {
  canDeactivateExternalPartner,
  isPartnerPriorityLevel,
} from "@/lib/partner/policy";
import {
  partnerActivationReady,
  type OpsPartnerDetail,
  type OpsPartnerListItem,
} from "@/lib/ops/partner-view";

export type { OpsPartnerDetail, OpsPartnerListItem } from "@/lib/ops/partner-view";
export { partnerActivationReady } from "@/lib/ops/partner-view";

type PartnerListRow = {
  id: string;
  partner_code: string;
  name: string;
  status: PartnerStatus;
  is_primary_partner: boolean;
  contact_first_name: string | null;
  contact_last_name: string | null;
  phone: string | null;
  email: string | null;
  priority_level: number | null;
  created_at: Date;
};

type PartnerDetailRow = PartnerListRow & {
  business_type: PartnerBusinessType | null;
  address_line: string | null;
  country_code: string | null;
  tax_office: string | null;
  tax_number: string | null;
  phone_country_code: string | null;
  applied_at: Date | null;
  activated_at: Date | null;
  updated_at: Date;
};

export const OPS_PARTNERS_PAGE_SIZE = 25;

function contactName(first: string | null, last: string | null) {
  const value = [first, last].map((part) => part?.trim()).filter(Boolean).join(" ");
  return value || null;
}

function mapPriority(value: number | null): PartnerPriorityLevel | null {
  return isPartnerPriorityLevel(value ?? 0) ? (value as PartnerPriorityLevel) : null;
}

function mapListItem(row: PartnerListRow): OpsPartnerListItem {
  return {
    id: row.id,
    partnerCode: row.partner_code,
    name: row.name,
    status: row.status,
    isPrimaryPartner: row.is_primary_partner,
    contactName: contactName(row.contact_first_name, row.contact_last_name),
    phone: row.phone,
    email: row.email,
    priorityLevel: mapPriority(row.priority_level),
    createdAt: row.created_at.toISOString(),
  };
}

const LIST_SELECT = `
  p.id,
  p.partner_code,
  p.name,
  p.status,
  p.is_primary_partner,
  p.contact_first_name,
  p.contact_last_name,
  p.phone,
  p.priority_level,
  p.created_at,
  u.email
`;

export async function listOpsPartners(input: {
  query: string;
  status: string;
  page: number;
  pageSize: number;
  locale: Locale;
  sort?: PartnerListFilters["sort"];
  dir?: PartnerListFilters["dir"];
}) {
  const filters: string[] = ["p.deleted_at IS NULL"];
  const values: unknown[] = [];
  const q = input.query.trim();
  if (q) {
    values.push(`%${q}%`);
    filters.push(
      `(p.partner_code ILIKE $${values.length}
        OR p.name ILIKE $${values.length}
        OR p.contact_first_name ILIKE $${values.length}
        OR p.contact_last_name ILIKE $${values.length}
        OR p.phone ILIKE $${values.length}
        OR u.email ILIKE $${values.length})`,
    );
  }
  if (input.status === "pending" || input.status === "active" || input.status === "inactive") {
    values.push(input.status);
    filters.push(`p.status = $${values.length}`);
  }
  const where = filters.join(" AND ");
  const orderBy = partnerOrderBy(
    {
      query: q,
      status: input.status,
      sort: input.sort ?? "",
      dir: input.dir ?? "",
    },
    input.locale,
  );
  const count = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM partners p
     LEFT JOIN LATERAL (
       SELECT email
       FROM partner_users
       WHERE partner_id = p.id
       ORDER BY created_at ASC
       LIMIT 1
     ) u ON TRUE
     WHERE ${where}`,
    values,
  );
  const total = Number(count.rows[0]?.count ?? 0);
  const offset = (input.page - 1) * input.pageSize;
  values.push(input.pageSize, offset);
  const result = await query<PartnerListRow>(
    `SELECT ${LIST_SELECT}
     FROM partners p
     LEFT JOIN LATERAL (
       SELECT email
       FROM partner_users
       WHERE partner_id = p.id
       ORDER BY created_at ASC
       LIMIT 1
     ) u ON TRUE
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { items: result.rows.map(mapListItem), total };
}

export async function getOpsPartner(id: string): Promise<OpsPartnerDetail | null> {
  const result = await query<PartnerDetailRow>(
    `SELECT
        ${LIST_SELECT},
        p.business_type,
        p.address_line,
        p.country_code,
        p.tax_office,
        p.tax_number,
        p.phone_country_code,
        p.applied_at,
        p.activated_at,
        p.updated_at
     FROM partners p
     LEFT JOIN LATERAL (
       SELECT email
       FROM partner_users
       WHERE partner_id = p.id
       ORDER BY created_at ASC
       LIMIT 1
     ) u ON TRUE
     WHERE p.id = $1
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    ...mapListItem(row),
    businessType: row.business_type,
    addressLine: row.address_line,
    countryCode: row.country_code,
    taxOffice: row.tax_office,
    taxNumber: row.tax_number,
    contactFirstName: row.contact_first_name,
    contactLastName: row.contact_last_name,
    phoneCountryCode: row.phone_country_code,
    appliedAt: row.applied_at?.toISOString() ?? null,
    activatedAt: row.activated_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getPrimaryPartnerId() {
  const result = await query<{ id: string }>(
    `SELECT id
     FROM partners
     WHERE is_primary_partner = TRUE
       AND deleted_at IS NULL
     LIMIT 1`,
  );
  return result.rows[0]?.id ?? null;
}

function postgresConstraint(error: unknown) {
  if (!error || typeof error !== "object" || !("constraint" in error)) {
    return null;
  }
  const value = (error as { constraint?: unknown }).constraint;
  return typeof value === "string" ? value : null;
}

export async function updateOpsPartnerProfile(input: {
  partnerId: string;
  opsUserId: string;
  email: string;
  phoneCountryCode: string;
  phoneNational: string;
  contactFirstName: string;
  contactLastName: string;
  businessType: string;
  name: string;
  addressLine: string;
  countryCode: string;
  taxOffice: string;
  taxNumber: string;
  priorityLevel: string;
}) {
  const partner = await getOpsPartner(input.partnerId);
  if (!partner) {
    return { ok: false as const, error: "not-found" as const };
  }
  const parsed = parsePartnerApplicationInput({
    email: input.email,
    phoneCountryCode: input.phoneCountryCode,
    phoneNational: input.phoneNational,
    contactFirstName: input.contactFirstName,
    contactLastName: input.contactLastName,
    businessType: input.businessType,
    name: input.name,
    addressLine: input.addressLine,
    countryCode: input.countryCode,
    taxOffice: input.taxOffice,
    taxNumber: input.taxNumber,
    password: "",
    confirmPassword: "",
    lockCountryToDefault: false,
    skipPassword: true,
  });
  if (!parsed.ok) {
    return parsed;
  }
  const priority = parsePartnerPriorityFormValue(input.priorityLevel);
  if (!priority.ok) {
    return { ok: false as const, error: "invalid-priority" as const };
  }
  const email = normalizePartnerEmail(parsed.value.email);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      "tripetica:partner-primary",
    ]);
    if (priority.isPrimary) {
      const taken = await client.query<{ id: string }>(
        `SELECT id
         FROM partners
         WHERE is_primary_partner = TRUE
           AND deleted_at IS NULL
           AND id <> $1
         LIMIT 1
         FOR UPDATE`,
        [input.partnerId],
      );
      if (taken.rows[0]) {
        await client.query("ROLLBACK");
        return { ok: false as const, error: "primary-taken" as const };
      }
    }
    const emailTaken = await client.query<{ id: string }>(
      `SELECT id
       FROM partner_users
       WHERE lower(email) = $1
         AND partner_id <> $2
       LIMIT 1`,
      [email, input.partnerId],
    );
    if (emailTaken.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "duplicate" as const };
    }
    await client.query(
      `UPDATE partners
       SET name = $2,
           business_type = $3,
           address_line = $4,
           country_code = $5,
           tax_office = $6,
           tax_number = $7,
           contact_first_name = $8,
           contact_last_name = $9,
           phone = $10,
           phone_country_code = $11,
           is_primary_partner = $12,
           priority_level = $13,
           status = CASE WHEN $12::boolean THEN 'active' ELSE status END,
           activated_at = CASE
             WHEN $12::boolean THEN COALESCE(activated_at, NOW())
             ELSE activated_at
           END,
           activated_by_ops_user_id = CASE
             WHEN $12::boolean THEN COALESCE(activated_by_ops_user_id, $14)
             ELSE activated_by_ops_user_id
           END,
           last_edited_by_ops_user_id = $14,
           updated_at = NOW()
       WHERE id = $1
         AND deleted_at IS NULL`,
      [
        input.partnerId,
        parsed.value.name,
        parsed.value.businessType,
        parsed.value.addressLine,
        parsed.value.countryCode,
        parsed.value.taxOffice,
        parsed.value.taxNumber,
        parsed.value.contactFirstName,
        parsed.value.contactLastName,
        parsed.value.phone,
        parsed.value.phoneCountryCode,
        priority.isPrimary,
        priority.level,
        input.opsUserId,
      ],
    );
    await client.query(
      `UPDATE partner_users
       SET email = $2,
           status = CASE WHEN $3::boolean THEN 'active' ELSE status END
       WHERE id = (
         SELECT id FROM partner_users
         WHERE partner_id = $1
         ORDER BY created_at ASC
         LIMIT 1
       )`,
      [input.partnerId, email, priority.isPrimary],
    );
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      if (postgresConstraint(error) === "partners_one_primary_uidx") {
        return { ok: false as const, error: "primary-taken" as const };
      }
      return { ok: false as const, error: "duplicate" as const };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function activateOpsPartner(input: {
  partnerId: string;
  opsUserId: string;
}) {
  const partner = await getOpsPartner(input.partnerId);
  if (!partner) {
    return { ok: false as const, error: "not-found" as const };
  }
  if (partner.isPrimaryPartner) {
    return { ok: false as const, error: "primary" as const };
  }
  if (!partner.priorityLevel) {
    return { ok: false as const, error: "missing-priority" as const };
  }
  if (!partnerActivationReady(partner)) {
    return { ok: false as const, error: "incomplete" as const };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query<{ id: string }>(
      `UPDATE partners
       SET status = 'active',
           activated_at = COALESCE(activated_at, NOW()),
           activated_by_ops_user_id = COALESCE(activated_by_ops_user_id, $2),
           last_edited_by_ops_user_id = $2
       WHERE id = $1
         AND is_primary_partner = FALSE
         AND deleted_at IS NULL
         AND status IN ('pending', 'inactive')
         AND priority_level IN (1, 2, 3)
       RETURNING id`,
      [input.partnerId, input.opsUserId],
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "incomplete" as const };
    }
    await client.query(
      `UPDATE partner_users
       SET status = 'active'
       WHERE partner_id = $1`,
      [input.partnerId],
    );
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deactivateOpsPartner(input: {
  partnerId: string;
  opsUserId: string;
}) {
  const partner = await getOpsPartner(input.partnerId);
  if (!partner) {
    return { ok: false as const, error: "not-found" as const };
  }
  if (!canDeactivateExternalPartner(partner)) {
    return { ok: false as const, error: "primary" as const };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query<{ id: string }>(
      `UPDATE partners
       SET status = 'inactive',
           is_primary_partner = FALSE,
           last_edited_by_ops_user_id = $2
       WHERE id = $1
         AND deleted_at IS NULL
         AND status = 'active'
       RETURNING id`,
      [input.partnerId, input.opsUserId],
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "incomplete" as const };
    }
    await client.query(
      `UPDATE partner_users
       SET status = 'inactive'
       WHERE partner_id = $1`,
      [input.partnerId],
    );
    await client.query(
      `DELETE FROM partner_sessions
       WHERE user_id IN (
         SELECT id FROM partner_users WHERE partner_id = $1
       )`,
      [input.partnerId],
    );
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOpsPartner(input: {
  partnerId: string;
  opsUserId: string;
}) {
  const partner = await getOpsPartner(input.partnerId);
  if (!partner) {
    return { ok: false as const, error: "not-found" as const };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query<{ id: string }>(
      `UPDATE partners
       SET status = 'inactive',
           is_primary_partner = FALSE,
           deleted_at = NOW(),
           deleted_by_ops_user_id = $2,
           last_edited_by_ops_user_id = $2
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id`,
      [input.partnerId, input.opsUserId],
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "not-found" as const };
    }
    await client.query(
      `UPDATE partner_users
       SET status = 'inactive'
       WHERE partner_id = $1`,
      [input.partnerId],
    );
    await client.query(
      `DELETE FROM partner_sessions
       WHERE user_id IN (
         SELECT id FROM partner_users WHERE partner_id = $1
       )`,
      [input.partnerId],
    );
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
