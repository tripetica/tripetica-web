import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { partnerDriverFullName } from "@/lib/partner/fleet-view";
import {
  type AuthorityChoice,
  type FleetChoice,
  type FleetChoicesByPartner,
} from "@/lib/partner/fleet-pairing-rules";

export type { AuthorityChoice, FleetChoice, FleetChoicesByPartner } from "@/lib/partner/fleet-pairing-rules";

export async function listPartnerVehicleChoices(partnerId: string): Promise<FleetChoice[]> {
  if (!isUuid(partnerId)) {
    return [];
  }
  const result = await query<{ id: string; plate: string }>(
    `SELECT v.id, v.plate
       FROM partner_vehicles v
      WHERE partner_can_access_vehicle($1, v.id)
        AND v.deleted_at IS NULL
      ORDER BY v.plate ASC, v.id ASC`,
    [partnerId],
  );
  return result.rows.map((row) => ({ id: row.id, label: row.plate }));
}

export async function listPartnerDriverChoices(partnerId: string): Promise<FleetChoice[]> {
  if (!isUuid(partnerId)) {
    return [];
  }
  const result = await query<{ id: string; first_name: string; last_name: string }>(
    `SELECT d.id, d.first_name, d.last_name
       FROM partner_drivers d
      WHERE partner_can_access_driver($1, d.id)
        AND d.deleted_at IS NULL
      ORDER BY d.first_name ASC, d.last_name ASC, d.id ASC`,
    [partnerId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    label: partnerDriverFullName(row.first_name, row.last_name),
  }));
}

export async function listAssignableEdevletAuthorities(input: {
  partnerId?: string | null;
}): Promise<AuthorityChoice[]> {
  if (input.partnerId != null && !isUuid(input.partnerId)) {
    return [];
  }
  const result = await query<{
    id: string;
    partner_id: string;
    first_name: string;
    last_name: string;
    company_ids: string[] | null;
  }>(
    `SELECT a.id, a.partner_id, a.first_name, a.last_name,
            COALESCE(array_agg(ac.company_id) FILTER (WHERE ac.company_id IS NOT NULL), '{}') AS company_ids
     FROM partner_uetds_authorities a
     LEFT JOIN partner_uetds_authority_companies ac ON ac.authority_id = a.id
     WHERE a.deleted_at IS NULL
       AND a.status = 'active'
       AND ($1::uuid IS NULL OR a.partner_id = $1)
     GROUP BY a.id
     ORDER BY a.first_name ASC, a.last_name ASC, a.id ASC`,
    [input.partnerId ?? null],
  );
  return result.rows.map((row) => ({
    id: row.id,
    partnerId: row.partner_id,
    label: partnerDriverFullName(row.first_name, row.last_name),
    companyIds: Array.isArray(row.company_ids) ? row.company_ids.map(String) : [],
  }));
}

export async function listFleetChoicesForPartners(
  partnerIds: readonly string[],
): Promise<FleetChoicesByPartner> {
  const ids = [...new Set(partnerIds.filter((id) => isUuid(id)))];
  const choices: FleetChoicesByPartner = {};
  for (const id of ids) {
    choices[id] = { vehicles: [], drivers: [], authorities: [] };
  }
  if (ids.length === 0) {
    return choices;
  }
  const [vehicles, drivers, authorities] = await Promise.all([
    query<{ id: string; partner_id: string; plate: string }>(
      `SELECT v.id, access.partner_id, v.plate
         FROM partner_vehicle_access access
         JOIN partner_vehicles v ON v.id = access.vehicle_id
        WHERE access.partner_id = ANY($1::uuid[])
          AND v.deleted_at IS NULL
        ORDER BY v.plate ASC, v.id ASC`,
      [ids],
    ),
    query<{ id: string; partner_id: string; first_name: string; last_name: string }>(
      `SELECT d.id, requested.partner_id, d.first_name, d.last_name
         FROM unnest($1::uuid[]) AS requested(partner_id)
         JOIN partner_drivers d
           ON partner_can_access_driver(requested.partner_id, d.id)
        WHERE d.deleted_at IS NULL
        ORDER BY d.first_name ASC, d.last_name ASC, d.id ASC`,
      [ids],
    ),
    query<{
      id: string;
      partner_id: string;
      first_name: string;
      last_name: string;
      company_ids: string[] | null;
    }>(
      `SELECT a.id, a.partner_id, a.first_name, a.last_name,
              COALESCE(array_agg(ac.company_id) FILTER (WHERE ac.company_id IS NOT NULL), '{}') AS company_ids
       FROM partner_uetds_authorities a
       LEFT JOIN partner_uetds_authority_companies ac ON ac.authority_id = a.id
       WHERE a.deleted_at IS NULL
         AND a.status = 'active'
         AND a.partner_id = ANY($1::uuid[])
       GROUP BY a.id
       ORDER BY a.first_name ASC, a.last_name ASC, a.id ASC`,
      [ids],
    ),
  ]);
  for (const row of vehicles.rows) {
    choices[row.partner_id]?.vehicles.push({ id: row.id, label: row.plate });
  }
  for (const row of drivers.rows) {
    choices[row.partner_id]?.drivers.push({
      id: row.id,
      label: partnerDriverFullName(row.first_name, row.last_name),
    });
  }
  for (const row of authorities.rows) {
    choices[row.partner_id]?.authorities.push({
      id: row.id,
      partnerId: row.partner_id,
      label: partnerDriverFullName(row.first_name, row.last_name),
      companyIds: Array.isArray(row.company_ids) ? row.company_ids.map(String) : [],
    });
  }
  return choices;
}

export async function getDriverFleetLink(partnerId: string, driverId: string) {
  if (!isUuid(partnerId) || !isUuid(driverId)) {
    return { defaultVehicleId: "", vehicleIds: [] as string[], defaultAuthorityId: "" };
  }
  const result = await query<{ vehicle_ids: string[] | null; authority_id: string | null }>(
    `SELECT COALESCE(array_agg(v.id ORDER BY fd.created_at, v.plate), '{}') AS vehicle_ids,
            CASE
              WHEN a.id IS NULL THEN NULL
              WHEN d.uetds_company_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM partner_uetds_authority_companies ac
                WHERE ac.authority_id = a.id AND ac.company_id = d.uetds_company_id
              ) THEN NULL
              ELSE a.id
            END AS authority_id
     FROM partner_drivers d
     LEFT JOIN partner_fleet_defaults fd
       ON fd.driver_id = d.id
     LEFT JOIN partner_vehicles v
       ON v.id = fd.vehicle_id
      AND v.deleted_at IS NULL
      AND partner_can_access_vehicle($2, v.id)
     LEFT JOIN partner_uetds_authorities a
       ON a.id = d.default_edevlet_authority_id
      AND a.partner_id = d.partner_id
      AND a.deleted_at IS NULL
      AND a.status = 'active'
     WHERE d.id = $1
       AND partner_can_access_driver($2, d.id)
       AND d.deleted_at IS NULL
     GROUP BY d.id, a.id, d.uetds_company_id`,
    [driverId, partnerId],
  );
  const row = result.rows[0];
  const vehicleIds = row?.vehicle_ids ?? [];
  return {
    defaultVehicleId: vehicleIds.length === 1 ? vehicleIds[0] ?? "" : "",
    vehicleIds,
    defaultAuthorityId: row?.authority_id ?? "",
  };
}

export async function getVehicleFleetLink(partnerId: string, vehicleId: string) {
  if (!isUuid(partnerId) || !isUuid(vehicleId)) {
    return { defaultDriverId: "", driverIds: [] as string[] };
  }
  const result = await query<{ driver_ids: string[] | null }>(
    `SELECT COALESCE(array_agg(d.id ORDER BY fd.created_at, d.last_name, d.id), '{}') AS driver_ids
     FROM partner_vehicles v
     LEFT JOIN partner_fleet_defaults fd
       ON fd.vehicle_id = v.id
     LEFT JOIN partner_drivers d
       ON d.id = fd.driver_id AND d.deleted_at IS NULL
     WHERE v.id = $1
       AND partner_can_access_vehicle($2, v.id)
       AND v.deleted_at IS NULL
     GROUP BY v.id`,
    [vehicleId, partnerId],
  );
  const driverIds = result.rows[0]?.driver_ids ?? [];
  return {
    defaultDriverId: driverIds.length === 1 ? driverIds[0] ?? "" : "",
    driverIds,
  };
}

export async function saveDriverVehiclePair(input: {
  partnerId: string;
  driverId: string;
  vehicleId: string | null;
}) {
  if (!isUuid(input.partnerId) || !isUuid(input.driverId)) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  if (input.vehicleId !== null && !isUuid(input.vehicleId)) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const allowed = input.vehicleId === null
      ? await client.query<{ driver_id: string }>(
          `SELECT id AS driver_id
             FROM partner_drivers
            WHERE id = $1
              AND partner_can_access_driver($2, id)
              AND deleted_at IS NULL
            FOR UPDATE`,
          [input.driverId, input.partnerId],
        )
      : await client.query<{ driver_id: string }>(
          `SELECT d.id AS driver_id
             FROM partner_drivers d
             JOIN partner_vehicles v
               ON v.id = $3 AND v.deleted_at IS NULL
            WHERE d.id = $2
              AND partner_can_access_driver($1, d.id)
              AND partner_can_access_vehicle($1, v.id)
              AND d.deleted_at IS NULL
            FOR UPDATE OF d, v`,
          [input.partnerId, input.driverId, input.vehicleId],
        );
    if (!allowed.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "invalid-fleet-pair" as const };
    }
    if (input.vehicleId === null) {
      await client.query(`DELETE FROM partner_fleet_defaults WHERE driver_id = $1`, [input.driverId]);
    } else {
      await client.query(
        `UPDATE partner_drivers
            SET vehicle_derived_visibility = TRUE, updated_at = NOW()
          WHERE id = $1`,
        [input.driverId],
      );
      await client.query(
        `DELETE FROM partner_fleet_defaults
          WHERE driver_id = $1
            AND vehicle_id <> $2`,
        [input.driverId, input.vehicleId],
      );
      await client.query(
        `INSERT INTO partner_fleet_defaults (partner_id, driver_id, vehicle_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (driver_id, vehicle_id) DO NOTHING`,
        [input.partnerId, input.driverId, input.vehicleId],
      );
    }
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function linksAreAllowed(partnerId: string, driverIds: readonly string[], vehicleIds: readonly string[]) {
  const client = await getPool().connect();
  try {
    const drivers = driverIds.length === 0
      ? { rows: [] as { id: string }[] }
      : await client.query<{ id: string }>(
          `SELECT id
             FROM partner_drivers
            WHERE id = ANY($2::uuid[])
              AND partner_can_access_driver($1, id)
              AND deleted_at IS NULL`,
          [partnerId, driverIds],
        );
    const vehicles = vehicleIds.length === 0
      ? { rows: [] as { id: string }[] }
      : await client.query<{ id: string }>(
          `SELECT id
             FROM partner_vehicles
            WHERE id = ANY($2::uuid[])
              AND partner_can_access_vehicle($1, id)
              AND deleted_at IS NULL`,
          [partnerId, vehicleIds],
        );
    return drivers.rows.length === new Set(driverIds).size && vehicles.rows.length === new Set(vehicleIds).size;
  } finally {
    client.release();
  }
}

export async function saveDriverVehicleSet(input: {
  partnerId: string;
  driverId: string;
  vehicleIds: readonly string[];
}) {
  if (!isUuid(input.partnerId) || !isUuid(input.driverId) || input.vehicleIds.some((id) => !isUuid(id))) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  const vehicleIds = [...new Set(input.vehicleIds)];
  if (vehicleIds.length > 1) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  if (!await linksAreAllowed(input.partnerId, [input.driverId], vehicleIds)) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE partner_drivers
          SET vehicle_derived_visibility = TRUE, updated_at = NOW()
        WHERE id = $1`,
      [input.driverId],
    );
    await client.query(
      `DELETE FROM partner_fleet_defaults
        WHERE driver_id = $1
          AND NOT (vehicle_id = ANY($2::uuid[]))`,
      [input.driverId, vehicleIds],
    );
    if (vehicleIds.length > 0) {
      await client.query(
        `INSERT INTO partner_fleet_defaults (partner_id, driver_id, vehicle_id)
         SELECT $1, $2, vehicle_id
           FROM unnest($3::uuid[]) AS vehicle_id
         ON CONFLICT (driver_id, vehicle_id) DO NOTHING`,
        [input.partnerId, input.driverId, vehicleIds],
      );
    }
    await client.query("COMMIT");
    return { ok: true as const, vehicleIds };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveVehicleDriverSet(input: {
  partnerId: string;
  vehicleId: string;
  driverIds: readonly string[];
}) {
  if (!isUuid(input.partnerId) || !isUuid(input.vehicleId) || input.driverIds.some((id) => !isUuid(id))) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  const driverIds = [...new Set(input.driverIds)];
  if (!await linksAreAllowed(input.partnerId, driverIds, [input.vehicleId])) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (driverIds.length > 0) {
      await client.query(
        `UPDATE partner_drivers
            SET vehicle_derived_visibility = TRUE, updated_at = NOW()
          WHERE id = ANY($1::uuid[])`,
        [driverIds],
      );
    }
    await client.query(
      `DELETE FROM partner_fleet_defaults
        WHERE vehicle_id = $1
          AND NOT (driver_id = ANY($2::uuid[]))`,
      [input.vehicleId, driverIds],
    );
    if (driverIds.length > 0) {
      await client.query(
        `DELETE FROM partner_fleet_defaults
          WHERE driver_id = ANY($1::uuid[])
            AND vehicle_id <> $2`,
        [driverIds, input.vehicleId],
      );
    }
    if (driverIds.length > 0) {
      await client.query(
        `INSERT INTO partner_fleet_defaults (partner_id, driver_id, vehicle_id)
         SELECT $1, driver_id, $2
           FROM unnest($3::uuid[]) AS driver_id
         ON CONFLICT (driver_id, vehicle_id) DO NOTHING`,
        [input.partnerId, input.vehicleId, driverIds],
      );
    }
    await client.query("COMMIT");
    return { ok: true as const, driverIds };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveVehicleDriverPair(input: {
  partnerId: string;
  vehicleId: string;
  driverId: string | null;
}) {
  if (input.driverId) {
    return saveDriverVehiclePair({
      partnerId: input.partnerId,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
    });
  }
  return saveVehicleDriverSet({
    partnerId: input.partnerId,
    vehicleId: input.vehicleId,
    driverIds: [],
  });
}

export async function saveDriverAuthority(input: {
  partnerId: string;
  driverId: string;
  authorityId: string | null;
  companyId: string | null;
}) {
  if (!isUuid(input.partnerId) || !isUuid(input.driverId)) {
    return { ok: false as const, error: "invalid-edevlet-authority" as const };
  }
  if (input.companyId !== null && !isUuid(input.companyId)) {
    return { ok: false as const, error: "invalid-edevlet-authority" as const };
  }
  const driver = await query<{ id: string }>(
    `SELECT id FROM partner_drivers
     WHERE id = $1 AND partner_can_access_driver($2, id) AND deleted_at IS NULL`,
    [input.driverId, input.partnerId],
  );
  if (!driver.rows[0]) {
    return { ok: false as const, error: "invalid-edevlet-authority" as const };
  }
  if (input.authorityId === null) {
    await query(
      `UPDATE partner_drivers
       SET default_edevlet_authority_id = NULL
       WHERE id = $1 AND partner_can_access_driver($2, id)`,
      [input.driverId, input.partnerId],
    );
    return { ok: true as const };
  }
  if (!isUuid(input.authorityId)) {
    return { ok: false as const, error: "invalid-edevlet-authority" as const };
  }
  const allowed = await query<{ id: string }>(
    `SELECT a.id
     FROM partner_uetds_authorities a
     WHERE a.id = $1
       AND a.partner_id = $2
       AND a.deleted_at IS NULL
       AND a.status = 'active'
       AND (
         $3::uuid IS NULL
         OR EXISTS (
           SELECT 1 FROM partner_uetds_authority_companies ac
           WHERE ac.authority_id = a.id AND ac.company_id = $3
         )
       )`,
    [input.authorityId, input.partnerId, input.companyId],
  );
  if (!allowed.rows[0]) {
    return { ok: false as const, error: "invalid-edevlet-authority" as const };
  }
  await query(
    `UPDATE partner_drivers
     SET default_edevlet_authority_id = $3
     WHERE id = $1
       AND partner_can_access_driver($2, id)
       AND deleted_at IS NULL`,
    [input.driverId, input.partnerId, input.authorityId],
  );
  return { ok: true as const };
}

export async function releaseFleetPair(input: {
  partnerId: string;
  driverId?: string;
  vehicleId?: string;
}) {
  if (input.driverId && isUuid(input.partnerId) && isUuid(input.driverId)) {
    await query(
      `DELETE FROM partner_fleet_defaults WHERE driver_id = $1`,
      [input.driverId],
    );
  }
  if (input.vehicleId && isUuid(input.partnerId) && isUuid(input.vehicleId)) {
    await query(
      `DELETE FROM partner_fleet_defaults WHERE vehicle_id = $1`,
      [input.vehicleId],
    );
  }
}
