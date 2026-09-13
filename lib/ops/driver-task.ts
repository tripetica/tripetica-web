import "server-only";

import { randomBytes } from "node:crypto";
import { passengerNoteText } from "@/lib/booking/passenger-note";
import {
  parseReservationServiceSnapshot,
} from "@/lib/booking/reservation-service-snapshot";
import { formatPackageCoverageForTour } from "@/lib/booking/tour-display";
import { countryName } from "@/lib/geo/countries";
import { query } from "@/lib/db/postgres";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  buildDriverTaskContact,
  buildDriverTaskPrice,
  buildDriverTaskPublicFields,
  driverTaskActionLabel,
  type DriverTaskOpsView,
  type DriverTaskPublicResult,
} from "@/lib/ops/driver-task-fields";
import { reservationPriceDisplay } from "@/lib/ops/reservation-price-display";
import {
  driverAssignmentFingerprint,
  driverTaskPath,
  isDriverTaskProgressStage,
  isDriverTaskPublicAccessOpen,
  isDriverTaskStage,
  nextDriverTaskStage,
  type DriverTaskEventSource,
  type DriverTaskStage,
} from "@/lib/ops/driver-task-stages";

export {
  canAdvanceDriverTask,
  driverAssignmentFingerprint,
  driverTaskPath,
  DRIVER_TASK_PUBLIC_GRACE_MS,
  isDriverTaskPublicAccessOpen,
  isDriverTaskStage,
  nextDriverTaskStage,
} from "@/lib/ops/driver-task-stages";
export {
  buildDriverTaskContact,
  buildDriverTaskPrice,
  buildDriverTaskPublicFields,
  driverTaskActionLabel,
  googleMapsCoordUrl,
  parseDriverTaskCoords,
  yandexMapsCoordUrl,
} from "@/lib/ops/driver-task-fields";
export type {
  DriverTaskEventView,
  DriverTaskOpsView,
  DriverTaskPublicResult,
  DriverTaskPublicView,
} from "@/lib/ops/driver-task-fields";
export type {
  DriverTaskEventSource,
  DriverTaskStage,
} from "@/lib/ops/driver-task-stages";

export function createDriverTaskToken() {
  return randomBytes(32).toString("base64url");
}

type Queryable = {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

type ReservationDriverRow = {
  id: string;
  assigned_driver_kind: string | null;
  assigned_driver_id: string | null;
  assigned_driver_snapshot: unknown;
};

type TaskRow = {
  reservation_id: string;
  access_token: string;
  current_stage: string;
  driver_fingerprint: string | null;
  show_price_info: boolean;
  show_passenger_contact: boolean;
  completed_at?: Date | null;
};

type EventRow = {
  stage: string;
  occurred_at: Date;
  event_source: string;
  driver_kind: string | null;
  driver_id: string | null;
  driver_fingerprint: string | null;
};

function fingerprintFromReservation(row: ReservationDriverRow) {
  return driverAssignmentFingerprint({
    kind: row.assigned_driver_kind,
    driverId: row.assigned_driver_id,
    snapshot: row.assigned_driver_snapshot,
  });
}

async function insertTask(db: Queryable, row: ReservationDriverRow) {
  const token = createDriverTaskToken();
  await db.query(
    `INSERT INTO reservation_driver_tasks (
       reservation_id, access_token, current_stage, driver_fingerprint
     ) VALUES ($1, $2, 'planned', $3)
     ON CONFLICT (reservation_id) DO NOTHING`,
    [row.id, token, fingerprintFromReservation(row)],
  );
}

export async function ensureMissingDriverTasks() {
  const missing = await query<ReservationDriverRow>(
    `SELECT r.id, r.assigned_driver_kind, r.assigned_driver_id, r.assigned_driver_snapshot
     FROM reservations r
     LEFT JOIN reservation_driver_tasks t ON t.reservation_id = r.id
     WHERE t.reservation_id IS NULL
       AND r.deleted_at IS NULL`,
  );
  for (const row of missing.rows) {
    await insertTask({ query }, row);
  }
  return missing.rows.length;
}

export async function ensureDriverTaskForReservation(
  db: Queryable,
  reservationId: string,
) {
  const result = await db.query(
    `SELECT id, assigned_driver_kind, assigned_driver_id, assigned_driver_snapshot
     FROM reservations
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [reservationId],
  );
  const reservation = result.rows[0] as ReservationDriverRow | undefined;
  if (!reservation) {
    return;
  }
  await insertTask(db, reservation);
}

export async function syncDriverTaskAfterAssignment(reservationId: string) {
  const reservation = await query<ReservationDriverRow>(
    `SELECT id, assigned_driver_kind, assigned_driver_id, assigned_driver_snapshot
     FROM reservations
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [reservationId],
  );
  const row = reservation.rows[0];
  if (!row) {
    return;
  }
  const fingerprint = fingerprintFromReservation(row);
  const existing = await query<Pick<TaskRow, "reservation_id" | "driver_fingerprint">>(
    `SELECT reservation_id, driver_fingerprint
     FROM reservation_driver_tasks
     WHERE reservation_id = $1
     LIMIT 1`,
    [reservationId],
  );
  if (!existing.rows[0]) {
    await insertTask({ query }, row);
    return;
  }
  if (existing.rows[0].driver_fingerprint === fingerprint) {
    return;
  }
  await query(
    `UPDATE reservation_driver_tasks
     SET driver_fingerprint = $2,
         updated_at = NOW()
     WHERE reservation_id = $1`,
    [reservationId, fingerprint],
  );
}

export async function getDriverTaskForOps(
  reservationId: string,
  locale: Locale = "tr",
): Promise<DriverTaskOpsView | null> {
  await ensureDriverTaskForReservation({ query }, reservationId);
  const task = await query<TaskRow>(
    `SELECT reservation_id, access_token, current_stage, driver_fingerprint,
            show_price_info, show_passenger_contact
     FROM reservation_driver_tasks
     WHERE reservation_id = $1
     LIMIT 1`,
    [reservationId],
  );
  const row = task.rows[0];
  if (!row || !isDriverTaskStage(row.current_stage)) {
    return null;
  }
  const events = await query<EventRow>(
    `SELECT stage, occurred_at, event_source, driver_kind, driver_id, driver_fingerprint
     FROM reservation_driver_task_events
     WHERE reservation_id = $1
     ORDER BY occurred_at ASC, id ASC`,
    [reservationId],
  );
  return {
    stage: row.current_stage,
    openPath: localizedPath(isLocale(locale) ? locale : "tr", driverTaskPath(row.access_token)),
    showPriceInfo: Boolean(row.show_price_info),
    showPassengerContact: Boolean(row.show_passenger_contact),
    events: events.rows.flatMap((event) => {
      if (
        event.stage !== "en_route" &&
        event.stage !== "arrived" &&
        event.stage !== "picked_up" &&
        event.stage !== "completed"
      ) {
        return [];
      }
      return [
        {
          stage: event.stage,
          occurredAt: event.occurred_at.toISOString(),
          eventSource:
            event.event_source === "ops_manual" ? "ops_manual" : "driver_link",
        },
      ];
    }),
  };
}

type PublicReservationRow = {
  reservation_code: string;
  service_type: string | null;
  tour_code: string | null;
  pickup_at: Date | null;
  pickup_name_tr: string | null;
  pickup_name_customer: string | null;
  pickup_address_tr: string | null;
  pickup_address_customer: string | null;
  pickup_latitude: string | number | null;
  pickup_longitude: string | number | null;
  dropoff_name_tr: string | null;
  dropoff_name_customer: string | null;
  dropoff_address_tr: string | null;
  dropoff_address_customer: string | null;
  dropoff_latitude: string | number | null;
  dropoff_longitude: string | number | null;
  pickup_airport_code: string | null;
  pickup_location_type: string | null;
  pickup_place_id: string | null;
  flight_code: string | null;
  meet_and_greet: boolean | null;
  passenger_count: number | null;
  luggage_count: number | null;
  baby_seat_count: number | null;
  duration_hours: string | null;
  notes: string | null;
  service_content_snapshot: unknown;
  customer_email: string | null;
  customer_phone: string | null;
  total_price: string | null;
  currency: string | null;
  fx_snapshot: unknown;
  price_manually_overridden: boolean;
  manual_price_totals: unknown;
};

type PublicPassengerRow = {
  sequence_no: number;
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
  gender: string | null;
  identity_number: string | null;
};

function placeName(tr: string | null, customer: string | null) {
  return tr?.trim() || customer?.trim() || "";
}

function genderLabel(value: string | null) {
  const raw = value?.trim().toLowerCase() || "";
  if (raw === "male" || raw === "m" || raw === "erkek") {
    return "Erkek";
  }
  if (raw === "female" || raw === "f" || raw === "kadın" || raw === "kadin") {
    return "Kadın";
  }
  return value?.trim() || null;
}

const COMPLETED_AT_SQL = `(
  SELECT e.occurred_at
  FROM reservation_driver_task_events e
  WHERE e.reservation_id = t.reservation_id
    AND e.stage = 'completed'
  ORDER BY e.occurred_at ASC
  LIMIT 1
)`;

function publicAccessOpen(stage: string, completedAt: Date | null | undefined) {
  return (
    isDriverTaskStage(stage) &&
    isDriverTaskPublicAccessOpen({ stage, completedAt })
  );
}

export async function inspectDriverTaskPublicAccess(
  token: string,
): Promise<{ valid: true } | { valid: false; reason: "revoked" | "not-found" }> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { valid: false, reason: "not-found" };
  }
  const task = await query<{ current_stage: string; completed_at: Date | null }>(
    `SELECT t.current_stage, ${COMPLETED_AT_SQL} AS completed_at
     FROM reservation_driver_tasks t
     JOIN reservations r ON r.id = t.reservation_id
     WHERE t.access_token = $1
       AND r.deleted_at IS NULL
     LIMIT 1`,
    [trimmed],
  );
  const row = task.rows[0];
  if (!row || !publicAccessOpen(row.current_stage, row.completed_at)) {
    return { valid: false, reason: "revoked" };
  }
  return { valid: true };
}

export async function loadDriverTaskByToken(
  token: string,
  options?: { enforcePublicExpiry?: boolean },
): Promise<DriverTaskPublicResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { valid: false, reason: "not-found" };
  }
  const enforcePublicExpiry = options?.enforcePublicExpiry !== false;
  const task = await query<TaskRow & PublicReservationRow>(
    `SELECT
        t.reservation_id, t.access_token, t.current_stage, t.driver_fingerprint,
        t.show_price_info, t.show_passenger_contact,
        ${COMPLETED_AT_SQL} AS completed_at,
        r.reservation_code, r.service_type, r.tour_code, r.pickup_at,
        r.pickup_name_tr, r.pickup_name_customer,
        r.pickup_address_tr, r.pickup_address_customer,
        r.pickup_latitude, r.pickup_longitude,
        r.dropoff_name_tr, r.dropoff_name_customer,
        r.dropoff_address_tr, r.dropoff_address_customer,
        r.dropoff_latitude, r.dropoff_longitude,
        r.pickup_airport_code, r.pickup_location_type, r.pickup_place_id,
        r.flight_code, r.meet_and_greet,
        r.passenger_count, r.luggage_count, r.baby_seat_count,
        r.duration_hours::text AS duration_hours,
        r.notes, r.service_content_snapshot,
        r.customer_email, r.customer_phone,
        r.total_price::text AS total_price, r.currency, r.fx_snapshot,
        r.price_manually_overridden, r.manual_price_totals
     FROM reservation_driver_tasks t
     JOIN reservations r ON r.id = t.reservation_id
     WHERE t.access_token = $1
       AND r.deleted_at IS NULL
     LIMIT 1`,
    [trimmed],
  );
  const row = task.rows[0];
  if (!row || !isDriverTaskStage(row.current_stage)) {
    return { valid: false, reason: "revoked" };
  }
  if (enforcePublicExpiry && !publicAccessOpen(row.current_stage, row.completed_at)) {
    return { valid: false, reason: "revoked" };
  }
  const passengers = await query<PublicPassengerRow>(
    `SELECT sequence_no, first_name, last_name, country_code, gender, identity_number
     FROM reservations_passengers
     WHERE reservation_id = $1
     ORDER BY sequence_no ASC`,
    [row.reservation_id],
  );
  const snapshot = parseReservationServiceSnapshot(row.service_content_snapshot);
  const packageCoverage =
    snapshot?.locales.tr.packageCoverage ||
    formatPackageCoverageForTour(row.tour_code, "tr");
  const pickupAtLabel = row.pickup_at
    ? new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(row.pickup_at)
    : null;
  return {
    valid: true,
    stage: row.current_stage,
    nextStage: nextDriverTaskStage(row.current_stage),
    actionLabel: driverTaskActionLabel(row.current_stage),
    completed: row.current_stage === "completed",
    reservationCode: row.reservation_code,
    fields: buildDriverTaskPublicFields({
      serviceType: row.service_type,
      tourCode: row.tour_code,
      pickupAtLabel,
      pickupName: placeName(row.pickup_name_tr, row.pickup_name_customer),
      pickupAddress: placeName(row.pickup_address_tr, row.pickup_address_customer),
      pickupLatitude: row.pickup_latitude,
      pickupLongitude: row.pickup_longitude,
      dropoffName: placeName(row.dropoff_name_tr, row.dropoff_name_customer),
      dropoffAddress: placeName(row.dropoff_address_tr, row.dropoff_address_customer),
      dropoffLatitude: row.dropoff_latitude,
      dropoffLongitude: row.dropoff_longitude,
      pickupAirportCode: row.pickup_airport_code,
      pickupLocationType: row.pickup_location_type,
      pickupPlaceId: row.pickup_place_id,
      flightCode: row.flight_code,
      meetAndGreet: row.meet_and_greet,
      durationHours: row.duration_hours,
      packageCoverage,
      passengerCount: row.passenger_count,
      luggageCount: row.luggage_count,
      babySeatCount: row.baby_seat_count,
    }),
    note: passengerNoteText(row.notes),
    contact: buildDriverTaskContact(
      Boolean(row.show_passenger_contact),
      row.customer_phone,
      row.customer_email,
    ),
    price: buildDriverTaskPrice(
      Boolean(row.show_price_info),
      reservationPriceDisplay("tr", {
        currency: row.currency,
        fxSnapshot: row.fx_snapshot,
        totalPrice: row.total_price,
        priceManuallyOverridden: row.price_manually_overridden,
        manualPriceTotals: row.manual_price_totals,
      }),
    ),
    passengers: passengers.rows.map((passenger) => ({
      sequenceNo: passenger.sequence_no,
      firstName: passenger.first_name?.trim() || null,
      lastName: passenger.last_name?.trim() || null,
      nationality:
        countryName(passenger.country_code, "tr") ||
        passenger.country_code?.trim() ||
        null,
      gender: genderLabel(passenger.gender),
      identityNumber: passenger.identity_number?.trim() || null,
    })),
  };
}

export async function updateDriverTaskVisibility(
  reservationId: string,
  flags: { showPriceInfo: boolean; showPassengerContact: boolean },
) {
  await ensureDriverTaskForReservation({ query }, reservationId);
  await query(
    `UPDATE reservation_driver_tasks
     SET show_price_info = $2,
         show_passenger_contact = $3,
         updated_at = NOW()
     WHERE reservation_id = $1`,
    [reservationId, flags.showPriceInfo, flags.showPassengerContact],
  );
}

export async function advanceDriverTaskByToken(
  token: string,
  requestedStage: string,
): Promise<
  | { ok: true; stage: DriverTaskStage }
  | { ok: false; reason: "revoked" | "completed" | "conflict" }
> {
  const trimmed = token.trim();
  if (!trimmed || !isDriverTaskProgressStage(requestedStage)) {
    return { ok: false, reason: "revoked" };
  }
  const { getPool } = await import("@/lib/db/postgres");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<
      TaskRow & {
        assigned_driver_kind: string | null;
        assigned_driver_id: string | null;
        assigned_driver_snapshot: unknown;
      }
    >(
      `SELECT
          t.reservation_id, t.access_token, t.current_stage, t.driver_fingerprint,
          ${COMPLETED_AT_SQL} AS completed_at,
          r.assigned_driver_kind, r.assigned_driver_id, r.assigned_driver_snapshot
       FROM reservation_driver_tasks t
       JOIN reservations r ON r.id = t.reservation_id
       WHERE t.access_token = $1
         AND r.deleted_at IS NULL
       FOR UPDATE OF t`,
      [trimmed],
    );
    const row = locked.rows[0];
    if (!row || !isDriverTaskStage(row.current_stage)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "revoked" };
    }
    if (!publicAccessOpen(row.current_stage, row.completed_at)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "revoked" };
    }
    if (row.current_stage === requestedStage) {
      await client.query("COMMIT");
      return { ok: true, stage: requestedStage };
    }
    if (row.current_stage === "completed") {
      await client.query("COMMIT");
      return { ok: false, reason: "completed" };
    }
    if (nextDriverTaskStage(row.current_stage) !== requestedStage) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "conflict" };
    }
    const updated = await client.query<TaskRow>(
      `UPDATE reservation_driver_tasks
       SET current_stage = $2,
           updated_at = NOW()
       WHERE reservation_id = $1
         AND access_token = $3
         AND current_stage = $4
       RETURNING reservation_id, access_token, current_stage, driver_fingerprint`,
      [row.reservation_id, requestedStage, trimmed, row.current_stage],
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "conflict" };
    }
    await client.query(
      `INSERT INTO reservation_driver_task_events (
         reservation_id, stage, occurred_at, event_source,
         driver_kind, driver_id, driver_fingerprint
       ) VALUES ($1, $2, NOW(), 'driver_link', $3, $4, $5)`,
      [
        row.reservation_id,
        requestedStage,
        row.assigned_driver_kind,
        row.assigned_driver_id,
        driverAssignmentFingerprint({
          kind: row.assigned_driver_kind,
          driverId: row.assigned_driver_id,
          snapshot: row.assigned_driver_snapshot,
        }),
      ],
    );
    await client.query("COMMIT");
    return { ok: true, stage: requestedStage };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
