import "server-only";

import { type PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";
import { atsSlotLockKey, type AtsMinistrySource } from "@/lib/gps/ats-source";

export async function withAtsSlot<T>(
  vehicleId: string,
  slot: number,
  source: Exclude<AtsMinistrySource, "none">,
  insert: (client: PoolClient) => Promise<T | null>,
): Promise<{ ok: true; value: T } | { ok: false; reason: "source_changed" | "duplicate" }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [atsSlotLockKey(vehicleId)]);
    const vehicle = await client.query<{
      ats_ministry_source: string;
      service_gps_ats_enabled: boolean;
      service_mobile_gps_enabled: boolean;
    }>(
      `SELECT ats_ministry_source, service_gps_ats_enabled, service_mobile_gps_enabled
         FROM partner_vehicles
        WHERE id = $1
        FOR UPDATE`,
      [vehicleId],
    );
    const row = vehicle.rows[0];
    const allowed = row
      && ((source === "physical" && row.ats_ministry_source === "physical" && row.service_gps_ats_enabled)
        || (source === "mobile" && row.ats_ministry_source === "mobile" && row.service_mobile_gps_enabled));
    if (!allowed) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "source_changed" };
    }
    const taken = await client.query(
      `SELECT 1 FROM gps_ats_submissions WHERE vehicle_id = $1 AND period_slot = $2
       UNION ALL
       SELECT 1 FROM gps_mobile_ats_submissions WHERE vehicle_id = $1 AND period_slot = $2
       LIMIT 1`,
      [vehicleId, slot],
    );
    if (taken.rows.length > 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "duplicate" };
    }
    const value = await insert(client);
    if (value == null) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "duplicate" };
    }
    await client.query("COMMIT");
    return { ok: true, value };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
