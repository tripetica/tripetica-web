import "server-only";

import { type PoolClient } from "pg";
import { query } from "@/lib/db/postgres";

export type OpsRecordAuditKind = "process" | "reservation";

export type OpsAuditChange = {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
};

function serializeAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  return JSON.stringify(value);
}

export function diffAuditValues(
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
): OpsAuditChange | null {
  const oldText = serializeAuditValue(oldValue);
  const newText = serializeAuditValue(newValue);
  if (oldText === newText) {
    return null;
  }
  return { fieldName, oldValue: oldText, newValue: newText };
}

export async function writeOpsRecordAudits(
  client: PoolClient,
  input: {
    recordKind: OpsRecordAuditKind;
    recordId: string;
    changedBy: string;
    changes: OpsAuditChange[];
  },
) {
  if (input.changes.length === 0) {
    return;
  }
  for (const change of input.changes) {
    await client.query(
      `INSERT INTO ops_record_audits (
         record_kind, record_id, field_name, old_value, new_value, changed_by
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.recordKind,
        input.recordId,
        change.fieldName,
        change.oldValue,
        change.newValue,
        input.changedBy,
      ],
    );
  }
}

export async function listOpsRecordAudits(
  recordKind: OpsRecordAuditKind,
  recordId: string,
  limit = 200,
) {
  const result = await query<{
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_at: Date;
    changed_by: string;
  }>(
    `SELECT field_name, old_value, new_value, changed_at, changed_by
     FROM ops_record_audits
     WHERE record_kind = $1 AND record_id = $2
     ORDER BY changed_at DESC
     LIMIT $3`,
    [recordKind, recordId, limit],
  );
  return result.rows.map((row) => ({
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedAt: row.changed_at.toISOString(),
    changedBy: row.changed_by,
  }));
}
