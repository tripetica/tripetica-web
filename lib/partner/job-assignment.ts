import "server-only";

import { query } from "@/lib/db/postgres";
import { syncDriverTaskAfterAssignment } from "@/lib/ops/driver-task";
import { isUuid } from "@/lib/ops/process-filters";
import { normalizePartnerDriverLanguageCodes } from "@/lib/partner/driver-languages";
import {
  getPartnerDriver,
  getPartnerVehicle,
  isPartnerFleetAssignable,
} from "@/lib/partner/fleet";
import { partnerDriverFullName } from "@/lib/partner/fleet-view";
import {
  assertAssignmentAccess,
  assertCanClearAssignment,
  emptyDriverAssignment,
  emptyVehicleAssignment,
  isAssignmentLocked,
  NON_TRP_SELECTION,
  parseNonTrpDriverForm,
  parseNonTrpVehicleForm,
  registeredDriverSnapshot,
  registeredVehicleSnapshot,
  resolveDriverAssignment,
  resolveVehicleAssignment,
  type AssignJobError,
  type JobAssignmentView,
} from "@/lib/partner/job-assignment-view";

export type { AssignJobError };

type ReservationAssignmentRow = {
  id: string;
  status: string;
  accepted_partner_id: string | null;
  assigned_driver_kind: string | null;
  assigned_driver_id: string | null;
  assigned_driver_snapshot: unknown;
  assigned_vehicle_kind: string | null;
  assigned_vehicle_id: string | null;
  assigned_vehicle_snapshot: unknown;
};

type LiveDriverRow = {
  id: string;
  partner_id: string;
  first_name: string;
  last_name: string;
  national_id: string | null;
  phone: string | null;
  phone_country_code: string | null;
  languages: string[] | null;
  status: "active" | "inactive";
  deleted_at: Date | null;
  updated_at: Date;
};

type LiveVehicleRow = {
  id: string;
  partner_id: string;
  plate: string;
  brand_code: string | null;
  model_code: string | null;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  color_code: string | null;
  color_other: string | null;
  color: string | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  vehicle_class_code: string | null;
  feature_codes: string[] | null;
  feature_other: string | null;
  features: string | null;
  status: "active" | "inactive" | "pending_approval" | "rejected";
  approved_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function mapLiveDriver(row: LiveDriverRow) {
  return {
    id: row.id,
    partnerId: row.partner_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: partnerDriverFullName(row.first_name, row.last_name),
    nationalId: row.national_id,
    phone: row.phone,
    phoneCountryCode: row.phone_country_code,
    email: null,
    languageCodes: normalizePartnerDriverLanguageCodes(row.languages ?? []),
    status: row.status,
    deletedAt: row.deleted_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapLiveVehicle(row: LiveVehicleRow) {
  return {
    id: row.id,
    partnerId: row.partner_id,
    plate: row.plate,
    brandCode: row.brand_code,
    modelCode: row.model_code,
    brand: row.brand,
    model: row.model,
    modelYear: row.model_year,
    colorCode: row.color_code,
    colorOther: row.color_other,
    color: row.color,
    passengerCapacity: row.passenger_capacity,
    luggageCapacity: row.luggage_capacity,
    vehicleClassCode: row.vehicle_class_code,
    featureCodes: row.feature_codes ?? [],
    featureOther: row.feature_other,
    features: row.features,
    status: row.status,
    approvedAt: row.approved_at?.toISOString() ?? null,
    deletedAt: row.deleted_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function loadReservationAssignment(reservationId: string) {
  const result = await query<ReservationAssignmentRow>(
    `SELECT id, status, accepted_partner_id,
            assigned_driver_kind, assigned_driver_id, assigned_driver_snapshot,
            assigned_vehicle_kind, assigned_vehicle_id, assigned_vehicle_snapshot
     FROM reservations
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [reservationId],
  );
  return result.rows[0] ?? null;
}

async function loadLiveDriver(driverId: string | null, partnerId: string) {
  if (!driverId) {
    return null;
  }
  const result = await query<LiveDriverRow>(
    `SELECT id, partner_id, first_name, last_name, national_id, phone,
            phone_country_code, languages, status, deleted_at, updated_at
     FROM partner_drivers
     WHERE id = $1
       AND partner_id = $2
     LIMIT 1`,
    [driverId, partnerId],
  );
  return result.rows[0] ? mapLiveDriver(result.rows[0]) : null;
}

async function loadLiveVehicle(vehicleId: string | null, partnerId: string) {
  if (!vehicleId) {
    return null;
  }
  const result = await query<LiveVehicleRow>(
    `SELECT id, partner_id, plate, brand_code, model_code, brand, model, model_year,
            color_code, color_other, color, passenger_capacity, luggage_capacity,
            vehicle_class_code, feature_codes, feature_other, features, status,
            approved_at, deleted_at, created_at, updated_at
     FROM partner_vehicles
     WHERE id = $1
       AND partner_id = $2
     LIMIT 1`,
    [vehicleId, partnerId],
  );
  return result.rows[0] ? mapLiveVehicle(result.rows[0]) : null;
}

export async function loadPartnerJobAssignment(input: {
  reservationId: string;
  partnerId: string;
}): Promise<JobAssignmentView | null> {
  const row = await loadReservationAssignment(input.reservationId);
  if (!row || row.accepted_partner_id !== input.partnerId) {
    return null;
  }
  const [liveDriver, liveVehicle] = await Promise.all([
    loadLiveDriver(row.assigned_driver_id, input.partnerId),
    loadLiveVehicle(row.assigned_vehicle_id, input.partnerId),
  ]);
  return {
    locked: isAssignmentLocked(row.status),
    driver: resolveDriverAssignment({
      kind: row.assigned_driver_kind,
      driverId: row.assigned_driver_id,
      snapshot: row.assigned_driver_snapshot,
      live: liveDriver,
    }),
    vehicle: resolveVehicleAssignment({
      kind: row.assigned_vehicle_kind,
      vehicleId: row.assigned_vehicle_id,
      snapshot: row.assigned_vehicle_snapshot,
      live: liveVehicle,
    }),
  };
}

export async function loadOpsReservationAssignment(reservationId: string) {
  const row = await loadReservationAssignment(reservationId);
  if (!row) {
    return null;
  }
  const [liveDriver, liveVehicle] = await Promise.all([
    loadLiveDriver(row.assigned_driver_id, row.accepted_partner_id ?? ""),
    loadLiveVehicle(row.assigned_vehicle_id, row.accepted_partner_id ?? ""),
  ]);
  return {
    acceptedPartnerId: row.accepted_partner_id,
    status: row.status,
    locked: isAssignmentLocked(row.status),
    driver: resolveDriverAssignment({
      kind: row.assigned_driver_kind,
      driverId: row.assigned_driver_id,
      snapshot: row.assigned_driver_snapshot,
      live: row.accepted_partner_id ? liveDriver : null,
    }),
    vehicle: resolveVehicleAssignment({
      kind: row.assigned_vehicle_kind,
      vehicleId: row.assigned_vehicle_id,
      snapshot: row.assigned_vehicle_snapshot,
      live: row.accepted_partner_id ? liveVehicle : null,
    }),
  };
}

export async function assignPartnerJobDriver(input: {
  partnerId: string;
  userId: string;
  isPrimaryPartner: boolean;
  reservationId: string;
  selection: string;
  fullName: string;
  existingFirst: string;
  existingLast: string;
  phoneCountryCode: string;
  phoneNational: string;
  languageCodes: readonly string[];
  notes: string;
}): Promise<{ ok: true } | { ok: false; error: AssignJobError }> {
  const row = await loadReservationAssignment(input.reservationId);
  if (!row) {
    return { ok: false, error: "not-found" };
  }
  const selection = input.selection.trim();
  if (!selection) {
    return { ok: false, error: "invalid-selection" };
  }
  if (selection === NON_TRP_SELECTION) {
    const access = assertAssignmentAccess({
      reservationAcceptedPartnerId: row.accepted_partner_id,
      actorPartnerId: input.partnerId,
      actorIsPrimary: input.isPrimaryPartner,
      reservationStatus: row.status,
      selectionKind: "non_trp",
    });
    if (!access.ok) {
      return access;
    }
    const parsed = parseNonTrpDriverForm({
      fullName: input.fullName,
      existingFirst: input.existingFirst,
      existingLast: input.existingLast,
      phoneCountryCode: input.phoneCountryCode,
      phoneNational: input.phoneNational,
      languageCodes: input.languageCodes,
      notes: input.notes,
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
           assignment_updated_by_partner_user_id = $3
       WHERE id = $1
         AND accepted_partner_id = $4
         AND deleted_at IS NULL
         AND status <> 'cancelled'
       RETURNING id`,
      [input.reservationId, JSON.stringify(parsed.value), input.userId, input.partnerId],
    );
    if (!updated.rows[0]) {
      return { ok: false, error: "failed" };
    }
    await syncDriverTaskAfterAssignment(input.reservationId);
    return { ok: true };
  }
  if (!isUuid(selection)) {
    return { ok: false, error: "invalid-selection" };
  }
  const driver = await getPartnerDriver(input.partnerId, selection);
  const access = assertAssignmentAccess({
    reservationAcceptedPartnerId: row.accepted_partner_id,
    actorPartnerId: input.partnerId,
    actorIsPrimary: input.isPrimaryPartner,
    reservationStatus: row.status,
    selectionKind: "registered",
    fleetPartnerId: driver?.partnerId ?? null,
  });
  if (!access.ok) {
    return access;
  }
  if (!driver || !isPartnerFleetAssignable(driver)) {
    return { ok: false, error: "inactive-fleet" };
  }
  const updated = await query<{ id: string }>(
    `UPDATE reservations
     SET assigned_driver_kind = 'registered',
         assigned_driver_id = $2,
         assigned_driver_snapshot = $3::jsonb,
         assignment_updated_at = NOW(),
         assignment_updated_by_partner_user_id = $4
     WHERE id = $1
       AND accepted_partner_id = $5
       AND deleted_at IS NULL
       AND status <> 'cancelled'
     RETURNING id`,
    [
      input.reservationId,
      driver.id,
      JSON.stringify(registeredDriverSnapshot(driver)),
      input.userId,
      input.partnerId,
    ],
  );
  if (!updated.rows[0]) {
    return { ok: false, error: "failed" };
  }
  await syncDriverTaskAfterAssignment(input.reservationId);
  return { ok: true };
}

export async function assignPartnerJobVehicle(input: {
  partnerId: string;
  userId: string;
  isPrimaryPartner: boolean;
  reservationId: string;
  selection: string;
  plate: string;
  brandModel: string;
  features: string;
}): Promise<{ ok: true } | { ok: false; error: AssignJobError }> {
  const row = await loadReservationAssignment(input.reservationId);
  if (!row) {
    return { ok: false, error: "not-found" };
  }
  const selection = input.selection.trim();
  if (!selection) {
    return { ok: false, error: "invalid-selection" };
  }
  if (selection === NON_TRP_SELECTION) {
    const access = assertAssignmentAccess({
      reservationAcceptedPartnerId: row.accepted_partner_id,
      actorPartnerId: input.partnerId,
      actorIsPrimary: input.isPrimaryPartner,
      reservationStatus: row.status,
      selectionKind: "non_trp",
    });
    if (!access.ok) {
      return access;
    }
    const parsed = parseNonTrpVehicleForm({
      plate: input.plate,
      brandModel: input.brandModel,
      features: input.features,
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
           assignment_updated_by_partner_user_id = $3
       WHERE id = $1
         AND accepted_partner_id = $4
         AND deleted_at IS NULL
         AND status <> 'cancelled'
       RETURNING id`,
      [input.reservationId, JSON.stringify(parsed.value), input.userId, input.partnerId],
    );
    if (!updated.rows[0]) {
      return { ok: false, error: "failed" };
    }
    return { ok: true };
  }
  if (!isUuid(selection)) {
    return { ok: false, error: "invalid-selection" };
  }
  const vehicle = await getPartnerVehicle(input.partnerId, selection);
  const access = assertAssignmentAccess({
    reservationAcceptedPartnerId: row.accepted_partner_id,
    actorPartnerId: input.partnerId,
    actorIsPrimary: input.isPrimaryPartner,
    reservationStatus: row.status,
    selectionKind: "registered",
    fleetPartnerId: vehicle?.partnerId ?? null,
  });
  if (!access.ok) {
    return access;
  }
  if (!vehicle || !isPartnerFleetAssignable(vehicle)) {
    return { ok: false, error: "inactive-fleet" };
  }
  const updated = await query<{ id: string }>(
    `UPDATE reservations
     SET assigned_vehicle_kind = 'registered',
         assigned_vehicle_id = $2,
         assigned_vehicle_snapshot = $3::jsonb,
         assignment_updated_at = NOW(),
         assignment_updated_by_partner_user_id = $4
     WHERE id = $1
       AND accepted_partner_id = $5
       AND deleted_at IS NULL
       AND status <> 'cancelled'
     RETURNING id`,
    [
      input.reservationId,
      vehicle.id,
      JSON.stringify(registeredVehicleSnapshot(vehicle)),
      input.userId,
      input.partnerId,
    ],
  );
  if (!updated.rows[0]) {
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

type AssignmentSourceRow = {
  id: string;
  status: string;
  assigned_driver_kind: string | null;
  assigned_driver_id: string | null;
  assigned_driver_snapshot: unknown;
  assigned_vehicle_kind: string | null;
  assigned_vehicle_id: string | null;
  assigned_vehicle_snapshot: unknown;
};

export async function assignmentViewsForRows(
  partnerId: string,
  rows: readonly AssignmentSourceRow[],
): Promise<Map<string, JobAssignmentView>> {
  const views = new Map<string, JobAssignmentView>();
  if (rows.length === 0) {
    return views;
  }
  const driverIds = [
    ...new Set(rows.map((row) => row.assigned_driver_id).filter((id): id is string => Boolean(id))),
  ];
  const vehicleIds = [
    ...new Set(rows.map((row) => row.assigned_vehicle_id).filter((id): id is string => Boolean(id))),
  ];
  const [drivers, vehicles] = await Promise.all([
    loadLiveDriversByIds(partnerId, driverIds),
    loadLiveVehiclesByIds(partnerId, vehicleIds),
  ]);
  for (const row of rows) {
    views.set(row.id, {
      locked: isAssignmentLocked(row.status),
      driver: resolveDriverAssignment({
        kind: row.assigned_driver_kind,
        driverId: row.assigned_driver_id,
        snapshot: row.assigned_driver_snapshot,
        live: row.assigned_driver_id ? (drivers.get(row.assigned_driver_id) ?? null) : null,
      }),
      vehicle: resolveVehicleAssignment({
        kind: row.assigned_vehicle_kind,
        vehicleId: row.assigned_vehicle_id,
        snapshot: row.assigned_vehicle_snapshot,
        live: row.assigned_vehicle_id ? (vehicles.get(row.assigned_vehicle_id) ?? null) : null,
      }),
    });
  }
  return views;
}

async function loadLiveDriversByIds(partnerId: string, driverIds: string[]) {
  const map = new Map<string, ReturnType<typeof mapLiveDriver>>();
  if (driverIds.length === 0) {
    return map;
  }
  const result = await query<LiveDriverRow>(
    `SELECT id, partner_id, first_name, last_name, national_id, phone,
            phone_country_code, languages, status, deleted_at, updated_at
     FROM partner_drivers
     WHERE partner_id = $1
       AND id = ANY($2::uuid[])`,
    [partnerId, driverIds],
  );
  for (const row of result.rows) {
    map.set(row.id, mapLiveDriver(row));
  }
  return map;
}

async function loadLiveVehiclesByIds(partnerId: string, vehicleIds: string[]) {
  const map = new Map<string, ReturnType<typeof mapLiveVehicle>>();
  if (vehicleIds.length === 0) {
    return map;
  }
  const result = await query<LiveVehicleRow>(
    `SELECT id, partner_id, plate, brand_code, model_code, brand, model, model_year,
            color_code, color_other, color, passenger_capacity, luggage_capacity,
            vehicle_class_code, feature_codes, feature_other, features, status,
            approved_at, deleted_at, created_at, updated_at
     FROM partner_vehicles
     WHERE partner_id = $1
       AND id = ANY($2::uuid[])`,
    [partnerId, vehicleIds],
  );
  for (const row of result.rows) {
    map.set(row.id, mapLiveVehicle(row));
  }
  return map;
}

async function clearAssignmentAccess(input: {
  partnerId: string;
  reservationId: string;
}) {
  const row = await loadReservationAssignment(input.reservationId);
  if (!row) {
    return { ok: false as const, error: "not-found" as AssignJobError };
  }
  const access = assertCanClearAssignment({
    reservationAcceptedPartnerId: row.accepted_partner_id,
    actorPartnerId: input.partnerId,
    reservationStatus: row.status,
  });
  if (!access.ok) {
    return { ok: false as const, error: access.error };
  }
  return { ok: true as const, error: null };
}

export async function clearPartnerJobDriver(input: {
  partnerId: string;
  userId: string;
  reservationId: string;
}): Promise<{ ok: true } | { ok: false; error: AssignJobError }> {
  const access = await clearAssignmentAccess(input);
  if (!access.ok) {
    return { ok: false, error: access.error };
  }
  const updated = await query<{ id: string }>(
    `UPDATE reservations
     SET assigned_driver_kind = NULL,
         assigned_driver_id = NULL,
         assigned_driver_snapshot = NULL,
         assignment_updated_at = NOW(),
         assignment_updated_by_partner_user_id = $2
     WHERE id = $1
       AND accepted_partner_id = $3
       AND deleted_at IS NULL
       AND status <> 'cancelled'
     RETURNING id`,
    [input.reservationId, input.userId, input.partnerId],
  );
  if (!updated.rows[0]) {
    return { ok: false, error: "failed" };
  }
  await syncDriverTaskAfterAssignment(input.reservationId);
  return { ok: true };
}

export async function clearPartnerJobVehicle(input: {
  partnerId: string;
  userId: string;
  reservationId: string;
}): Promise<{ ok: true } | { ok: false; error: AssignJobError }> {
  const access = await clearAssignmentAccess(input);
  if (!access.ok) {
    return { ok: false, error: access.error };
  }
  const updated = await query<{ id: string }>(
    `UPDATE reservations
     SET assigned_vehicle_kind = NULL,
         assigned_vehicle_id = NULL,
         assigned_vehicle_snapshot = NULL,
         assignment_updated_at = NOW(),
         assignment_updated_by_partner_user_id = $2
     WHERE id = $1
       AND accepted_partner_id = $3
       AND deleted_at IS NULL
       AND status <> 'cancelled'
     RETURNING id`,
    [input.reservationId, input.userId, input.partnerId],
  );
  if (!updated.rows[0]) {
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

export function emptyJobAssignment(locked = false): JobAssignmentView {
  return {
    locked,
    driver: emptyDriverAssignment(),
    vehicle: emptyVehicleAssignment(),
  };
}
