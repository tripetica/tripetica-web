import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import {
  type OpsAssignmentError,
  type OpsAssignmentFleet,
  type OpsAssignmentPartnerOption,
} from "@/lib/ops/reservation-assignment-view";
import {
  getPartnerDriver,
  getPartnerVehicle,
  isPartnerFleetAssignable,
  listAssignablePartnerDrivers,
  listAssignablePartnerVehicles,
} from "@/lib/partner/fleet";
import {
  assertAssignmentAccess,
  isAssignmentLocked,
  NON_TRP_SELECTION,
  parseNonTrpDriverForm,
  parseNonTrpVehicleForm,
  registeredDriverSnapshot,
  registeredVehicleSnapshot,
  type AssignmentKind,
} from "@/lib/partner/job-assignment-view";

export type {
  OpsAssignmentError,
  OpsAssignmentFleet,
  OpsAssignmentPartnerOption,
} from "@/lib/ops/reservation-assignment-view";

type ReservationLockRow = {
  id: string;
  status: string;
  accepted_partner_id: string | null;
};

type AssignableReservationRow = ReservationLockRow & {
  is_primary_partner: boolean;
};

type ActivePartnerRow = {
  id: string;
  name: string;
  partner_code: string;
  status: string;
  deleted_at: Date | null;
};

const CLEAR_FLEET_SET = `
  assigned_driver_kind = NULL,
  assigned_driver_id = NULL,
  assigned_driver_snapshot = NULL,
  assigned_vehicle_kind = NULL,
  assigned_vehicle_id = NULL,
  assigned_vehicle_snapshot = NULL,
  assignment_updated_at = NOW(),
  assignment_updated_by_partner_user_id = NULL
`;

export async function listActiveOpsAssignmentPartners(): Promise<
  OpsAssignmentPartnerOption[]
> {
  const result = await query<ActivePartnerRow>(
    `SELECT id, name, partner_code, status, deleted_at
     FROM partners
     WHERE deleted_at IS NULL
       AND status = 'active'
     ORDER BY name ASC, partner_code ASC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name.trim(),
    partnerCode: row.partner_code,
  }));
}

export async function loadOpsAssignmentFleets(
  partnerIds: readonly string[],
): Promise<Record<string, OpsAssignmentFleet>> {
  const fleets: Record<string, OpsAssignmentFleet> = {};
  await Promise.all(
    partnerIds.map(async (partnerId) => {
      const [drivers, vehicles] = await Promise.all([
        listAssignablePartnerDrivers(partnerId),
        listAssignablePartnerVehicles(partnerId),
      ]);
      fleets[partnerId] = { drivers, vehicles };
    }),
  );
  return fleets;
}

async function loadActivePartner(partnerId: string) {
  if (!isUuid(partnerId)) {
    return null;
  }
  const result = await query<ActivePartnerRow>(
    `SELECT id, name, partner_code, status, deleted_at
     FROM partners
     WHERE id = $1
     LIMIT 1`,
    [partnerId],
  );
  const row = result.rows[0];
  if (!row || row.deleted_at || row.status !== "active") {
    return null;
  }
  return row;
}

function lockedOrMissing(row: ReservationLockRow | undefined) {
  if (!row) {
    return "not-found" as const;
  }
  if (isAssignmentLocked(row.status)) {
    return "locked" as const;
  }
  return null;
}

export async function assignOpsReservationPartner(input: {
  reservationId: string;
  partnerId: string;
}): Promise<
  | { ok: true; previousPartnerId: string | null; partnerId: string }
  | { ok: false; error: OpsAssignmentError }
> {
  if (!isUuid(input.reservationId) || !isUuid(input.partnerId)) {
    return { ok: false, error: "invalid-selection" };
  }
  const partner = await loadActivePartner(input.partnerId);
  if (!partner) {
    return { ok: false, error: "inactive-partner" };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<ReservationLockRow>(
      `SELECT id, status, accepted_partner_id
       FROM reservations
       WHERE id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [input.reservationId],
    );
    const row = locked.rows[0];
    const blocked = lockedOrMissing(row);
    if (blocked) {
      await client.query("ROLLBACK");
      return { ok: false, error: blocked };
    }
    const previousPartnerId = row.accepted_partner_id;
    if (previousPartnerId === input.partnerId) {
      await client.query("COMMIT");
      return { ok: true, previousPartnerId, partnerId: input.partnerId };
    }
    const updated = await client.query<{ id: string }>(
      `UPDATE reservations
       SET accepted_partner_id = $2,
           accepted_at = NOW(),
           accepted_by_partner_user_id = NULL,
           ${CLEAR_FLEET_SET}
       WHERE id = $1
         AND deleted_at IS NULL
         AND status <> 'cancelled'
       RETURNING id`,
      [input.reservationId, input.partnerId],
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "failed" };
    }
    await client.query("COMMIT");
    return { ok: true, previousPartnerId, partnerId: input.partnerId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function clearOpsReservationPartner(input: {
  reservationId: string;
}): Promise<{ ok: true } | { ok: false; error: OpsAssignmentError }> {
  if (!isUuid(input.reservationId)) {
    return { ok: false, error: "invalid-selection" };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<ReservationLockRow>(
      `SELECT id, status, accepted_partner_id
       FROM reservations
       WHERE id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [input.reservationId],
    );
    const row = locked.rows[0];
    const blocked = lockedOrMissing(row);
    if (blocked) {
      await client.query("ROLLBACK");
      return { ok: false, error: blocked };
    }
    const updated = await client.query<{ id: string }>(
      `UPDATE reservations
       SET accepted_partner_id = NULL,
           accepted_at = NULL,
           accepted_by_partner_user_id = NULL,
           ${CLEAR_FLEET_SET}
       WHERE id = $1
         AND deleted_at IS NULL
         AND status <> 'cancelled'
       RETURNING id`,
      [input.reservationId],
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "failed" };
    }
    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function loadAssignableReservation(reservationId: string) {
  if (!isUuid(reservationId)) {
    return { ok: false as const, error: "invalid-selection" as OpsAssignmentError };
  }
  const result = await query<AssignableReservationRow>(
    `SELECT r.id, r.status, r.accepted_partner_id,
            COALESCE(p.is_primary_partner, FALSE) AS is_primary_partner
     FROM reservations r
     LEFT JOIN partners p ON p.id = r.accepted_partner_id
     WHERE r.id = $1
       AND r.deleted_at IS NULL
     LIMIT 1`,
    [reservationId],
  );
  const row = result.rows[0];
  const blocked = lockedOrMissing(row);
  if (blocked) {
    return { ok: false as const, error: blocked };
  }
  if (!row.accepted_partner_id) {
    return { ok: false as const, error: "no-partner" as const };
  }
  return { ok: true as const, row, partnerId: row.accepted_partner_id };
}

function opsFleetAccess(
  row: AssignableReservationRow,
  selectionKind: AssignmentKind,
  fleetPartnerId?: string | null,
) {
  return assertAssignmentAccess({
    reservationAcceptedPartnerId: row.accepted_partner_id,
    actorPartnerId: row.accepted_partner_id ?? "",
    actorIsPrimary: row.is_primary_partner,
    reservationStatus: row.status,
    selectionKind,
    fleetPartnerId,
  });
}

export async function assignOpsReservationDriver(input: {
  reservationId: string;
  selection: string;
  fullName?: string;
  existingFirst?: string;
  existingLast?: string;
  phoneCountryCode?: string;
  phoneNational?: string;
  languageCodes?: readonly string[];
  notes?: string;
}): Promise<{ ok: true } | { ok: false; error: OpsAssignmentError }> {
  const loaded = await loadAssignableReservation(input.reservationId);
  if (!loaded.ok) {
    return loaded;
  }
  const selection = input.selection.trim();
  if (!selection) {
    return { ok: false, error: "invalid-selection" };
  }
  if (selection === NON_TRP_SELECTION) {
    const access = opsFleetAccess(loaded.row, "non_trp");
    if (!access.ok) {
      return access;
    }
    const parsed = parseNonTrpDriverForm({
      fullName: input.fullName ?? "",
      existingFirst: input.existingFirst ?? "",
      existingLast: input.existingLast ?? "",
      phoneCountryCode: input.phoneCountryCode ?? "",
      phoneNational: input.phoneNational ?? "",
      languageCodes: input.languageCodes ?? [],
      notes: input.notes ?? "",
    });
    if (!parsed.ok) {
      return parsed;
    }
    const updated = await query<{ id: string }>(
      `UPDATE reservations
       SET assigned_driver_kind = 'non_trp',
           assigned_driver_id = NULL,
           assigned_driver_snapshot = $2::jsonb,
           assignment_updated_at = NOW(),
           assignment_updated_by_partner_user_id = NULL
       WHERE id = $1
         AND accepted_partner_id = $3
         AND deleted_at IS NULL
         AND status <> 'cancelled'
       RETURNING id`,
      [input.reservationId, JSON.stringify(parsed.value), loaded.partnerId],
    );
    if (!updated.rows[0]) {
      return { ok: false, error: "failed" };
    }
    return { ok: true };
  }
  if (!isUuid(selection)) {
    return { ok: false, error: "invalid-selection" };
  }
  const driver = await getPartnerDriver(loaded.partnerId, selection);
  const access = opsFleetAccess(loaded.row, "registered", driver?.partnerId ?? null);
  if (!access.ok) {
    return access;
  }
  if (!driver || !isPartnerFleetAssignable(driver)) {
    return { ok: false, error: driver ? "inactive-fleet" : "foreign-fleet" };
  }
  const updated = await query<{ id: string }>(
    `UPDATE reservations
     SET assigned_driver_kind = 'registered',
         assigned_driver_id = $2,
         assigned_driver_snapshot = $3::jsonb,
         assignment_updated_at = NOW(),
         assignment_updated_by_partner_user_id = NULL
     WHERE id = $1
       AND accepted_partner_id = $4
       AND deleted_at IS NULL
       AND status <> 'cancelled'
     RETURNING id`,
    [
      input.reservationId,
      driver.id,
      JSON.stringify(registeredDriverSnapshot(driver)),
      loaded.partnerId,
    ],
  );
  if (!updated.rows[0]) {
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

export async function assignOpsReservationVehicle(input: {
  reservationId: string;
  selection: string;
  plate?: string;
  brandModel?: string;
  features?: string;
}): Promise<{ ok: true } | { ok: false; error: OpsAssignmentError }> {
  const loaded = await loadAssignableReservation(input.reservationId);
  if (!loaded.ok) {
    return loaded;
  }
  const selection = input.selection.trim();
  if (!selection) {
    return { ok: false, error: "invalid-selection" };
  }
  if (selection === NON_TRP_SELECTION) {
    const access = opsFleetAccess(loaded.row, "non_trp");
    if (!access.ok) {
      return access;
    }
    const parsed = parseNonTrpVehicleForm({
      plate: input.plate ?? "",
      brandModel: input.brandModel ?? "",
      features: input.features ?? "",
    });
    if (!parsed.ok) {
      return parsed;
    }
    const updated = await query<{ id: string }>(
      `UPDATE reservations
       SET assigned_vehicle_kind = 'non_trp',
           assigned_vehicle_id = NULL,
           assigned_vehicle_snapshot = $2::jsonb,
           assignment_updated_at = NOW(),
           assignment_updated_by_partner_user_id = NULL
       WHERE id = $1
         AND accepted_partner_id = $3
         AND deleted_at IS NULL
         AND status <> 'cancelled'
       RETURNING id`,
      [input.reservationId, JSON.stringify(parsed.value), loaded.partnerId],
    );
    if (!updated.rows[0]) {
      return { ok: false, error: "failed" };
    }
    return { ok: true };
  }
  if (!isUuid(selection)) {
    return { ok: false, error: "invalid-selection" };
  }
  const vehicle = await getPartnerVehicle(loaded.partnerId, selection);
  const access = opsFleetAccess(loaded.row, "registered", vehicle?.partnerId ?? null);
  if (!access.ok) {
    return access;
  }
  if (!vehicle || !isPartnerFleetAssignable(vehicle)) {
    return { ok: false, error: vehicle ? "inactive-fleet" : "foreign-fleet" };
  }
  const updated = await query<{ id: string }>(
    `UPDATE reservations
     SET assigned_vehicle_kind = 'registered',
         assigned_vehicle_id = $2,
         assigned_vehicle_snapshot = $3::jsonb,
         assignment_updated_at = NOW(),
         assignment_updated_by_partner_user_id = NULL
     WHERE id = $1
       AND accepted_partner_id = $4
       AND deleted_at IS NULL
       AND status <> 'cancelled'
     RETURNING id`,
    [
      input.reservationId,
      vehicle.id,
      JSON.stringify(registeredVehicleSnapshot(vehicle)),
      loaded.partnerId,
    ],
  );
  if (!updated.rows[0]) {
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

export async function clearOpsReservationDriver(input: {
  reservationId: string;
}): Promise<{ ok: true } | { ok: false; error: OpsAssignmentError }> {
  const access = await loadAssignableReservation(input.reservationId);
  if (!access.ok) {
    return access;
  }
  const updated = await query<{ id: string }>(
    `UPDATE reservations
     SET assigned_driver_kind = NULL,
         assigned_driver_id = NULL,
         assigned_driver_snapshot = NULL,
         assignment_updated_at = NOW(),
         assignment_updated_by_partner_user_id = NULL
     WHERE id = $1
       AND accepted_partner_id = $2
       AND deleted_at IS NULL
       AND status <> 'cancelled'
     RETURNING id`,
    [input.reservationId, access.partnerId],
  );
  if (!updated.rows[0]) {
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

export async function clearOpsReservationVehicle(input: {
  reservationId: string;
}): Promise<{ ok: true } | { ok: false; error: OpsAssignmentError }> {
  const access = await loadAssignableReservation(input.reservationId);
  if (!access.ok) {
    return access;
  }
  const updated = await query<{ id: string }>(
    `UPDATE reservations
     SET assigned_vehicle_kind = NULL,
         assigned_vehicle_id = NULL,
         assigned_vehicle_snapshot = NULL,
         assignment_updated_at = NOW(),
         assignment_updated_by_partner_user_id = NULL
     WHERE id = $1
       AND accepted_partner_id = $2
       AND deleted_at IS NULL
       AND status <> 'cancelled'
     RETURNING id`,
    [input.reservationId, access.partnerId],
  );
  if (!updated.rows[0]) {
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}
