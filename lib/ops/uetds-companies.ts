import "server-only";

import { query } from "@/lib/db/postgres";
import { SealedSecretError, sealSecret } from "@/lib/security/sealed-secret";
import {
  computeUetdsIntegrationStatus,
  isUetdsAuthorityType,
  isUetdsCompanyStatus,
  isUetdsIntegrationStatus,
  type UetdsCompanyEditor,
  type UetdsCompanyInput,
  type UetdsCompanyListItem,
  type UetdsCompanyStatus,
  type UetdsIntegrationStatus,
} from "@/lib/ops/uetds-company-fields";
import { type UetdsCompanyListFilters } from "@/lib/ops/uetds-company-filters";

export const OPS_UETDS_COMPANIES_PAGE_SIZE = 25;

type CompanyListRow = {
  id: string;
  short_name: string;
  legal_name: string;
  tax_number: string;
  authority_document_type: string;
  authority_document_number: string;
  status: string;
  integration_status: string;
  created_at: Date;
  updated_at: Date;
};

type CompanyEditorRow = CompanyListRow & {
  test_username: string | null;
  live_username: string | null;
  has_test_password: boolean;
  has_live_password: boolean;
};

const LIST_SELECT = `
  id,
  short_name,
  legal_name,
  tax_number,
  authority_document_type,
  authority_document_number,
  status,
  integration_status,
  created_at,
  updated_at
`;

function mapStatus(value: string): UetdsCompanyStatus {
  return isUetdsCompanyStatus(value) ? value : "inactive";
}

function mapIntegration(value: string): UetdsIntegrationStatus {
  return isUetdsIntegrationStatus(value) ? value : "incomplete";
}

function mapAuthority(value: string) {
  return isUetdsAuthorityType(value) ? value : "D2";
}

function mapListItem(row: CompanyListRow): UetdsCompanyListItem {
  return {
    id: row.id,
    shortName: row.short_name,
    legalName: row.legal_name,
    taxNumber: row.tax_number,
    authorityDocumentType: mapAuthority(row.authority_document_type),
    authorityDocumentNumber: row.authority_document_number,
    status: mapStatus(row.status),
    integrationStatus: mapIntegration(row.integration_status),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapEditor(row: CompanyEditorRow): UetdsCompanyEditor {
  return {
    ...mapListItem(row),
    testUsername: row.test_username ?? "",
    liveUsername: row.live_username ?? "",
    hasTestPassword: row.has_test_password,
    hasLivePassword: row.has_live_password,
  };
}

function sealPassword(value: string | null) {
  if (!value) {
    return null;
  }
  return sealSecret(value);
}

export function classifyUetdsCompanySaveError(error: unknown): {
  reason:
    | "sealed_secret_key_missing"
    | "sealed_secret_unavailable"
    | "db_error"
    | "unknown";
  dbCode?: string;
} {
  if (error instanceof SealedSecretError) {
    return {
      reason: process.env.UETDS_CREDENTIALS_KEY?.trim()
        ? "sealed_secret_unavailable"
        : "sealed_secret_key_missing",
    };
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return { reason: "db_error", dbCode: (error as { code: string }).code };
  }
  return { reason: "unknown" };
}

export function resolveUetdsEnvPassword(input: {
  username: string;
  nextPassword: string | null;
  existingSealed: string | null;
}) {
  if (!input.username) {
    return null;
  }
  if (input.nextPassword) {
    return sealPassword(input.nextPassword);
  }
  return input.existingSealed;
}

export async function listOpsUetdsCompanies(input: {
  filters: UetdsCompanyListFilters;
  page: number;
  pageSize?: number;
}) {
  const pageSize = input.pageSize ?? OPS_UETDS_COMPANIES_PAGE_SIZE;
  const page = input.page > 0 ? input.page : 1;
  const offset = (page - 1) * pageSize;
  const like = input.filters.query ? `%${input.filters.query}%` : "";
  const result = await query<CompanyListRow & { total_count: string }>(
    `SELECT ${LIST_SELECT}, COUNT(*) OVER()::text AS total_count
     FROM uetds_companies
     WHERE ($1 = '' OR (
       short_name ILIKE $1
       OR legal_name ILIKE $1
       OR tax_number ILIKE $1
       OR authority_document_number ILIKE $1
     ))
       AND ($2 = '' OR status = $2)
     ORDER BY updated_at DESC, short_name ASC, id ASC
     LIMIT $3 OFFSET $4`,
    [like, input.filters.status, pageSize, offset],
  );
  return {
    items: result.rows.map(mapListItem),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}

export async function getOpsUetdsCompanyEditor(
  id: string,
): Promise<UetdsCompanyEditor | null> {
  const result = await query<CompanyEditorRow>(
    `SELECT ${LIST_SELECT},
            test_username,
            live_username,
            (test_password_sealed IS NOT NULL AND test_password_sealed <> '') AS has_test_password,
            (live_password_sealed IS NOT NULL AND live_password_sealed <> '') AS has_live_password
     FROM uetds_companies
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  return row ? mapEditor(row) : null;
}

export async function saveOpsUetdsCompany(input: {
  id?: string;
  fields: UetdsCompanyInput;
}): Promise<{ ok: true; id: string } | { ok: false; error: "invalid" | "failed" }> {
  try {
    let existingSealed = {
      test: null as string | null,
      live: null as string | null,
    };
    if (input.id) {
      const existing = await query<{
        test_password_sealed: string | null;
        live_password_sealed: string | null;
      }>(
        `SELECT test_password_sealed, live_password_sealed
         FROM uetds_companies
         WHERE id = $1
         LIMIT 1`,
        [input.id],
      );
      if (!existing.rows[0]) {
        return { ok: false, error: "invalid" };
      }
      existingSealed = {
        test: existing.rows[0].test_password_sealed,
        live: existing.rows[0].live_password_sealed,
      };
    }

    const testPasswordSealed = resolveUetdsEnvPassword({
      username: input.fields.testUsername,
      nextPassword: input.fields.testPassword,
      existingSealed: existingSealed.test,
    });
    const livePasswordSealed = resolveUetdsEnvPassword({
      username: input.fields.liveUsername,
      nextPassword: input.fields.livePassword,
      existingSealed: existingSealed.live,
    });
    const integrationStatus = computeUetdsIntegrationStatus({
      shortName: input.fields.shortName,
      legalName: input.fields.legalName,
      taxNumber: input.fields.taxNumber,
      authorityDocumentType: input.fields.authorityDocumentType,
      authorityDocumentNumber: input.fields.authorityDocumentNumber,
      testUsername: input.fields.testUsername,
      liveUsername: input.fields.liveUsername,
      hasTestPassword: Boolean(testPasswordSealed),
      hasLivePassword: Boolean(livePasswordSealed),
    });

    if (input.id) {
      const updated = await query<{ id: string }>(
        `UPDATE uetds_companies
         SET short_name = $2,
             legal_name = $3,
             tax_number = $4,
             authority_document_type = $5,
             authority_document_number = $6,
             status = $7,
             integration_status = $8,
             test_username = $9,
             test_password_sealed = $10,
             live_username = $11,
             live_password_sealed = $12
         WHERE id = $1
         RETURNING id`,
        [
          input.id,
          input.fields.shortName,
          input.fields.legalName,
          input.fields.taxNumber,
          input.fields.authorityDocumentType,
          input.fields.authorityDocumentNumber,
          input.fields.status,
          integrationStatus,
          input.fields.testUsername || null,
          testPasswordSealed,
          input.fields.liveUsername || null,
          livePasswordSealed,
        ],
      );
      const id = updated.rows[0]?.id;
      return id ? { ok: true, id } : { ok: false, error: "invalid" };
    }

    const created = await query<{ id: string }>(
      `INSERT INTO uetds_companies (
         short_name,
         legal_name,
         tax_number,
         authority_document_type,
         authority_document_number,
         status,
         integration_status,
         test_username,
         test_password_sealed,
         live_username,
         live_password_sealed
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        input.fields.shortName,
        input.fields.legalName,
        input.fields.taxNumber,
        input.fields.authorityDocumentType,
        input.fields.authorityDocumentNumber,
        input.fields.status,
        integrationStatus,
        input.fields.testUsername || null,
        testPasswordSealed,
        input.fields.liveUsername || null,
        livePasswordSealed,
      ],
    );
    const id = created.rows[0]?.id;
    return id ? { ok: true, id } : { ok: false, error: "failed" };
  } catch (error) {
    console.error("[ops-uetds-company] save failed", classifyUetdsCompanySaveError(error));
    return { ok: false, error: "failed" };
  }
}
