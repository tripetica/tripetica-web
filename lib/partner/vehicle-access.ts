import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";

export type VehiclePartnerOption = {
  id: string;
  name: string;
  code: string;
};

export type VehiclePartnerAccess = VehiclePartnerOption & {
  uetdsCompanyId: string | null;
};

export async function listVehiclePartnerOptions(): Promise<VehiclePartnerOption[]> {
  const result = await query<{ id: string; name: string; partner_code: string }>(
    `SELECT id, name, partner_code
       FROM partners
      WHERE deleted_at IS NULL
      ORDER BY name ASC, partner_code ASC, id ASC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.partner_code,
  }));
}

export async function listVehiclePartnerAccess(vehicleId: string): Promise<VehiclePartnerAccess[]> {
  if (!isUuid(vehicleId)) return [];
  const result = await query<{
    partner_id: string;
    name: string;
    partner_code: string;
    uetds_company_id: string | null;
  }>(
    `SELECT access.partner_id, partner.name, partner.partner_code, access.uetds_company_id
       FROM partner_vehicle_access access
       JOIN partners partner ON partner.id = access.partner_id
      WHERE access.vehicle_id = $1
        AND partner.deleted_at IS NULL
      ORDER BY partner.name ASC, partner.partner_code ASC, partner.id ASC`,
    [vehicleId],
  );
  return result.rows.map((row) => ({
    id: row.partner_id,
    name: row.name,
    code: row.partner_code,
    uetdsCompanyId: row.uetds_company_id,
  }));
}

export async function saveVehiclePartnerAccess(input: {
  vehicleId: string;
  actorOpsUserId: string;
  grants: readonly { partnerId: string; uetdsCompanyId: string | null }[];
}) {
  const deduped = new Map<string, string | null>();
  for (const grant of input.grants) {
    if (!isUuid(grant.partnerId)) {
      return { ok: false as const, error: "invalid" as const };
    }
    if (grant.uetdsCompanyId !== null && !isUuid(grant.uetdsCompanyId)) {
      return { ok: false as const, error: "invalid" as const };
    }
    deduped.set(grant.partnerId, grant.uetdsCompanyId);
  }
  if (!isUuid(input.vehicleId) || !isUuid(input.actorOpsUserId) || deduped.size === 0) {
    return { ok: false as const, error: "requires-partner" as const };
  }

  const partnerIds = [...deduped.keys()];
  const companyIds = [...new Set([...deduped.values()].filter((id): id is string => id !== null))];
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const vehicle = await client.query<{ id: string }>(
      `SELECT id
         FROM partner_vehicles
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE`,
      [input.vehicleId],
    );
    if (!vehicle.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "not-found" as const };
    }
    const partners = await client.query<{ id: string }>(
      `SELECT id
         FROM partners
        WHERE id = ANY($1::uuid[])
          AND deleted_at IS NULL`,
      [partnerIds],
    );
    if (partners.rows.length !== partnerIds.length) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "invalid" as const };
    }
    if (companyIds.length > 0) {
      const companies = await client.query<{ id: string }>(
        `SELECT id
           FROM uetds_companies
          WHERE id = ANY($1::uuid[])
            AND status = 'active'`,
        [companyIds],
      );
      if (companies.rows.length !== companyIds.length) {
        await client.query("ROLLBACK");
        return { ok: false as const, error: "invalid" as const };
      }
    }

    const current = await client.query<{ partner_id: string; uetds_company_id: string | null }>(
      `SELECT partner_id, uetds_company_id
         FROM partner_vehicle_access
        WHERE vehicle_id = $1
        FOR UPDATE`,
      [input.vehicleId],
    );
    const before = new Map(current.rows.map((row) => [row.partner_id, row.uetds_company_id]));

    for (const [partnerId, companyId] of deduped) {
      const oldCompanyId = before.get(partnerId);
      await client.query(
        `INSERT INTO partner_vehicle_access (
           vehicle_id, partner_id, uetds_company_id, granted_by_ops_user_id
         ) VALUES ($1, $2, $3, $4)
         ON CONFLICT (vehicle_id, partner_id) DO UPDATE
         SET uetds_company_id = EXCLUDED.uetds_company_id,
             updated_at = NOW()`,
        [input.vehicleId, partnerId, companyId, input.actorOpsUserId],
      );
      if (oldCompanyId === undefined) {
        await client.query(
          `INSERT INTO partner_vehicle_access_audit (
             vehicle_id, partner_id, action, new_uetds_company_id, actor_ops_user_id
           ) VALUES ($1, $2, 'grant', $3, $4)`,
          [input.vehicleId, partnerId, companyId, input.actorOpsUserId],
        );
      } else if (oldCompanyId !== companyId) {
        await client.query(
          `INSERT INTO partner_vehicle_access_audit (
             vehicle_id, partner_id, action, old_uetds_company_id,
             new_uetds_company_id, actor_ops_user_id
           ) VALUES ($1, $2, 'company_change', $3, $4, $5)`,
          [input.vehicleId, partnerId, oldCompanyId, companyId, input.actorOpsUserId],
        );
      }
    }

    for (const [partnerId, oldCompanyId] of before) {
      if (deduped.has(partnerId)) continue;
      await client.query(
        `WITH stopped AS (
           UPDATE gps_mobile_sessions
              SET status = 'stopped', stopped_at = NOW(), stop_reason = 'access_revoked'
            WHERE vehicle_id = $1
              AND partner_id = $2
              AND status = 'active'
           RETURNING id, partner_id, driver_id, vehicle_id
         )
         INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, session_id, kind)
         SELECT partner_id, driver_id, vehicle_id, id, 'access_revoked' FROM stopped`,
        [input.vehicleId, partnerId],
      );
      await client.query(
        `INSERT INTO partner_vehicle_access_audit (
           vehicle_id, partner_id, action, old_uetds_company_id, actor_ops_user_id
         ) VALUES ($1, $2, 'revoke', $3, $4)`,
        [input.vehicleId, partnerId, oldCompanyId, input.actorOpsUserId],
      );
      await client.query(
        `DELETE FROM partner_vehicle_access
          WHERE vehicle_id = $1 AND partner_id = $2`,
        [input.vehicleId, partnerId],
      );
    }
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    if (postgresCode(error) === "23514") {
      return { ok: false as const, error: "requires-partner" as const };
    }
    throw error;
  } finally {
    client.release();
  }
}

function postgresCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}
