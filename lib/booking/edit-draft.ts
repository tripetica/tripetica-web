import "server-only";

import { cookies } from "next/headers";
import {
  evaluateCustomerEdit,
} from "@/lib/account/customer-status-policy";
import { VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL } from "@/lib/account/customer-reservation-access-policy";
import {
  BROWSER_SESSION_COOKIE,
  BROWSER_SESSION_MAX_AGE_SECONDS,
  isBrowserSessionId,
} from "@/lib/booking/browser-session";
import { resolveLocationGeo } from "@/lib/booking/location-persist";
import {
  ABANDONED_STATUS,
  DRAFT_STATUS,
  VEHICLE_SELECTION_STAGE,
  type ActiveDraft,
  type EditOriginalFinancialSnapshot,
  findActiveDraft,
} from "@/lib/booking/reservation-search";
import {
  computeEditPriceDifference,
  type EditPriceDifference,
} from "@/lib/booking/edit-price-diff";
import { normalizeBosphorusPaxCounts, isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { isBursaTour, normalizeBursaRoute } from "@/lib/booking/pricing/bursa-pricing";
import { query } from "@/lib/db/postgres";
import { type Locale } from "@/lib/i18n/config";

export type { EditOriginalFinancialSnapshot, EditPriceDifference };
export { computeEditPriceDifference };

type OwnedReservationRow = {
  id: string;
  reservation_code: string;
  status: string | null;
  locale: string | null;
  service_type: string;
  tour_code: string | null;
  pickup_name_customer: string | null;
  pickup_address_customer: string | null;
  pickup_name_tr: string | null;
  pickup_address_tr: string | null;
  pickup_place_id: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_location_type: string | null;
  pickup_airport_code: string | null;
  dropoff_name_customer: string | null;
  dropoff_address_customer: string | null;
  dropoff_name_tr: string | null;
  dropoff_address_tr: string | null;
  dropoff_place_id: string | null;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  dropoff_location_type: string | null;
  dropoff_airport_code: string | null;
  pickup_at: Date | null;
  service_timezone: string | null;
  distance_km: string | number | null;
  passenger_count: number | null;
  luggage_count: number | null;
  baby_seat_count: number | null;
  flight_code: string | null;
  meet_and_greet: boolean | null;
  duration_hours: string | number | null;
  vehicle_code: string | null;
  vehicle_label_customer: string | null;
  vehicle_label_tr: string | null;
  total_price: string | number | null;
  currency: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_provider: string | null;
  payment_provider_order_id: string | null;
  payment_amount: string | number | null;
  payment_currency: string | null;
  fx_snapshot: unknown;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_country_code: string | null;
  notes: string | null;
  bursa_route: string | null;
  bosphorus_adult_soft: number | null;
  bosphorus_adult_alcohol: number | null;
  bosphorus_child_5_9: number | null;
  bosphorus_child_0_4: number | null;
};

type PassengerRow = {
  sequence_no: number;
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
  identity_number: string | null;
  gender: string | null;
  is_primary_passenger: boolean;
};

function asMoney(value: string | number | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDistance(value: string | number | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDuration(value: string | number | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function editPriceDifferenceFromDraft(
  draft: Pick<
    ActiveDraft,
    "editingOriginal" | "appliedVehicleTotal" | "currency"
  >,
): EditPriceDifference | null {
  if (!draft.editingOriginal) {
    return null;
  }
  return computeEditPriceDifference({
    originalTotal: draft.editingOriginal.totalPrice,
    originalCurrency: draft.editingOriginal.currency,
    newTotal: draft.appliedVehicleTotal,
    newCurrency: draft.currency,
  });
}

async function resolveOrCreateBrowserSessionId() {
  const jar = await cookies();
  const existing = jar.get(BROWSER_SESSION_COOKIE)?.value;
  if (isBrowserSessionId(existing)) {
    return existing;
  }
  const id = crypto.randomUUID();
  jar.set({
    name: BROWSER_SESSION_COOKIE,
    value: id,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: BROWSER_SESSION_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
  return id;
}

/**
 * Soft-close active drafts instead of DELETE.
 * reservation_edit_settlements.edit_draft_id is ON DELETE RESTRICT, so hard
 * delete of reservation_searches fails once a settlement row exists.
 * Payment / refund ledger rows stay on the original reservation.
 */
async function softCloseActiveDrafts(input: {
  browserSessionId?: string | null;
  editingReservationId?: string | null;
  /** When true with browserSessionId, only close edit drafts for that session. */
  editingOnly?: boolean;
}) {
  const where: string[] = ["status = $2"];
  const values: unknown[] = [ABANDONED_STATUS, DRAFT_STATUS];
  if (input.browserSessionId) {
    values.push(input.browserSessionId);
    where.push(`browser_session_id = $${values.length}`);
  }
  if (input.editingReservationId) {
    values.push(input.editingReservationId);
    where.push(`editing_reservation_id = $${values.length}`);
  }
  if (input.editingOnly) {
    where.push("editing_reservation_id IS NOT NULL");
  }
  if (!input.browserSessionId && !input.editingReservationId) {
    return;
  }

  const closed = await query<{ id: string }>(
    `UPDATE reservation_searches
     SET status = $1,
         current_stage = COALESCE(current_stage, 'abandoned'),
         updated_at = NOW()
     WHERE ${where.join(" AND ")}
     RETURNING id`,
    values,
  );
  const draftIds = closed.rows.map((row) => row.id);
  if (draftIds.length === 0) {
    return;
  }

  // Unfinished edit settlements cannot stay pending after the draft is closed.
  await query(
    `UPDATE reservation_edit_settlements
     SET status = 'failed'
     WHERE edit_draft_id = ANY($1::uuid[])
       AND status = 'pending_payment'`,
    [draftIds],
  );
}

async function loadOwnedReservation(input: {
  userId: string;
  reservationId: string;
}) {
  const result = await query<OwnedReservationRow>(
    `SELECT id, reservation_code, status, locale, service_type, tour_code,
            pickup_name_customer, pickup_address_customer, pickup_name_tr,
            pickup_address_tr, pickup_place_id, pickup_latitude, pickup_longitude,
            pickup_location_type, pickup_airport_code,
            dropoff_name_customer, dropoff_address_customer, dropoff_name_tr,
            dropoff_address_tr, dropoff_place_id, dropoff_latitude,
            dropoff_longitude, dropoff_location_type, dropoff_airport_code,
            pickup_at, service_timezone, distance_km, passenger_count,
            luggage_count, baby_seat_count, flight_code, meet_and_greet,
            duration_hours, vehicle_code, vehicle_label_customer,
            vehicle_label_tr, total_price, currency, payment_method,
            payment_status, payment_provider, payment_provider_order_id,
            payment_amount, payment_currency, fx_snapshot,
            customer_first_name, customer_last_name, customer_email,
            customer_phone, customer_country_code, notes, bursa_route,
            bosphorus_adult_soft, bosphorus_adult_alcohol,
            bosphorus_child_5_9, bosphorus_child_0_4
     FROM reservations r
     WHERE r.id = $2
       AND r.deleted_at IS NULL
       AND ${VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL}
     LIMIT 1`,
    [input.userId, input.reservationId],
  );
  return result.rows[0] ?? null;
}

async function loadReservationForOpsEdit(reservationId: string) {
  const result = await query<OwnedReservationRow>(
    `SELECT id, reservation_code, status, locale, service_type, tour_code,
            pickup_name_customer, pickup_address_customer, pickup_name_tr,
            pickup_address_tr, pickup_place_id, pickup_latitude, pickup_longitude,
            pickup_location_type, pickup_airport_code,
            dropoff_name_customer, dropoff_address_customer, dropoff_name_tr,
            dropoff_address_tr, dropoff_place_id, dropoff_latitude,
            dropoff_longitude, dropoff_location_type, dropoff_airport_code,
            pickup_at, service_timezone, distance_km, passenger_count,
            luggage_count, baby_seat_count, flight_code, meet_and_greet,
            duration_hours, vehicle_code, vehicle_label_customer,
            vehicle_label_tr, total_price, currency, payment_method,
            payment_status, payment_provider, payment_provider_order_id,
            payment_amount, payment_currency, fx_snapshot,
            customer_first_name, customer_last_name, customer_email,
            customer_phone, customer_country_code, notes, bursa_route,
            bosphorus_adult_soft, bosphorus_adult_alcohol,
            bosphorus_child_5_9, bosphorus_child_0_4
     FROM reservations
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [reservationId],
  );
  return result.rows[0] ?? null;
}

async function loadReservationPassengers(reservationId: string) {
  const result = await query<PassengerRow>(
    `SELECT sequence_no, first_name, last_name, country_code, identity_number,
            gender, is_primary_passenger
     FROM reservations_passengers
     WHERE reservation_id = $1
     ORDER BY sequence_no ASC`,
    [reservationId],
  );
  return result.rows;
}

export type StartReservationEditResult =
  | { ok: true; draftId: string; reservationCode: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "cancelled"
        | "within_six_hours"
        | "failed";
    };

async function createEditDraftFromReservation(input: {
  row: OwnedReservationRow;
  locale: Locale;
  opsUserId: string | null;
}): Promise<StartReservationEditResult> {
  const row = input.row;
  const opsUserId = input.opsUserId;
  const browserSessionId = await resolveOrCreateBrowserSessionId();
  const [pickupGeo, dropoffGeo] = await Promise.all([
    resolveLocationGeo({
      placeId: row.pickup_place_id,
      airportCode: row.pickup_airport_code,
      locationType: row.pickup_location_type,
    }),
    resolveLocationGeo({
      placeId: row.dropoff_place_id,
      airportCode: row.dropoff_airport_code,
      locationType: row.dropoff_location_type,
    }),
  ]);

  const bursaRoute = isBursaTour(row.service_type, row.tour_code)
    ? normalizeBursaRoute(row.bursa_route)
    : null;
  const bosphorus = isBosphorusDinnerTour(row.service_type, row.tour_code)
    ? normalizeBosphorusPaxCounts({
        adultSoft: row.bosphorus_adult_soft ?? 0,
        adultAlcohol: row.bosphorus_adult_alcohol ?? 0,
        child5to9: row.bosphorus_child_5_9 ?? 0,
        child0to4: row.bosphorus_child_0_4 ?? 0,
      })
    : null;
  const distanceKm = asDistance(row.distance_km);
  const durationHours = asDuration(row.duration_hours);
  const totalPrice = asMoney(row.total_price);
  const paymentAmount = asMoney(row.payment_amount);
  const currency = row.currency?.trim().toUpperCase() || null;

  try {
    // Soft-close frees unique draft indexes without violating RESTRICT FKs
    // from reservation_edit_settlements (and keeps payment history intact).
    await softCloseActiveDrafts({ browserSessionId });
    await softCloseActiveDrafts({ editingReservationId: row.id });

    const inserted = await query<{ id: string }>(
      `INSERT INTO reservation_searches (
         browser_session_id,
         status,
         current_stage,
         locale,
         service_type,
         tour_code,
         selected_tour_code,
         service_timezone,
         currency,
         editing_reservation_id,
         editing_ops_user_id,
         edit_original_reservation_code,
         edit_original_total_price,
         edit_original_currency,
         edit_original_payment_method,
         edit_original_payment_status,
         edit_original_payment_amount,
         edit_original_payment_currency,
         edit_original_payment_provider,
         edit_original_payment_provider_order_id,
         edit_original_fx_snapshot,
         selected_pickup_name_customer,
         selected_pickup_address_customer,
         selected_pickup_name_tr,
         selected_pickup_address_tr,
         selected_pickup_place_id,
         selected_pickup_latitude,
         selected_pickup_longitude,
         selected_pickup_location_type,
         selected_pickup_airport_code,
         selected_pickup_province_code,
         selected_pickup_district_code,
         applied_pickup_name_customer,
         applied_pickup_address_customer,
         applied_pickup_name_tr,
         applied_pickup_address_tr,
         applied_pickup_place_id,
         applied_pickup_latitude,
         applied_pickup_longitude,
         applied_pickup_location_type,
         applied_pickup_airport_code,
         applied_pickup_province_code,
         applied_pickup_district_code,
         selected_dropoff_name_customer,
         selected_dropoff_address_customer,
         selected_dropoff_name_tr,
         selected_dropoff_address_tr,
         selected_dropoff_place_id,
         selected_dropoff_latitude,
         selected_dropoff_longitude,
         selected_dropoff_location_type,
         selected_dropoff_airport_code,
         selected_dropoff_province_code,
         selected_dropoff_district_code,
         applied_dropoff_name_customer,
         applied_dropoff_address_customer,
         applied_dropoff_name_tr,
         applied_dropoff_address_tr,
         applied_dropoff_place_id,
         applied_dropoff_latitude,
         applied_dropoff_longitude,
         applied_dropoff_location_type,
         applied_dropoff_airport_code,
         applied_dropoff_province_code,
         applied_dropoff_district_code,
         selected_pickup_at,
         applied_pickup_at,
         selected_distance_km,
         applied_distance_km,
         selected_duration_hours,
         applied_duration_hours,
         selected_passenger_count,
         applied_passenger_count,
         selected_luggage_count,
         applied_luggage_count,
         selected_baby_seat_count,
         applied_baby_seat_count,
         selected_flight_code,
         applied_flight_code,
         selected_meet_and_greet,
         applied_meet_and_greet,
         selected_bursa_route,
         applied_bursa_route,
         selected_bosphorus_adult_soft,
         selected_bosphorus_adult_alcohol,
         selected_bosphorus_child_5_9,
         selected_bosphorus_child_0_4,
         applied_bosphorus_adult_soft,
         applied_bosphorus_adult_alcohol,
         applied_bosphorus_child_5_9,
         applied_bosphorus_child_0_4,
         selected_vehicle_code,
         selected_vehicle_label_customer,
         selected_vehicle_label_tr,
         applied_vehicle_code,
         applied_vehicle_label_customer,
         applied_vehicle_label_tr,
         applied_vehicle_total,
         applied_fx_snapshot,
         customer_first_name,
         customer_last_name,
         customer_email,
         customer_phone,
         customer_country_code,
         notes
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb,
         $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
         $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
         $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42,
         $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42,
         $43, $43, $44, $44, $45, $45,
         $46, $46, $47, $47, $48, $48,
         $49, $49, $50, $50,
         $51, $51,
         $52, $53, $54, $55,
         $52, $53, $54, $55,
         $56, $57, $58,
         $56, $57, $58,
         $59, $20::jsonb,
         $60, $61, $62, $63, $64, $65
       )
       RETURNING id`,
      [
        browserSessionId,
        DRAFT_STATUS,
        VEHICLE_SELECTION_STAGE,
        input.locale,
        row.service_type,
        row.tour_code,
        row.service_timezone || "Europe/Istanbul",
        currency,
        row.id,
        opsUserId,
        row.reservation_code,
        totalPrice,
        currency,
        row.payment_method,
        row.payment_status,
        paymentAmount,
        row.payment_currency?.trim().toUpperCase() || null,
        row.payment_provider,
        row.payment_provider_order_id,
        row.fx_snapshot ?? null,
        row.pickup_name_customer,
        row.pickup_address_customer,
        row.pickup_name_tr,
        row.pickup_address_tr,
        row.pickup_place_id,
        row.pickup_latitude,
        row.pickup_longitude,
        row.pickup_location_type,
        row.pickup_airport_code,
        pickupGeo.provinceCode,
        pickupGeo.districtCode,
        row.dropoff_name_customer,
        row.dropoff_address_customer,
        row.dropoff_name_tr,
        row.dropoff_address_tr,
        row.dropoff_place_id,
        row.dropoff_latitude,
        row.dropoff_longitude,
        row.dropoff_location_type,
        row.dropoff_airport_code,
        dropoffGeo.provinceCode,
        dropoffGeo.districtCode,
        row.pickup_at,
        distanceKm,
        durationHours,
        row.passenger_count,
        row.luggage_count,
        row.baby_seat_count,
        row.flight_code,
        row.meet_and_greet === true,
        bursaRoute,
        bosphorus?.adultSoft ?? null,
        bosphorus?.adultAlcohol ?? null,
        bosphorus?.child5to9 ?? null,
        bosphorus?.child0to4 ?? null,
        row.vehicle_code,
        row.vehicle_label_customer,
        row.vehicle_label_tr,
        totalPrice,
        row.customer_first_name,
        row.customer_last_name,
        row.customer_email,
        row.customer_phone,
        row.customer_country_code,
        row.notes,
      ],
    );

    const draftId = inserted.rows[0]?.id;
    if (!draftId) {
      return { ok: false, reason: "failed" };
    }

    const passengers = await loadReservationPassengers(row.id);
    for (const passenger of passengers) {
      await query(
        `INSERT INTO reservation_searches_passengers (
           reservation_search_id, sequence_no, first_name, last_name,
           country_code, identity_number, gender, is_primary_passenger
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          draftId,
          passenger.sequence_no,
          passenger.first_name,
          passenger.last_name,
          passenger.country_code,
          passenger.identity_number,
          passenger.gender,
          passenger.is_primary_passenger,
        ],
      );
    }

    return {
      ok: true,
      draftId,
      reservationCode: row.reservation_code,
    };
  } catch (error) {
    console.error("[edit-draft] start failed", {
      reservationId: row.id,
      reservationCode: row.reservation_code,
      paymentMethod: row.payment_method,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
    return { ok: false, reason: "failed" };
  }
}

/**
 * Creates a separate edit draft from an owned reservation.
 * Does not mutate the original reservations row.
 */
export async function startReservationEditDraft(input: {
  userId: string;
  reservationId: string;
  locale: Locale;
}): Promise<StartReservationEditResult> {
  const reservationId = input.reservationId.trim();
  if (!reservationId) {
    return { ok: false, reason: "not_found" };
  }

  const row = await loadOwnedReservation({
    userId: input.userId,
    reservationId,
  });
  if (!row) {
    return { ok: false, reason: "not_found" };
  }

  const gate = evaluateCustomerEdit({
    status: row.status,
    pickupAt: row.pickup_at,
  });
  if (!gate.allowed) {
    return {
      ok: false,
      reason:
        gate.reason === "within_six_hours" ? "within_six_hours" : "cancelled",
    };
  }

  return createEditDraftFromReservation({
    row,
    locale: input.locale,
    opsUserId: null,
  });
}

/**
 * Ops-started edit draft: reuses the customer booking funnel without impersonating
 * the customer account. Skips the customer 6h self-service gate.
 */
export async function startOpsReservationEditDraft(input: {
  opsUserId: string;
  reservationId: string;
  locale: Locale;
}): Promise<StartReservationEditResult> {
  const reservationId = input.reservationId.trim();
  if (!reservationId || !input.opsUserId.trim()) {
    return { ok: false, reason: "not_found" };
  }

  const row = await loadReservationForOpsEdit(reservationId);
  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if ((row.status ?? "").trim().toLowerCase() === "cancelled") {
    return { ok: false, reason: "cancelled" };
  }

  return createEditDraftFromReservation({
    row,
    locale: input.locale,
    opsUserId: input.opsUserId.trim(),
  });
}

/** Soft-close the active edit draft for this browser session; original reservation untouched. */
export async function abandonReservationEditDraft(): Promise<{
  ok: true;
  opsEdit: boolean;
  reservationId: string | null;
}> {
  const jar = await cookies();
  const sessionId = jar.get(BROWSER_SESSION_COOKIE)?.value;
  if (!isBrowserSessionId(sessionId)) {
    return { ok: true, opsEdit: false, reservationId: null };
  }
  const draft = await findActiveDraft(sessionId);
  const opsEdit = Boolean(draft?.editingOriginal?.opsUserId);
  const reservationId = draft?.editingOriginal?.reservationId ?? null;
  await softCloseActiveDrafts({
    browserSessionId: sessionId,
    editingOnly: true,
  });
  return { ok: true, opsEdit, reservationId };
}

/**
 * Soft-close every active draft for this browser session so a logged-in customer
 * can start a brand-new booking without reusing an edit/checkout draft.
 */
export async function prepareFreshBookingSession(): Promise<{ ok: true }> {
  const browserSessionId = await resolveOrCreateBrowserSessionId();
  await softCloseActiveDrafts({ browserSessionId });
  return { ok: true };
}

export async function getActiveEditDraftSummary(locale: Locale) {
  const jar = await cookies();
  const sessionId = jar.get(BROWSER_SESSION_COOKIE)?.value;
  if (!isBrowserSessionId(sessionId)) {
    return null;
  }
  const draft = await findActiveDraft(sessionId);
  if (!draft?.editingOriginal) {
    return null;
  }
  return {
    reservationCode: draft.editingOriginal.reservationCode,
    locale,
    priceDifference: editPriceDifferenceFromDraft(draft),
  };
}
