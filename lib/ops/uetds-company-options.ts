import "server-only";

import { query } from "@/lib/db/postgres";
import {
  UETDS_NOTIFY_NONE_VALUE,
  type UetdsCompanyRef,
} from "@/lib/ops/uetds-company-fields";

export { buildUetdsCompanySelectOptions } from "@/lib/ops/uetds-company-options-view";

export function parseUetdsCompanyFormValue(raw: string) {
  const value = raw.trim();
  if (!value || value === UETDS_NOTIFY_NONE_VALUE || value === "none") {
    return null;
  }
  return value;
}

export async function listActiveUetdsCompanyOptions(): Promise<UetdsCompanyRef[]> {
  const result = await query<{ id: string; short_name: string }>(
    `SELECT id, short_name
     FROM uetds_companies
     WHERE status = 'active'
     ORDER BY short_name ASC, id ASC`,
  );
  return result.rows.map((row) => ({ id: row.id, shortName: row.short_name }));
}

export async function resolveAssignableUetdsCompanyId(input: {
  requestedId: string | null;
  currentId: string | null;
}): Promise<{ ok: true; companyId: string | null } | { ok: false }> {
  if (!input.requestedId) {
    return { ok: true, companyId: null };
  }
  if (input.currentId && input.requestedId === input.currentId) {
    return { ok: true, companyId: input.currentId };
  }
  const result = await query<{ id: string }>(
    `SELECT id
     FROM uetds_companies
     WHERE id = $1
       AND status = 'active'
     LIMIT 1`,
    [input.requestedId],
  );
  const id = result.rows[0]?.id;
  return id ? { ok: true, companyId: id } : { ok: false };
}

export async function resolveUetdsCompanyIdFromForm(
  formData: FormData,
  currentId: string | null,
) {
  return resolveAssignableUetdsCompanyId({
    requestedId: parseUetdsCompanyFormValue(String(formData.get("uetdsCompanyId") ?? "")),
    currentId,
  });
}
