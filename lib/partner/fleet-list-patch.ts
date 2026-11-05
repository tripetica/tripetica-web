import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { resolveAssignableUetdsCompanyId } from "@/lib/ops/uetds-company-options";
import {
  saveDriverAuthority,
  saveDriverVehiclePair,
  saveDriverVehicleSet,
  saveVehicleDriverPair,
  saveVehicleDriverSet,
} from "@/lib/partner/fleet-pairing";

type PatchError = { ok: false; error: "invalid" | "not-found" };

async function companyRef(companyId: string | null): Promise<UetdsCompanyRef | null> {
  if (!companyId) {
    return null;
  }
  const result = await query<{ id: string; short_name: string }>(
    `SELECT id, short_name FROM uetds_companies WHERE id = $1`,
    [companyId],
  );
  const row = result.rows[0];
  return row ? { id: row.id, shortName: row.short_name } : null;
}

export async function setDriverListCompany(input: {
  partnerId: string;
  driverId: string;
  companyId: string | null;
}): Promise<
  | {
      ok: true;
      companyId: string | null;
      company: UetdsCompanyRef | null;
      authorityId: string | null;
    }
  | PatchError
> {
  if (!isUuid(input.partnerId) || !isUuid(input.driverId)) {
    return { ok: false, error: "invalid" };
  }
  if (input.companyId !== null && !isUuid(input.companyId)) {
    return { ok: false, error: "invalid" };
  }
  const owned = await query<{
    uetds_company_id: string | null;
    default_edevlet_authority_id: string | null;
  }>(
    `SELECT COALESCE(access.uetds_company_id, d.uetds_company_id) AS uetds_company_id,
            d.default_edevlet_authority_id
       FROM partner_drivers d
       LEFT JOIN LATERAL (
         SELECT fd.vehicle_id
           FROM partner_fleet_defaults fd
          WHERE fd.driver_id = d.id
          ORDER BY fd.created_at, fd.vehicle_id
          LIMIT 1
       ) fd ON TRUE
       LEFT JOIN partner_vehicle_access access
         ON access.vehicle_id = fd.vehicle_id AND access.partner_id = $2
      WHERE d.id = $1
        AND partner_can_access_driver($2, d.id)
        AND d.deleted_at IS NULL`,
    [input.driverId, input.partnerId],
  );
  const driver = owned.rows[0];
  if (!driver) {
    return { ok: false, error: "not-found" };
  }
  const resolved = await resolveAssignableUetdsCompanyId({
    requestedId: input.companyId,
    currentId: driver.uetds_company_id,
  });
  if (!resolved.ok) {
    return { ok: false, error: "invalid" };
  }
  await query(
    `WITH paired AS (
       SELECT fd.vehicle_id
         FROM partner_fleet_defaults fd
        WHERE fd.driver_id = $1
     ), single AS (
       SELECT vehicle_id FROM paired
        WHERE (SELECT count(*) FROM paired) = 1
     ), updated_access AS (
       UPDATE partner_vehicle_access access
          SET uetds_company_id = $3, updated_at = NOW()
         FROM single
        WHERE access.vehicle_id = single.vehicle_id
          AND access.partner_id = $2
       RETURNING access.vehicle_id
     )
     UPDATE partner_drivers d
        SET uetds_company_id = $3, updated_at = NOW()
      WHERE d.id = $1
        AND d.partner_id = $2
        AND NOT EXISTS (SELECT 1 FROM paired)`,
    [input.driverId, input.partnerId, resolved.companyId],
  );
  let authorityId = driver.default_edevlet_authority_id;
  if (authorityId) {
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
      [authorityId, input.partnerId, resolved.companyId],
    );
    if (!allowed.rows[0]) {
      await query(
        `UPDATE partner_drivers
         SET default_edevlet_authority_id = NULL
         WHERE id = $1 AND partner_can_access_driver($2, id)`,
        [input.driverId, input.partnerId],
      );
      authorityId = null;
    }
  }
  return {
    ok: true,
    companyId: resolved.companyId,
    company: await companyRef(resolved.companyId),
    authorityId,
  };
}

export async function setVehicleListCompany(input: {
  partnerId: string;
  vehicleId: string;
  companyId: string | null;
}): Promise<
  | { ok: true; companyId: string | null; company: UetdsCompanyRef | null }
  | PatchError
> {
  if (!isUuid(input.partnerId) || !isUuid(input.vehicleId)) {
    return { ok: false, error: "invalid" };
  }
  if (input.companyId !== null && !isUuid(input.companyId)) {
    return { ok: false, error: "invalid" };
  }
  const owned = await query<{ uetds_company_id: string | null }>(
    `SELECT access.uetds_company_id
       FROM partner_vehicles vehicle
       JOIN partner_vehicle_access access
         ON access.vehicle_id = vehicle.id AND access.partner_id = $2
      WHERE vehicle.id = $1 AND vehicle.deleted_at IS NULL`,
    [input.vehicleId, input.partnerId],
  );
  const vehicle = owned.rows[0];
  if (!vehicle) {
    return { ok: false, error: "not-found" };
  }
  const resolved = await resolveAssignableUetdsCompanyId({
    requestedId: input.companyId,
    currentId: vehicle.uetds_company_id,
  });
  if (!resolved.ok) {
    return { ok: false, error: "invalid" };
  }
  await query(
    `UPDATE partner_vehicle_access
        SET uetds_company_id = $3, updated_at = NOW()
      WHERE vehicle_id = $1 AND partner_id = $2`,
    [input.vehicleId, input.partnerId, resolved.companyId],
  );
  return {
    ok: true,
    companyId: resolved.companyId,
    company: await companyRef(resolved.companyId),
  };
}

export async function setDriverListVehicle(input: {
  partnerId: string;
  driverId: string;
  vehicleId?: string | null;
  vehicleIds?: readonly string[];
}): Promise<
  | {
      ok: true;
      vehicleId: string | null;
      vehicleIds: string[];
    }
  | PatchError
> {
  if (!isUuid(input.partnerId) || !isUuid(input.driverId)) {
    return { ok: false, error: "invalid" };
  }
  const vehicleIds = input.vehicleIds
    ? [...input.vehicleIds]
    : input.vehicleId
      ? [input.vehicleId]
      : [];
  if (vehicleIds.some((id) => !isUuid(id))) {
    return { ok: false, error: "invalid" };
  }
  const saved = input.vehicleIds
    ? await saveDriverVehicleSet({
        partnerId: input.partnerId,
        driverId: input.driverId,
        vehicleIds,
      })
    : await saveDriverVehiclePair({
        partnerId: input.partnerId,
        driverId: input.driverId,
        vehicleId: input.vehicleId ?? null,
      });
  if (!saved.ok) {
    return { ok: false, error: "invalid" };
  }
  return {
    ok: true,
    vehicleId: vehicleIds[0] ?? null,
    vehicleIds,
  };
}

export async function setVehicleListDriver(input: {
  partnerId: string;
  vehicleId: string;
  driverId?: string | null;
  driverIds?: readonly string[];
}): Promise<
  | {
      ok: true;
      driverId: string | null;
      driverIds: string[];
    }
  | PatchError
> {
  if (!isUuid(input.partnerId) || !isUuid(input.vehicleId)) {
    return { ok: false, error: "invalid" };
  }
  const driverIds = input.driverIds
    ? [...input.driverIds]
    : input.driverId
      ? [input.driverId]
      : [];
  if (driverIds.some((id) => !isUuid(id))) {
    return { ok: false, error: "invalid" };
  }
  const saved = input.driverIds
    ? await saveVehicleDriverSet({
        partnerId: input.partnerId,
        vehicleId: input.vehicleId,
        driverIds,
      })
    : await saveVehicleDriverPair({
        partnerId: input.partnerId,
        vehicleId: input.vehicleId,
        driverId: input.driverId ?? null,
      });
  if (!saved.ok) {
    return { ok: false, error: "invalid" };
  }
  return {
    ok: true,
    driverId: driverIds[0] ?? null,
    driverIds,
  };
}

export async function setDriverListAuthority(input: {
  partnerId: string;
  driverId: string;
  authorityId: string | null;
}): Promise<{ ok: true; authorityId: string | null } | PatchError> {
  if (!isUuid(input.partnerId) || !isUuid(input.driverId)) {
    return { ok: false, error: "invalid" };
  }
  if (input.authorityId !== null && !isUuid(input.authorityId)) {
    return { ok: false, error: "invalid" };
  }
  const owned = await query<{ uetds_company_id: string | null }>(
    `SELECT COALESCE(access.uetds_company_id, d.uetds_company_id) AS uetds_company_id
       FROM partner_drivers d
       LEFT JOIN LATERAL (
         SELECT fd.vehicle_id
           FROM partner_fleet_defaults fd
          WHERE fd.driver_id = d.id
          ORDER BY fd.created_at, fd.vehicle_id
          LIMIT 1
       ) fd ON TRUE
       LEFT JOIN partner_vehicle_access access
         ON access.vehicle_id = fd.vehicle_id AND access.partner_id = $2
      WHERE d.id = $1
        AND partner_can_access_driver($2, d.id)
        AND d.deleted_at IS NULL`,
    [input.driverId, input.partnerId],
  );
  const driver = owned.rows[0];
  if (!driver) {
    return { ok: false, error: "not-found" };
  }
  const saved = await saveDriverAuthority({
    partnerId: input.partnerId,
    driverId: input.driverId,
    authorityId: input.authorityId,
    companyId: driver.uetds_company_id,
  });
  if (!saved.ok) {
    return { ok: false, error: "invalid" };
  }
  return { ok: true, authorityId: input.authorityId };
}
