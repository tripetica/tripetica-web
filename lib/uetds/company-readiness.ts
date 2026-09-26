import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import {
  mapUetdsCompanyReadiness,
  type UetdsCompanyReadiness,
} from "@/lib/uetds/eligibility";

type CompanyRow = {
  id: string;
  short_name: string;
  status: string;
  integration_status: string;
};

export async function loadUetdsCompanyReadiness(
  ids: readonly string[],
): Promise<Map<string, UetdsCompanyReadiness>> {
  const unique = [...new Set(ids.filter((id) => isUuid(id)))];
  if (unique.length === 0) {
    return new Map();
  }
  const result = await query<CompanyRow>(
    `SELECT id, short_name, status, integration_status
     FROM uetds_companies
     WHERE id = ANY($1::uuid[])`,
    [unique],
  );
  return new Map(
    result.rows
      .map((row) =>
        mapUetdsCompanyReadiness({
          id: row.id,
          shortName: row.short_name,
          status: row.status,
          integrationStatus: row.integration_status,
        }),
      )
      .filter((company): company is UetdsCompanyReadiness => Boolean(company))
      .map((company) => [company.id, company]),
  );
}
