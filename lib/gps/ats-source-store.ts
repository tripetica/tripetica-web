import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { atsSlotLockKey, parseAtsMinistrySource, type AtsMinistrySource, type AtsSourceAudit } from "@/lib/gps/ats-source";

export async function getVehicleAtsMinistrySource(vehicleId: string): Promise<AtsMinistrySource> {
  const result = await query<{ ats_ministry_source: string }>(
    `SELECT ats_ministry_source FROM partner_vehicles WHERE id = $1 AND deleted_at IS NULL`,
    [vehicleId],
  );
  return parseAtsMinistrySource(result.rows[0]?.ats_ministry_source ?? "") ?? "none";
}

export async function vehicleHasOpenAtsTrip(vehicleId: string) {
  const result = await query<{ id: string }>(
    `SELECT id
       FROM uetds_notifications
      WHERE vehicle_id = $1
        AND ministry_reference IS NOT NULL
        AND status = ANY($2::text[])
        AND COALESCE(snapshot->'trip'->>'startDate', '') <> ''
        AND ((snapshot->'trip'->>'startDate') || ' ' || (snapshot->'trip'->>'startTime'))::timestamp
            <= (NOW() AT TIME ZONE 'Europe/Istanbul')
        AND ((snapshot->'trip'->>'endDate') || ' ' || (snapshot->'trip'->>'endTime'))::timestamp
            > (NOW() AT TIME ZONE 'Europe/Istanbul')
      LIMIT 1`,
    [vehicleId, ["submitted", "updated", "partial", "partial_update", "update_error", "updating"]],
  );
  return Boolean(result.rows[0]);
}

export async function listVehicleAtsSourceAudits(vehicleId: string): Promise<AtsSourceAudit[]> {
  const result = await query<{
    old_value: string | null;
    new_value: string | null;
    changed_at: Date;
    actor_name: string | null;
  }>(
    `SELECT audit.old_value, audit.new_value, audit.changed_at,
            NULLIF(trim(actor.first_name || ' ' || actor.last_name), '') AS actor_name
       FROM ops_record_audits audit
       LEFT JOIN ops_users actor ON actor.id = audit.changed_by
      WHERE audit.record_kind = 'vehicle'
        AND audit.record_id = $1
        AND audit.field_name = 'ats_ministry_source'
      ORDER BY audit.changed_at DESC
      LIMIT 12`,
    [vehicleId],
  );
  return result.rows.flatMap((row) => {
    const oldSource = parseAtsMinistrySource(row.old_value ?? "");
    const newSource = parseAtsMinistrySource(row.new_value ?? "");
    if (!oldSource || !newSource) return [];
    return [{
      oldSource,
      newSource,
      changedAt: row.changed_at.toISOString(),
      actorName: row.actor_name ?? "",
    }];
  });
}

export async function saveVehicleAtsMinistrySource(input: {
  vehicleId: string;
  source: AtsMinistrySource;
  opsUserId: string;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [atsSlotLockKey(input.vehicleId)]);
    const current = await client.query<{ ats_ministry_source: string }>(
      `SELECT ats_ministry_source FROM partner_vehicles WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [input.vehicleId],
    );
    const previous = parseAtsMinistrySource(current.rows[0]?.ats_ministry_source ?? "");
    if (!current.rows[0] || !previous) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "not-found" as const };
    }
    if (previous === input.source) {
      await client.query("COMMIT");
      return { ok: true as const, changed: false };
    }
    await client.query(
      `UPDATE partner_vehicles SET ats_ministry_source = $2 WHERE id = $1 AND deleted_at IS NULL`,
      [input.vehicleId, input.source],
    );
    await client.query(
      `INSERT INTO ops_record_audits (
         record_kind, record_id, field_name, old_value, new_value, changed_by
       ) VALUES ('vehicle', $1, 'ats_ministry_source', $2, $3, $4)`,
      [input.vehicleId, previous, input.source, input.opsUserId],
    );
    await client.query("COMMIT");
    return { ok: true as const, changed: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
