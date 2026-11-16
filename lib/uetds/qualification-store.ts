import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import {
  qualificationSrcReady,
  type DriverQualificationView,
  type QualificationDocument,
  type QualificationOutcome,
} from "@/lib/uetds/qualification";

export type { DriverQualificationView };
import { queryDriverQualification } from "@/lib/uetds/qualification-query";

function documentsFromJson(value: unknown): QualificationDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "";
    const status = record.status === "invalid" ? "invalid" : "valid";
    if (!type) return [];
    return [{
      type,
      status,
      number: typeof record.number === "string" ? record.number : null,
      expiresOn: typeof record.expiresOn === "string" ? record.expiresOn : null,
    } satisfies QualificationDocument];
  });
}

export async function readDriverQualification(driverId: string, companyId: string | null): Promise<DriverQualificationView> {
  if (!companyId || !isUuid(driverId) || !isUuid(companyId)) {
    return { state: "not-queried", documents: [], srcReady: false, verifiedAt: null, attemptedAt: null, latestFailed: false };
  }
  const result = await query<{
    documents: unknown;
    verified_at: Date | null;
    attempted_at: Date;
    attempt_status: "verified" | "unverified";
  }>(
    `SELECT documents, verified_at, attempted_at, attempt_status
       FROM driver_qualification_checks
      WHERE driver_id = $1 AND company_id = $2
      LIMIT 1`,
    [driverId, companyId],
  );
  const row = result.rows[0];
  if (!row) {
    return { state: "not-queried", documents: [], srcReady: false, verifiedAt: null, attemptedAt: null, latestFailed: false };
  }
  const documents = row.attempt_status === "verified" || row.verified_at ? documentsFromJson(row.documents) : [];
  const verifiedAt = row.verified_at?.toISOString() ?? null;
  return {
    state: verifiedAt ? "verified" : "unverified",
    documents: verifiedAt ? documents : [],
    srcReady: qualificationSrcReady(documents),
    verifiedAt,
    attemptedAt: row.attempted_at.toISOString(),
    latestFailed: row.attempt_status === "unverified" && Boolean(verifiedAt),
  };
}

export async function saveDriverQualification(input: {
  driverId: string;
  companyId: string;
  outcome: QualificationOutcome;
}) {
  if (input.outcome.status === "verified") {
    await query(
      `INSERT INTO driver_qualification_checks (
         driver_id, company_id, documents, verified_at, attempted_at, attempt_status, sonuc_kodu
       ) VALUES ($1, $2, $3::jsonb, NOW(), NOW(), 'verified', $4)
       ON CONFLICT (driver_id, company_id) DO UPDATE
         SET documents = EXCLUDED.documents,
             verified_at = NOW(),
             attempted_at = NOW(),
             attempt_status = 'verified',
             sonuc_kodu = EXCLUDED.sonuc_kodu`,
      [input.driverId, input.companyId, JSON.stringify(input.outcome.documents), input.outcome.sonucKodu],
    );
    return;
  }
  await query(
    `INSERT INTO driver_qualification_checks (
       driver_id, company_id, documents, verified_at, attempted_at, attempt_status, sonuc_kodu
     ) VALUES ($1, $2, '[]'::jsonb, NULL, NOW(), 'unverified', $3)
     ON CONFLICT (driver_id, company_id) DO UPDATE
       SET attempted_at = NOW(),
           attempt_status = 'unverified',
           sonuc_kodu = EXCLUDED.sonuc_kodu`,
    [input.driverId, input.companyId, input.outcome.sonucKodu],
  );
}

export async function refreshDriverQualification(driverId: string, companyId: string, nationalId: string) {
  const outcome = await queryDriverQualification(companyId, nationalId);
  await saveDriverQualification({ driverId, companyId, outcome });
  return readDriverQualification(driverId, companyId);
}
