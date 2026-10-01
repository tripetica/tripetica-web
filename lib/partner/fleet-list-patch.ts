import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { resolveAssignableUetdsCompanyId } from "@/lib/ops/uetds-company-options";
import {
  saveDriverAuthority,
  saveDriverVehiclePair,
  saveVehicleDriverPair,
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
    `SELECT uetds_company_id, default_edevlet_authority_id
     FROM partner_drivers
     WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
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
    `UPDATE partner_drivers
     SET uetds_company_id = $3, updated_at = NOW()
     WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
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
         WHERE id = $1 AND partner_id = $2`,
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
    `SELECT uetds_company_id
     FROM partner_vehicles
     WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
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
    `UPDATE partner_vehicles
     SET uetds_company_id = $3, updated_at = NOW()
     WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
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
  vehicleId: string | null;
}): Promise<
  | {
      ok: true;
      vehicleId: string | null;
      releasedDriverId: string | null;
      releasedVehicleId: string | null;
    }
  | PatchError
> {
  if (!isUuid(input.partnerId) || !isUuid(input.driverId)) {
    return { ok: false, error: "invalid" };
  }
  if (input.vehicleId !== null && !isUuid(input.vehicleId)) {
    return { ok: false, error: "invalid" };
  }
  const before = await query<{ driver_id: string; vehicle_id: string }>(
    `SELECT driver_id, vehicle_id
     FROM partner_fleet_defaults
     WHERE partner_id = $1
       AND (driver_id = $2 OR ($3::uuid IS NOT NULL AND vehicle_id = $3))`,
    [input.partnerId, input.driverId, input.vehicleId],
  );
  const saved = await saveDriverVehiclePair({
    partnerId: input.partnerId,
    driverId: input.driverId,
    vehicleId: input.vehicleId,
  });
  if (!saved.ok) {
    return { ok: false, error: "invalid" };
  }
  return {
    ok: true,
    vehicleId: input.vehicleId,
    releasedDriverId:
      before.rows.find((row) => input.vehicleId && row.vehicle_id === input.vehicleId && row.driver_id !== input.driverId)
        ?.driver_id ?? null,
    releasedVehicleId:
      before.rows.find((row) => row.driver_id === input.driverId && row.vehicle_id !== input.vehicleId)
        ?.vehicle_id ?? null,
  };
}

export async function setVehicleListDriver(input: {
  partnerId: string;
  vehicleId: string;
  driverId: string | null;
}): Promise<
  | {
      ok: true;
      driverId: string | null;
      releasedDriverId: string | null;
      releasedVehicleId: string | null;
    }
  | PatchError
> {
  if (!isUuid(input.partnerId) || !isUuid(input.vehicleId)) {
    return { ok: false, error: "invalid" };
  }
  if (input.driverId !== null && !isUuid(input.driverId)) {
    return { ok: false, error: "invalid" };
  }
  const before = await query<{ driver_id: string; vehicle_id: string }>(
    `SELECT driver_id, vehicle_id
     FROM partner_fleet_defaults
     WHERE partner_id = $1
       AND (vehicle_id = $2 OR ($3::uuid IS NOT NULL AND driver_id = $3))`,
    [input.partnerId, input.vehicleId, input.driverId],
  );
  const saved = await saveVehicleDriverPair({
    partnerId: input.partnerId,
    vehicleId: input.vehicleId,
    driverId: input.driverId,
  });
  if (!saved.ok) {
    return { ok: false, error: "invalid" };
  }
  return {
    ok: true,
    driverId: input.driverId,
    releasedVehicleId:
      before.rows.find((row) => input.driverId && row.driver_id === input.driverId && row.vehicle_id !== input.vehicleId)
        ?.vehicle_id ?? null,
    releasedDriverId:
      before.rows.find((row) => row.vehicle_id === input.vehicleId && row.driver_id !== input.driverId)
        ?.driver_id ?? null,
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
    `SELECT uetds_company_id
     FROM partner_drivers
     WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
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
