import "server-only";

import { query } from "@/lib/db/postgres";
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
    `SELECT id, plate
     FROM partner_vehicles
     WHERE partner_id = $1 AND deleted_at IS NULL
     ORDER BY plate ASC, id ASC`,
    [partnerId],
  );
  return result.rows.map((row) => ({ id: row.id, label: row.plate }));
}

export async function listPartnerDriverChoices(partnerId: string): Promise<FleetChoice[]> {
  if (!isUuid(partnerId)) {
    return [];
  }
  const result = await query<{ id: string; first_name: string; last_name: string }>(
    `SELECT id, first_name, last_name
     FROM partner_drivers
     WHERE partner_id = $1 AND deleted_at IS NULL
     ORDER BY first_name ASC, last_name ASC, id ASC`,
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
      `SELECT id, partner_id, plate
       FROM partner_vehicles
       WHERE partner_id = ANY($1::uuid[]) AND deleted_at IS NULL
       ORDER BY plate ASC, id ASC`,
      [ids],
    ),
    query<{ id: string; partner_id: string; first_name: string; last_name: string }>(
      `SELECT id, partner_id, first_name, last_name
       FROM partner_drivers
       WHERE partner_id = ANY($1::uuid[]) AND deleted_at IS NULL
       ORDER BY first_name ASC, last_name ASC, id ASC`,
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
    return { defaultVehicleId: "", defaultAuthorityId: "" };
  }
  const result = await query<{ vehicle_id: string | null; authority_id: string | null }>(
    `SELECT v.id AS vehicle_id,
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
       ON fd.driver_id = d.id AND fd.partner_id = d.partner_id
     LEFT JOIN partner_vehicles v
       ON v.id = fd.vehicle_id AND v.partner_id = d.partner_id AND v.deleted_at IS NULL
     LEFT JOIN partner_uetds_authorities a
       ON a.id = d.default_edevlet_authority_id
      AND a.partner_id = d.partner_id
      AND a.deleted_at IS NULL
      AND a.status = 'active'
     WHERE d.id = $1 AND d.partner_id = $2 AND d.deleted_at IS NULL
     LIMIT 1`,
    [driverId, partnerId],
  );
  const row = result.rows[0];
  return {
    defaultVehicleId: row?.vehicle_id ?? "",
    defaultAuthorityId: row?.authority_id ?? "",
  };
}

export async function getVehicleFleetLink(partnerId: string, vehicleId: string) {
  if (!isUuid(partnerId) || !isUuid(vehicleId)) {
    return { defaultDriverId: "" };
  }
  const result = await query<{ driver_id: string | null }>(
    `SELECT d.id AS driver_id
     FROM partner_vehicles v
     LEFT JOIN partner_fleet_defaults fd
       ON fd.vehicle_id = v.id AND fd.partner_id = v.partner_id
     LEFT JOIN partner_drivers d
       ON d.id = fd.driver_id AND d.partner_id = v.partner_id AND d.deleted_at IS NULL
     WHERE v.id = $1 AND v.partner_id = $2 AND v.deleted_at IS NULL
     LIMIT 1`,
    [vehicleId, partnerId],
  );
  return { defaultDriverId: result.rows[0]?.driver_id ?? "" };
}

export async function saveDriverVehiclePair(input: {
  partnerId: string;
  driverId: string;
  vehicleId: string | null;
}) {
  if (!isUuid(input.partnerId) || !isUuid(input.driverId)) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  if (input.vehicleId === null) {
    const owned = await query<{ id: string }>(
      `SELECT id FROM partner_drivers
       WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
      [input.driverId, input.partnerId],
    );
    if (!owned.rows[0]) {
      return { ok: false as const, error: "invalid-fleet-pair" as const };
    }
    await query(
      `DELETE FROM partner_fleet_defaults
       WHERE partner_id = $1 AND driver_id = $2`,
      [input.partnerId, input.driverId],
    );
    return { ok: true as const };
  }
  if (!isUuid(input.vehicleId)) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  const owned = await query<{ driver_id: string }>(
    `SELECT d.id AS driver_id
     FROM partner_drivers d
     JOIN partner_vehicles v
       ON v.id = $3 AND v.partner_id = d.partner_id AND v.deleted_at IS NULL
     WHERE d.id = $2 AND d.partner_id = $1 AND d.deleted_at IS NULL`,
    [input.partnerId, input.driverId, input.vehicleId],
  );
  if (!owned.rows[0]) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  await query(
    `DELETE FROM partner_fleet_defaults
     WHERE partner_id = $1 AND (driver_id = $2 OR vehicle_id = $3)`,
    [input.partnerId, input.driverId, input.vehicleId],
  );
  await query(
    `INSERT INTO partner_fleet_defaults (partner_id, driver_id, vehicle_id)
     VALUES ($1, $2, $3)`,
    [input.partnerId, input.driverId, input.vehicleId],
  );
  return { ok: true as const };
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
  if (!isUuid(input.partnerId) || !isUuid(input.vehicleId)) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  const owned = await query<{ id: string }>(
    `SELECT id FROM partner_vehicles
     WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
    [input.vehicleId, input.partnerId],
  );
  if (!owned.rows[0]) {
    return { ok: false as const, error: "invalid-fleet-pair" as const };
  }
  await query(
    `DELETE FROM partner_fleet_defaults
     WHERE partner_id = $1 AND vehicle_id = $2`,
    [input.partnerId, input.vehicleId],
  );
  return { ok: true as const };
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
     WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
    [input.driverId, input.partnerId],
  );
  if (!driver.rows[0]) {
    return { ok: false as const, error: "invalid-edevlet-authority" as const };
  }
  if (input.authorityId === null) {
    await query(
      `UPDATE partner_drivers
       SET default_edevlet_authority_id = NULL
       WHERE id = $1 AND partner_id = $2`,
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
     WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
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
      `DELETE FROM partner_fleet_defaults WHERE partner_id = $1 AND driver_id = $2`,
      [input.partnerId, input.driverId],
    );
  }
  if (input.vehicleId && isUuid(input.partnerId) && isUuid(input.vehicleId)) {
    await query(
      `DELETE FROM partner_fleet_defaults WHERE partner_id = $1 AND vehicle_id = $2`,
      [input.partnerId, input.vehicleId],
    );
  }
}
