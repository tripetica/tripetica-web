import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { joinPartnerContactName } from "@/lib/partner/contact-name";
import { sealSecret } from "@/lib/security/sealed-secret";
import {
  isEdevletAuthorityStatus,
  maskNationalIdLast4,
  parseAuthorityName,
  parseOptionalNationalId,
  parseOptionalPassword,
  type EdevletAuthorityCompanyRef,
  type EdevletAuthorityStatus,
  type OpsEdevletAuthoritySummary,
  type PartnerEdevletAuthoritySummary,
} from "./partner-authority-fields";

type AuthorityRow = {
  id: string;
  first_name: string;
  last_name: string;
  identity_last4: string;
  status: string;
};

type CompanyRow = {
  id: string;
  short_name: string;
};

function toSummary(
  row: AuthorityRow,
  companies: EdevletAuthorityCompanyRef[],
): PartnerEdevletAuthoritySummary | null {
  if (!isEdevletAuthorityStatus(row.status)) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: joinPartnerContactName(row.first_name, row.last_name),
    maskedIdentity: maskNationalIdLast4(row.identity_last4),
    status: row.status,
    companies,
  };
}

async function loadCompanies(partnerId: string, authorityId: string) {
  const result = await query<CompanyRow>(
    `SELECT c.id, c.short_name
       FROM partner_uetds_authority_companies ac
       JOIN partner_uetds_authorities a ON a.id = ac.authority_id
       JOIN uetds_companies c ON c.id = ac.company_id
      WHERE a.id = $1
        AND a.partner_id = $2
        AND a.deleted_at IS NULL
      ORDER BY c.short_name ASC, c.id ASC`,
    [authorityId, partnerId],
  );
  return result.rows.map((row) => ({ id: row.id, shortName: row.short_name }));
}

async function assertAssignableCompanyIds(
  companyIds: readonly string[],
  alreadyLinkedIds: readonly string[],
) {
  const unique = [...new Set(companyIds)];
  if (unique.some((id) => !isUuid(id))) return null;
  if (unique.length === 0) return [];
  const result = await query<{ id: string }>(
    `SELECT id
       FROM uetds_companies
      WHERE status = 'active'
        AND id = ANY($1::uuid[])`,
    [unique],
  );
  const active = new Set(result.rows.map((row) => row.id));
  const linked = new Set(alreadyLinkedIds);
  if (unique.some((id) => !active.has(id) && !linked.has(id))) return null;
  return unique;
}

async function replaceCompanyLinks(partnerId: string, authorityId: string, companyIds: readonly string[]) {
  await query(
    `DELETE FROM partner_uetds_authority_companies ac
      USING partner_uetds_authorities a
      WHERE ac.authority_id = a.id
        AND a.id = $1
        AND a.partner_id = $2
        AND a.deleted_at IS NULL`,
    [authorityId, partnerId],
  );
  for (const companyId of companyIds) {
    await query(
      `INSERT INTO partner_uetds_authority_companies (authority_id, company_id)
       SELECT a.id, $3
         FROM partner_uetds_authorities a
        WHERE a.id = $1
          AND a.partner_id = $2
          AND a.deleted_at IS NULL
       ON CONFLICT DO NOTHING`,
      [authorityId, partnerId, companyId],
    );
  }
}

/** Partner-scoped list. Selects no sealed columns. */
export async function listPartnerEdevletAuthorities(partnerId: string) {
  if (!isUuid(partnerId)) return [];
  const result = await query<AuthorityRow>(
    `SELECT id, first_name, last_name, identity_last4, status
       FROM partner_uetds_authorities
      WHERE partner_id = $1
        AND deleted_at IS NULL
      ORDER BY last_name ASC, first_name ASC, created_at ASC`,
    [partnerId],
  );
  const summaries: PartnerEdevletAuthoritySummary[] = [];
  for (const row of result.rows) {
    const summary = toSummary(row, await loadCompanies(partnerId, row.id));
    if (summary) summaries.push(summary);
  }
  return summaries;
}

/** Returns null when the authority belongs to another partner or is deleted. */
export async function getPartnerEdevletAuthority(partnerId: string, authorityId: string) {
  if (!isUuid(partnerId) || !isUuid(authorityId)) return null;
  const result = await query<AuthorityRow>(
    `SELECT id, first_name, last_name, identity_last4, status
       FROM partner_uetds_authorities
      WHERE id = $1
        AND partner_id = $2
        AND deleted_at IS NULL
      LIMIT 1`,
    [authorityId, partnerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return toSummary(row, await loadCompanies(partnerId, row.id));
}

export async function createPartnerEdevletAuthority(
  partnerId: string,
  input: {
    firstName: string;
    lastName: string;
    identity: string;
    password: string;
    companyIds: readonly string[];
    status: EdevletAuthorityStatus;
  },
) {
  if (!isUuid(partnerId) || !isEdevletAuthorityStatus(input.status)) return null;
  const firstName = parseAuthorityName(input.firstName);
  const lastName = parseAuthorityName(input.lastName);
  const identity = parseOptionalNationalId(input.identity);
  const password = parseOptionalPassword(input.password);
  if (!firstName || !lastName || !identity.ok || !password.ok || !identity.identity || !password.password) {
    return null;
  }
  const companyIds = await assertAssignableCompanyIds(input.companyIds, []);
  if (!companyIds) return null;
  const inserted = await query<{ id: string }>(
    `INSERT INTO partner_uetds_authorities (
       partner_id, first_name, last_name, identity_sealed, identity_last4, password_sealed, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      partnerId,
      firstName,
      lastName,
      sealSecret(identity.identity),
      identity.identity.slice(-4),
      sealSecret(password.password),
      input.status,
    ],
  );
  const id = inserted.rows[0]?.id;
  if (!id) return null;
  await replaceCompanyLinks(partnerId, id, companyIds);
  return getPartnerEdevletAuthority(partnerId, id);
}

/**
 * Empty identity or password keeps the existing ciphertext.
 * Callers must not decrypt on this path.
 */
export async function updatePartnerEdevletAuthority(
  partnerId: string,
  authorityId: string,
  input: {
    firstName: string;
    lastName: string;
    identity: string;
    password: string;
    companyIds: readonly string[];
  },
) {
  if (!isUuid(partnerId) || !isUuid(authorityId)) return null;
  const firstName = parseAuthorityName(input.firstName);
  const lastName = parseAuthorityName(input.lastName);
  const identity = parseOptionalNationalId(input.identity);
  const password = parseOptionalPassword(input.password);
  if (!firstName || !lastName || !identity.ok || !password.ok) return null;
  const current = await getPartnerEdevletAuthority(partnerId, authorityId);
  if (!current) return null;
  const companyIds = await assertAssignableCompanyIds(
    input.companyIds,
    current.companies.map((company) => company.id),
  );
  if (!companyIds) return null;
  const identitySealed = identity.identity ? sealSecret(identity.identity) : null;
  const passwordSealed = password.password ? sealSecret(password.password) : null;
  const updated = await query<{ id: string }>(
    `UPDATE partner_uetds_authorities
        SET first_name = $3,
            last_name = $4,
            identity_sealed = COALESCE($5, identity_sealed),
            identity_last4 = COALESCE($6, identity_last4),
            password_sealed = COALESCE($7, password_sealed),
            updated_at = NOW()
      WHERE id = $1
        AND partner_id = $2
        AND deleted_at IS NULL
      RETURNING id`,
    [
      authorityId,
      partnerId,
      firstName,
      lastName,
      identitySealed,
      identity.identity ? identity.identity.slice(-4) : null,
      passwordSealed,
    ],
  );
  if (!updated.rows[0]) return null;
  await replaceCompanyLinks(partnerId, authorityId, companyIds);
  return getPartnerEdevletAuthority(partnerId, authorityId);
}

export async function setPartnerEdevletAuthorityStatus(
  partnerId: string,
  authorityId: string,
  status: EdevletAuthorityStatus,
) {
  if (!isUuid(partnerId) || !isUuid(authorityId) || !isEdevletAuthorityStatus(status)) return null;
  const fromStatus = status === "active" ? "inactive" : "active";
  const updated = await query<{ id: string }>(
    `UPDATE partner_uetds_authorities
        SET status = $3,
            updated_at = NOW()
      WHERE id = $1
        AND partner_id = $2
        AND deleted_at IS NULL
        AND status = $4
      RETURNING id`,
    [authorityId, partnerId, status, fromStatus],
  );
  if (!updated.rows[0]) return null;
  return getPartnerEdevletAuthority(partnerId, authorityId);
}

type OpsAuthorityRow = AuthorityRow & {
  partner_id: string;
  partner_name: string;
};

/** All partners. Selects no sealed columns and no plaintext password. */
export async function listOpsEdevletAuthorities(): Promise<OpsEdevletAuthoritySummary[]> {
  const result = await query<OpsAuthorityRow>(
    `SELECT a.id, a.partner_id, p.name AS partner_name, a.first_name, a.last_name, a.identity_last4, a.status
       FROM partner_uetds_authorities a
       JOIN partners p ON p.id = a.partner_id
      WHERE a.deleted_at IS NULL
      ORDER BY p.name ASC, a.last_name ASC, a.first_name ASC, a.id ASC`,
  );
  const summaries: OpsEdevletAuthoritySummary[] = [];
  for (const row of result.rows) {
    const summary = toSummary(row, await loadCompanies(row.partner_id, row.id));
    if (!summary || !isUuid(row.partner_id)) continue;
    summaries.push({
      ...summary,
      partnerId: row.partner_id,
      partnerName: row.partner_name?.trim() || "—",
    });
  }
  return summaries;
}

/** Lookup by authority id. The partner id comes from the row, not from the caller. */
export async function getOpsEdevletAuthority(authorityId: string): Promise<OpsEdevletAuthoritySummary | null> {
  if (!isUuid(authorityId)) return null;
  const result = await query<OpsAuthorityRow>(
    `SELECT a.id, a.partner_id, p.name AS partner_name, a.first_name, a.last_name, a.identity_last4, a.status
       FROM partner_uetds_authorities a
       JOIN partners p ON p.id = a.partner_id
      WHERE a.id = $1
        AND a.deleted_at IS NULL
      LIMIT 1`,
    [authorityId],
  );
  const row = result.rows[0];
  if (!row || !isUuid(row.partner_id)) return null;
  const summary = toSummary(row, await loadCompanies(row.partner_id, row.id));
  if (!summary) return null;
  return {
    ...summary,
    partnerId: row.partner_id,
    partnerName: row.partner_name?.trim() || "—",
  };
}

/** Soft-delete. The sealed credential row is retained and hidden. */
export async function deletePartnerEdevletAuthority(partnerId: string, authorityId: string) {
  if (!isUuid(partnerId) || !isUuid(authorityId)) return false;
  const updated = await query<{ id: string }>(
    `UPDATE partner_uetds_authorities
        SET deleted_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
        AND partner_id = $2
        AND deleted_at IS NULL
      RETURNING id`,
    [authorityId, partnerId],
  );
  return Boolean(updated.rows[0]);
}
