import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import {
  createdAtBounds,
  uniqueUuids,
  type ProcessListFilters,
} from "@/lib/ops/process-filters";
import { selectedStoredAmount } from "@/lib/ops/money";
import { parseManualPriceTotals } from "@/lib/ops/price-override";
import { type ProcessListItem } from "@/lib/ops/process-types";
import {
  assertNoReservationChildOrphans,
  cleanupProcessChildrenBeforeSearchDelete,
} from "@/lib/ops/reservation-lifecycle-delete";

export type { ProcessListItem } from "@/lib/ops/process-types";

const PAGE_SIZE = 25;

export type ProcessDetail = ProcessListItem & {
  serviceType: string | null;
  pickupAirportCode: string | null;
  pickupLocationType: string | null;
  pickupPlaceId: string | null;
  selectedPickup: string | null;
  appliedPickup: string | null;
  selectedPickupAddress: string | null;
  appliedPickupAddress: string | null;
  selectedDropoff: string | null;
  appliedDropoff: string | null;
  selectedDropoffAddress: string | null;
  appliedDropoffAddress: string | null;
  selectedPickupAt: string | null;
  appliedPickupAt: string | null;
  selectedPassengerCount: number | null;
  appliedPassengerCount: number | null;
  selectedLuggageCount: number | null;
  appliedLuggageCount: number | null;
  selectedBabySeatCount: number | null;
  appliedBabySeatCount: number | null;
  selectedFlightCode: string | null;
  appliedFlightCode: string | null;
  selectedMeetAndGreet: boolean | null;
  appliedMeetAndGreet: boolean | null;
  selectedDistanceKm: string | null;
  appliedDistanceKm: string | null;
  selectedDurationHours: string | null;
  appliedDurationHours: string | null;
  selectedBursaRoute: string | null;
  appliedBursaRoute: string | null;
  selectedVehicleCode: string | null;
  appliedVehicleCode: string | null;
  selectedVehicleLabel: string | null;
  appliedVehicleLabel: string | null;
  selectedPrice: string | null;
  appliedVehicleTotal: string | null;
  appliedVehicleTotalEur: string | null;
  appliedPrice: string | null;
  transferQuote: unknown;
  fxSnapshot: unknown;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerCountryCode: string | null;
  notes: string | null;
  deviceType: string | null;
  osName: string | null;
  osVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  screenWidth: number | null;
  screenHeight: number | null;
  browserLanguage: string | null;
  clientTimezone: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  priceManuallyOverridden: boolean;
  manualPriceTotals: unknown;
  passengers: ProcessPassenger[];
};

export type ProcessPassenger = {
  sequenceNo: number;
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  identityNumber: string | null;
  gender: string | null;
  isPrimary: boolean;
};

type ListRow = {
  id: string;
  created_at: Date;
  updated_at: Date;
  status: string | null;
  current_stage: string | null;
  locale: string | null;
  service_type: string | null;
  tour_code: string | null;
  applied_duration_hours: string | null;
  selected_duration_hours: string | null;
  applied_pickup_name_customer: string | null;
  applied_pickup_name_tr: string | null;
  selected_pickup_name_customer: string | null;
  applied_dropoff_name_customer: string | null;
  applied_dropoff_name_tr: string | null;
  selected_dropoff_name_customer: string | null;
  applied_pickup_at: Date | null;
  selected_pickup_at: Date | null;
  applied_passenger_count: number | null;
  selected_passenger_count: number | null;
  applied_vehicle_label_customer: string | null;
  applied_vehicle_label_tr: string | null;
  applied_vehicle_total: string | null;
  applied_price: string | null;
  applied_fx_snapshot: unknown;
  price_manually_overridden: boolean;
  manual_price_totals: unknown;
  currency: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  reservation_code: string | null;
  reservation_id: string | null;
};

type CountRow = { count: string };

function place(applied: string | null, appliedTr: string | null, selected: string | null) {
  return applied?.trim() || appliedTr?.trim() || selected?.trim() || null;
}

function mapList(row: ListRow): ProcessListItem {
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    status: row.status,
    currentStage: row.current_stage,
    locale: row.locale,
    serviceType: row.service_type,
    tourCode: row.tour_code,
    durationHours: row.applied_duration_hours ?? row.selected_duration_hours,
    pickupName: place(
      row.applied_pickup_name_customer,
      row.applied_pickup_name_tr,
      row.selected_pickup_name_customer,
    ),
    dropoffName: place(
      row.applied_dropoff_name_customer,
      row.applied_dropoff_name_tr,
      row.selected_dropoff_name_customer,
    ),
    pickupAt: (row.applied_pickup_at ?? row.selected_pickup_at)?.toISOString() ?? null,
    passengerCount: row.applied_passenger_count ?? row.selected_passenger_count,
    vehicleLabel:
      row.applied_vehicle_label_customer?.trim() ||
      row.applied_vehicle_label_tr?.trim() ||
      null,
    price: selectedStoredAmount({
      currency: row.currency,
      appliedVehicleTotal: row.applied_vehicle_total,
      fxSnapshot: row.applied_fx_snapshot,
      priceManuallyOverridden: row.price_manually_overridden,
      manualPriceTotals: parseManualPriceTotals(row.manual_price_totals),
    }).amount,
    currency: row.currency,
    email: row.customer_email,
    phone: row.customer_phone,
    paymentMethod: row.payment_method,
    converted: Boolean(row.reservation_id),
    reservationCode: row.reservation_code,
    reservationId: row.reservation_id,
  };
}

function processWhere(filters: ProcessListFilters) {
  const clauses: string[] = ["TRUE"];
  const values: unknown[] = [];
  const q = filters.query.trim();
  if (q) {
    values.push(`%${q}%`);
    const i = values.length;
    clauses.push(
      `(s.customer_email ILIKE $${i}
        OR s.customer_phone ILIKE $${i}
        OR s.applied_pickup_name_customer ILIKE $${i}
        OR s.selected_pickup_name_customer ILIKE $${i}
        OR s.applied_dropoff_name_customer ILIKE $${i}
        OR s.selected_dropoff_name_customer ILIKE $${i})`,
    );
  }
  if (filters.status) {
    values.push(filters.status);
    clauses.push(`s.status = $${values.length}`);
  }
  if (filters.locale) {
    values.push(filters.locale);
    clauses.push(`s.locale = $${values.length}`);
  }
  if (filters.conversion === "converted") {
    clauses.push("r.id IS NOT NULL");
  } else if (filters.conversion === "open") {
    clauses.push("r.id IS NULL");
  }
  const bounds = createdAtBounds(filters.date, filters.from, filters.to);
  if (bounds?.kind === "before") {
    values.push(bounds.end);
    clauses.push(`s.created_at < $${values.length}`);
  } else if (bounds?.kind === "range") {
    values.push(bounds.start, bounds.end);
    clauses.push(
      `s.created_at >= $${values.length - 1} AND s.created_at < $${values.length}`,
    );
  }
  return { where: clauses.join(" AND "), values };
}

export async function listProcesses(
  filters: ProcessListFilters & { page: number; pageSize?: number },
) {
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const { where, values } = processWhere(filters);
  const count = await query<CountRow>(
    `SELECT COUNT(*)::text AS count
     FROM reservation_searches s
     LEFT JOIN reservations r ON r.source_reservation_search_id = s.id
     WHERE ${where}`,
    values,
  );
  const total = Number(count.rows[0]?.count ?? 0);
  const offset = (filters.page - 1) * pageSize;
  const result = await query<ListRow>(
    `SELECT
        s.id, s.created_at, s.updated_at, s.status, s.current_stage, s.locale,
        s.service_type, s.tour_code,
        s.applied_duration_hours::text, s.selected_duration_hours::text,
        s.applied_pickup_name_customer, s.applied_pickup_name_tr, s.selected_pickup_name_customer,
        s.applied_dropoff_name_customer, s.applied_dropoff_name_tr, s.selected_dropoff_name_customer,
        s.applied_pickup_at, s.selected_pickup_at,
        s.applied_passenger_count, s.selected_passenger_count,
        s.applied_vehicle_label_customer, s.applied_vehicle_label_tr,
        s.applied_vehicle_total::text, s.applied_price::text, s.applied_fx_snapshot,
        s.price_manually_overridden, s.manual_price_totals, s.currency,
        s.customer_email, s.customer_phone, s.payment_method,
        r.reservation_code, r.id AS reservation_id
     FROM reservation_searches s
     LEFT JOIN reservations r ON r.source_reservation_search_id = s.id
     WHERE ${where}
     ORDER BY s.updated_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset],
  );
  return { items: result.rows.map(mapList), total, pageSize };
}

export type ProcessDeleteTarget = {
  mode: "ids" | "filtered";
  ids: string[];
  filters: ProcessListFilters;
};

export type ProcessDeletePreview = {
  selected: number;
  deletable: number;
  protectedCount: number;
};

type SelectedCountRow = {
  selected: string;
};

async function processDeleteCounts(target: ProcessDeleteTarget): Promise<ProcessDeletePreview> {
  if (target.mode === "ids") {
    const ids = uniqueUuids(target.ids);
    if (ids.length === 0) {
      return { selected: 0, deletable: 0, protectedCount: 0 };
    }
    const result = await query<SelectedCountRow>(
      `SELECT COUNT(*)::text AS selected
       FROM reservation_searches s
       WHERE s.id = ANY($1::uuid[])`,
      [ids],
    );
    const selected = Number(result.rows[0]?.selected ?? 0);
    return { selected, deletable: selected, protectedCount: 0 };
  }
  const { where, values } = processWhere(target.filters);
  const result = await query<SelectedCountRow>(
    `SELECT COUNT(*)::text AS selected
     FROM reservation_searches s
     WHERE ${where}`,
    values,
  );
  const selected = Number(result.rows[0]?.selected ?? 0);
  return { selected, deletable: selected, protectedCount: 0 };
}

export async function previewProcessDelete(target: ProcessDeleteTarget) {
  return processDeleteCounts(target);
}

/**
 * Permanently deletes reservation_searches process rows.
 *
 * Child cleanup (shared lifecycle helper, explicit, not blind CASCADE):
 * 1. reservation_searches_passengers
 * 2. reservation_edit_settlements (edit_draft_id ON DELETE RESTRICT)
 * 3. reservation_searches (payments.edit_draft_id SET NULL;
 *    reservations.source_reservation_search_id SET NULL — real reservations kept)
 *
 * Payment / refund ledger rows stay on reservations.
 */
export async function deleteProcesses(target: ProcessDeleteTarget) {
  const preview = await processDeleteCounts(target);
  if (preview.deletable === 0) {
    return { ...preview, deleted: 0 };
  }

  let ids: string[];
  if (target.mode === "ids") {
    ids = uniqueUuids(target.ids);
  } else {
    const { where, values } = processWhere(target.filters);
    const matched = await query<{ id: string }>(
      `SELECT s.id
       FROM reservation_searches s
       WHERE ${where}`,
      values,
    );
    ids = matched.rows.map((row) => row.id);
  }

  if (ids.length === 0) {
    return { ...preview, deleted: 0 };
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    await cleanupProcessChildrenBeforeSearchDelete(client, ids);

    const deleted = await client.query<{ id: string }>(
      `DELETE FROM reservation_searches
       WHERE id = ANY($1::uuid[])
       RETURNING id`,
      [ids],
    );

    await assertNoReservationChildOrphans(client, { searchIds: ids });

    await client.query("COMMIT");
    return {
      ...preview,
      deleted: deleted.rowCount ?? deleted.rows.length,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[ops] deleteProcesses failed", {
      count: ids.length,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
    throw error;
  } finally {
    client.release();
  }
}

type DetailRow = ListRow & {
  service_type: string | null;
  selected_pickup_name_tr: string | null;
  selected_dropoff_name_tr: string | null;
  selected_pickup_address_customer: string | null;
  selected_pickup_address_tr: string | null;
  applied_pickup_address_customer: string | null;
  applied_pickup_address_tr: string | null;
  selected_dropoff_address_customer: string | null;
  selected_dropoff_address_tr: string | null;
  applied_dropoff_address_customer: string | null;
  applied_dropoff_address_tr: string | null;
  selected_luggage_count: number | null;
  applied_luggage_count: number | null;
  selected_baby_seat_count: number | null;
  applied_baby_seat_count: number | null;
  selected_flight_code: string | null;
  applied_flight_code: string | null;
  selected_meet_and_greet: boolean | null;
  applied_meet_and_greet: boolean | null;
  selected_distance_km: string | null;
  applied_distance_km: string | null;
  selected_duration_hours: string | null;
  applied_duration_hours: string | null;
  selected_bursa_route: string | null;
  applied_bursa_route: string | null;
  applied_pickup_airport_code: string | null;
  applied_pickup_location_type: string | null;
  applied_pickup_place_id: string | null;
  selected_pickup_airport_code: string | null;
  selected_pickup_location_type: string | null;
  selected_pickup_place_id: string | null;
  selected_vehicle_code: string | null;
  applied_vehicle_code: string | null;
  selected_vehicle_label_customer: string | null;
  selected_vehicle_label_tr: string | null;
  selected_price: string | null;
  applied_vehicle_total_eur: string | null;
  applied_transfer_quote: unknown;
  applied_fx_snapshot: unknown;
  price_manually_overridden: boolean;
  manual_price_totals: unknown;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_country_code: string | null;
  notes: string | null;
  device_type: string | null;
  os_name: string | null;
  os_version: string | null;
  browser_name: string | null;
  browser_version: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
  screen_width: number | null;
  screen_height: number | null;
  browser_language: string | null;
  client_timezone: string | null;
  expires_at: Date | null;
  completed_at: Date | null;
};

export async function getProcess(id: string): Promise<ProcessDetail | null> {
  const result = await query<DetailRow>(
    `SELECT
        s.id, s.created_at, s.updated_at, s.status, s.current_stage, s.locale, s.service_type,
        s.tour_code,
        s.applied_pickup_name_customer, s.applied_pickup_name_tr, s.selected_pickup_name_customer,
        s.selected_pickup_name_tr,
        s.applied_dropoff_name_customer, s.applied_dropoff_name_tr, s.selected_dropoff_name_customer,
        s.selected_dropoff_name_tr,
        s.applied_pickup_at, s.selected_pickup_at,
        s.applied_passenger_count, s.selected_passenger_count,
        s.applied_vehicle_label_customer, s.applied_vehicle_label_tr,
        s.applied_vehicle_total::text, s.applied_price::text, s.currency,
        s.customer_email, s.customer_phone, s.payment_method,
        r.reservation_code, r.id AS reservation_id,
        s.selected_pickup_address_customer, s.selected_pickup_address_tr,
        s.applied_pickup_address_customer, s.applied_pickup_address_tr,
        s.selected_dropoff_address_customer, s.selected_dropoff_address_tr,
        s.applied_dropoff_address_customer, s.applied_dropoff_address_tr,
        s.selected_luggage_count, s.applied_luggage_count,
        s.selected_baby_seat_count, s.applied_baby_seat_count,
        s.selected_flight_code, s.applied_flight_code,
        s.selected_meet_and_greet, s.applied_meet_and_greet,
        s.selected_distance_km::text, s.applied_distance_km::text,
        s.selected_duration_hours::text, s.applied_duration_hours::text,
        s.selected_bursa_route, s.applied_bursa_route,
        s.applied_pickup_airport_code, s.applied_pickup_location_type, s.applied_pickup_place_id,
        s.selected_pickup_airport_code, s.selected_pickup_location_type, s.selected_pickup_place_id,
        s.selected_vehicle_code, s.applied_vehicle_code,
        s.selected_vehicle_label_customer, s.selected_vehicle_label_tr,
        s.selected_price::text, s.applied_vehicle_total_eur::text,
        s.applied_transfer_quote, s.applied_fx_snapshot,
        s.price_manually_overridden, s.manual_price_totals,
        s.customer_first_name, s.customer_last_name, s.customer_country_code, s.notes,
        s.device_type, s.os_name, s.os_version, s.browser_name, s.browser_version,
        s.viewport_width, s.viewport_height, s.screen_width, s.screen_height,
        s.browser_language, s.client_timezone, s.expires_at, s.completed_at
     FROM reservation_searches s
     LEFT JOIN reservations r ON r.source_reservation_search_id = s.id
     WHERE s.id = $1
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const passengers = await query<{
    sequence_no: number;
    first_name: string | null;
    last_name: string | null;
    country_code: string | null;
    identity_number: string | null;
    gender: string | null;
    is_primary_passenger: boolean;
  }>(
    `SELECT sequence_no, first_name, last_name, country_code, identity_number, gender, is_primary_passenger
     FROM reservation_searches_passengers
     WHERE reservation_search_id = $1
     ORDER BY sequence_no ASC`,
    [id],
  );
  const list = mapList(row);
  return {
    ...list,
    serviceType: row.service_type,
    pickupAirportCode:
      row.applied_pickup_airport_code ?? row.selected_pickup_airport_code,
    pickupLocationType:
      row.applied_pickup_location_type ?? row.selected_pickup_location_type,
    pickupPlaceId: row.applied_pickup_place_id ?? row.selected_pickup_place_id,
    selectedPickup: place(
      row.selected_pickup_name_customer,
      row.selected_pickup_name_tr,
      null,
    ),
    appliedPickup: place(
      row.applied_pickup_name_customer,
      row.applied_pickup_name_tr,
      null,
    ),
    selectedPickupAddress:
      row.selected_pickup_address_customer ?? row.selected_pickup_address_tr,
    appliedPickupAddress:
      row.applied_pickup_address_customer ?? row.applied_pickup_address_tr,
    selectedDropoff: place(
      row.selected_dropoff_name_customer,
      row.selected_dropoff_name_tr,
      null,
    ),
    appliedDropoff: place(
      row.applied_dropoff_name_customer,
      row.applied_dropoff_name_tr,
      null,
    ),
    selectedDropoffAddress:
      row.selected_dropoff_address_customer ?? row.selected_dropoff_address_tr,
    appliedDropoffAddress:
      row.applied_dropoff_address_customer ?? row.applied_dropoff_address_tr,
    selectedPickupAt: row.selected_pickup_at?.toISOString() ?? null,
    appliedPickupAt: row.applied_pickup_at?.toISOString() ?? null,
    selectedPassengerCount: row.selected_passenger_count,
    appliedPassengerCount: row.applied_passenger_count,
    selectedLuggageCount: row.selected_luggage_count,
    appliedLuggageCount: row.applied_luggage_count,
    selectedBabySeatCount: row.selected_baby_seat_count,
    appliedBabySeatCount: row.applied_baby_seat_count,
    selectedFlightCode: row.selected_flight_code,
    appliedFlightCode: row.applied_flight_code,
    selectedMeetAndGreet: row.selected_meet_and_greet,
    appliedMeetAndGreet: row.applied_meet_and_greet,
    selectedDistanceKm: row.selected_distance_km,
    appliedDistanceKm: row.applied_distance_km,
    selectedDurationHours: row.selected_duration_hours,
    appliedDurationHours: row.applied_duration_hours,
    selectedBursaRoute: row.selected_bursa_route,
    appliedBursaRoute: row.applied_bursa_route,
    selectedVehicleCode: row.selected_vehicle_code,
    appliedVehicleCode: row.applied_vehicle_code,
    selectedVehicleLabel:
      row.selected_vehicle_label_customer?.trim() ||
      row.selected_vehicle_label_tr?.trim() ||
      null,
    appliedVehicleLabel: list.vehicleLabel,
    selectedPrice: row.selected_price,
    appliedVehicleTotal: row.applied_vehicle_total,
    appliedVehicleTotalEur: row.applied_vehicle_total_eur,
    appliedPrice: row.applied_price,
    transferQuote: row.applied_transfer_quote,
    fxSnapshot: row.applied_fx_snapshot,
    priceManuallyOverridden: row.price_manually_overridden,
    manualPriceTotals: row.manual_price_totals,
    customerFirstName: row.customer_first_name,
    customerLastName: row.customer_last_name,
    customerCountryCode: row.customer_country_code,
    notes: row.notes,
    deviceType: row.device_type,
    osName: row.os_name,
    osVersion: row.os_version,
    browserName: row.browser_name,
    browserVersion: row.browser_version,
    viewportWidth: row.viewport_width,
    viewportHeight: row.viewport_height,
    screenWidth: row.screen_width,
    screenHeight: row.screen_height,
    browserLanguage: row.browser_language,
    clientTimezone: row.client_timezone,
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    passengers: passengers.rows.map((item) => ({
      sequenceNo: item.sequence_no,
      firstName: item.first_name,
      lastName: item.last_name,
      countryCode: item.country_code,
      identityNumber: item.identity_number,
      gender: item.gender,
      isPrimary: item.is_primary_passenger,
    })),
  };
}
