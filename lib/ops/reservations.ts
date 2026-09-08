import "server-only";

import { query } from "@/lib/db/postgres";
import { pickupAtBounds, reservationOrderBy, type ReservationListFilters } from "@/lib/ops/reservation-filters";
import { selectedStoredAmount } from "@/lib/ops/money";
import { parseManualPriceTotals } from "@/lib/ops/price-override";
import { type ReservationListItem } from "@/lib/ops/reservation-types";
import {
  resolveDriverAssignment,
  resolveVehicleAssignment,
  type JobDriverAssignmentView,
  type JobVehicleAssignmentView,
} from "@/lib/partner/job-assignment-view";
import { partnerDriverFullName, type PartnerDriverRecord, type PartnerVehicleRecord } from "@/lib/partner/fleet-view";

const PAGE_SIZE = 25;

export { PAGE_SIZE as OPS_PAGE_SIZE };
export type { ReservationListItem } from "@/lib/ops/reservation-types";

export type ReservationDetail = ReservationListItem & {
  locale: string | null;
  updatedAt: string | null;
  serviceType: string | null;
  tourCode: string | null;
  pickupAirportCode: string | null;
  pickupLocationType: string | null;
  pickupPlaceId: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  distanceKm: string | null;
  flightCode: string | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  durationHours: string | null;
  bursaRoute: string | null;
  vehicleCode: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCountryCode: string | null;
  fxSnapshot: unknown;
  priceManuallyOverridden: boolean;
  manualPriceTotals: unknown;
  systemTotalPrice: string | null;
  systemCurrency: string | null;
  systemFxSnapshot: unknown;
  sourceReservationSearchId: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  paymentAmount: string | null;
  paymentCurrency: string | null;
  paymentProviderOrderId: string | null;
  refundStatus: string | null;
  refundAmount: string | null;
  refundCurrency: string | null;
  refundAdminOverride: boolean;
  refundRequestedAt: string | null;
  refundCompletedAt: string | null;
  refundProviderRefundId: string | null;
  financeGross: string | null;
  financeNet: string | null;
  financeCompletedRefunds: string | null;
  financePendingRefunds: string | null;
  paymentHistoryLines: string[] | null;
  paymentHistory: import("@/lib/ops/payment-history").OpsPaymentHistorySection | null;
  passengers: ReservationPassenger[];
};

export type ReservationPassenger = {
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
  reservation_code: string;
  pickup_at: Date | null;
  service_type: string | null;
  tour_code: string | null;
  duration_hours: string | null;
  pickup_name_customer: string | null;
  pickup_name_tr: string | null;
  dropoff_name_customer: string | null;
  dropoff_name_tr: string | null;
  flight_code: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  passenger_count: number | null;
  vehicle_label_customer: string | null;
  vehicle_label_tr: string | null;
  total_price: string | null;
  currency: string | null;
  payment_method: string | null;
  payment_provider: string | null;
  payment_status: string | null;
  refund_status: string | null;
  meet_and_greet: boolean | null;
  price_manually_overridden: boolean;
  manual_price_totals: unknown;
  status: string;
  created_at: Date;
  accepted_partner_id: string | null;
  accepted_partner_name: string | null;
  accepted_partner_code: string | null;
  accepted_partner_is_primary: boolean | null;
  accepted_partner_priority_level: number | null;
  assigned_driver_kind: string | null;
  assigned_driver_id: string | null;
  assigned_driver_snapshot: unknown;
  assigned_driver_first_name: string | null;
  assigned_driver_last_name: string | null;
  assigned_driver_phone: string | null;
  assigned_driver_phone_country: string | null;
  assigned_driver_languages: string[] | null;
  assigned_driver_national_id: string | null;
  assigned_vehicle_kind: string | null;
  assigned_vehicle_id: string | null;
  assigned_vehicle_snapshot: unknown;
  assigned_vehicle_plate: string | null;
  assigned_vehicle_brand: string | null;
  assigned_vehicle_model: string | null;
  assigned_vehicle_year: number | null;
  assigned_vehicle_class: string | null;
  assigned_vehicle_passengers: number | null;
  assigned_vehicle_luggage: number | null;
  assigned_vehicle_color: string | null;
  assigned_vehicle_features: string | null;
};

type DetailRow = ListRow & {
  locale: string | null;
  updated_at: Date;
  service_type: string | null;
  pickup_address_customer: string | null;
  pickup_address_tr: string | null;
  dropoff_address_customer: string | null;
  dropoff_address_tr: string | null;
  distance_km: string | null;
  flight_code: string | null;
  luggage_count: number | null;
  baby_seat_count: number | null;
  duration_hours: string | null;
  bursa_route: string | null;
  service_content_snapshot: unknown;
  vehicle_code: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_country_code: string | null;
  fx_snapshot: unknown;
  price_manually_overridden: boolean;
  manual_price_totals: unknown;
  system_total_price: string | null;
  system_currency: string | null;
  system_fx_snapshot: unknown;
  source_reservation_search_id: string | null;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  notes: string | null;
  pickup_location_type: string | null;
  pickup_airport_code: string | null;
  pickup_place_id: string | null;
  payment_amount: string | null;
  payment_currency: string | null;
  payment_provider_order_id: string | null;
  refund_status: string | null;
  refund_amount: string | null;
  refund_currency: string | null;
  refund_admin_override: boolean;
  refund_requested_at: Date | null;
  refund_completed_at: Date | null;
  refund_provider_refund_id: string | null;
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

type CountRow = { count: string };

function displayName(customer: string | null, tr: string | null) {
  return customer?.trim() || tr?.trim() || null;
}

function personName(first: string | null, last: string | null) {
  return [first, last].filter(Boolean).join(" ").trim();
}

function liveDriverFromRow(row: ListRow): PartnerDriverRecord | null {
  if (!row.assigned_driver_id || !row.assigned_driver_first_name) {
    return null;
  }
  return {
    id: row.assigned_driver_id,
    partnerId: row.accepted_partner_id ?? "",
    firstName: row.assigned_driver_first_name,
    lastName: row.assigned_driver_last_name ?? "",
    fullName: partnerDriverFullName(
      row.assigned_driver_first_name,
      row.assigned_driver_last_name ?? "",
    ),
    nationalId: row.assigned_driver_national_id,
    phone: row.assigned_driver_phone,
    phoneCountryCode: row.assigned_driver_phone_country,
    languageCodes: row.assigned_driver_languages ?? [],
    status: "active",
    deletedAt: null,
    updatedAt: row.created_at.toISOString(),
  };
}

function liveVehicleFromRow(row: ListRow): PartnerVehicleRecord | null {
  if (!row.assigned_vehicle_id || !row.assigned_vehicle_plate) {
    return null;
  }
  return {
    id: row.assigned_vehicle_id,
    partnerId: row.accepted_partner_id ?? "",
    plate: row.assigned_vehicle_plate,
    brandCode: null,
    modelCode: null,
    brand: row.assigned_vehicle_brand,
    model: row.assigned_vehicle_model,
    modelYear: row.assigned_vehicle_year,
    colorCode: null,
    colorOther: null,
    color: row.assigned_vehicle_color,
    passengerCapacity: row.assigned_vehicle_passengers,
    luggageCapacity: row.assigned_vehicle_luggage,
    vehicleClassCode: row.assigned_vehicle_class,
    featureCodes: [],
    featureOther: null,
    features: row.assigned_vehicle_features,
    status: "active",
    approvedAt: null,
    deletedAt: null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.created_at.toISOString(),
  };
}

function mapAssignment(row: ListRow): {
  acceptedPartnerName: string | null;
  acceptedPartnerCode: string | null;
  acceptedPartnerIsPrimary: boolean;
  acceptedPartnerPriorityLevel: number | null;
  driverAssignment: JobDriverAssignmentView;
  vehicleAssignment: JobVehicleAssignmentView;
} {
  return {
    acceptedPartnerName: row.accepted_partner_name?.trim() || null,
    acceptedPartnerCode: row.accepted_partner_code?.trim() || null,
    acceptedPartnerIsPrimary: Boolean(row.accepted_partner_is_primary),
    acceptedPartnerPriorityLevel: row.accepted_partner_priority_level,
    driverAssignment: resolveDriverAssignment({
      kind: row.assigned_driver_kind,
      driverId: row.assigned_driver_id,
      snapshot: row.assigned_driver_snapshot,
      live: liveDriverFromRow(row),
    }),
    vehicleAssignment: resolveVehicleAssignment({
      kind: row.assigned_vehicle_kind,
      vehicleId: row.assigned_vehicle_id,
      snapshot: row.assigned_vehicle_snapshot,
      live: liveVehicleFromRow(row),
    }),
  };
}

function mapList(row: ListRow): ReservationListItem {
  const assignment = mapAssignment(row);
  return {
    id: row.id,
    reservationCode: row.reservation_code,
    pickupAt: row.pickup_at ? row.pickup_at.toISOString() : null,
    serviceType: row.service_type,
    tourCode: row.tour_code,
    durationHours: row.duration_hours,
    pickupName: displayName(row.pickup_name_customer, row.pickup_name_tr),
    dropoffName: displayName(row.dropoff_name_customer, row.dropoff_name_tr),
    flightCode: row.flight_code?.trim() || null,
    customerName: personName(row.customer_first_name, row.customer_last_name),
    customerEmail: row.customer_email?.trim() || null,
    customerPhone: row.customer_phone?.trim() || null,
    passengerCount: row.passenger_count,
    vehicleLabel: displayName(row.vehicle_label_customer, row.vehicle_label_tr),
    totalPrice: selectedStoredAmount({
      currency: row.currency,
      totalPrice: row.total_price,
      priceManuallyOverridden: row.price_manually_overridden,
      manualPriceTotals: parseManualPriceTotals(row.manual_price_totals),
    }).amount,
    currency: row.currency,
    paymentMethod: row.payment_method,
    paymentProvider: row.payment_provider,
    paymentStatus: row.payment_status,
    refundStatus: row.refund_status,
    paymentMovements: [],
    meetAndGreet: row.meet_and_greet,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    acceptedPartnerName: assignment.acceptedPartnerName,
    acceptedPartnerCode: assignment.acceptedPartnerCode,
    acceptedPartnerIsPrimary: assignment.acceptedPartnerIsPrimary,
    acceptedPartnerPriorityLevel: assignment.acceptedPartnerPriorityLevel,
    driverAssignment: assignment.driverAssignment,
    vehicleAssignment: assignment.vehicleAssignment,
  };
}

export async function listReservations(input: {
  filters: ReservationListFilters;
  page: number;
  pageSize?: number;
}) {
  const pageSize = input.pageSize ?? PAGE_SIZE;
  const filters: string[] = ["deleted_at IS NULL"];
  const values: unknown[] = [];
  const q = input.filters.query.trim();
  if (q) {
    values.push(`%${q}%`);
    const i = values.length;
    filters.push(
      `(reservation_code ILIKE $${i}
        OR customer_first_name ILIKE $${i}
        OR customer_last_name ILIKE $${i}
        OR customer_email ILIKE $${i}
        OR customer_phone ILIKE $${i}
        OR pickup_name_customer ILIKE $${i}
        OR pickup_name_tr ILIKE $${i}
        OR dropoff_name_customer ILIKE $${i}
        OR dropoff_name_tr ILIKE $${i})`,
    );
  }
  if (input.filters.status) {
    values.push(input.filters.status);
    filters.push(`status = $${values.length}`);
  }
  if (input.filters.payment) {
    values.push(input.filters.payment);
    filters.push(`payment_method = $${values.length}`);
  }
  const pickupBounds = pickupAtBounds(
    input.filters.date,
    input.filters.from,
    input.filters.to,
  );
  if (pickupBounds) {
    if (pickupBounds.kind === "range") {
      values.push(pickupBounds.start, pickupBounds.end);
      filters.push(
        `pickup_at >= $${values.length - 1} AND pickup_at < $${values.length}`,
      );
    } else if (pickupBounds.kind === "after") {
      values.push(pickupBounds.start);
      filters.push(`pickup_at >= $${values.length}`);
    } else if (pickupBounds.kind === "before") {
      values.push(pickupBounds.end);
      filters.push(`pickup_at < $${values.length}`);
    }
  }
  const where = filters.join(" AND ");
  const count = await query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM reservations WHERE ${where}`,
    values,
  );
  const total = Number(count.rows[0]?.count ?? 0);
  const offset = (input.page - 1) * pageSize;
  values.push(pageSize, offset);
  const orderBy = reservationOrderBy(input.filters);
  const result = await query<ListRow>(
    `SELECT
        jobs.id, jobs.reservation_code, jobs.pickup_at, jobs.service_type, jobs.tour_code,
        jobs.duration_hours,
        jobs.pickup_name_customer, jobs.pickup_name_tr,
        jobs.dropoff_name_customer, jobs.dropoff_name_tr,
        jobs.flight_code,
        jobs.customer_first_name, jobs.customer_last_name,
        jobs.customer_email, jobs.customer_phone,
        jobs.passenger_count, jobs.vehicle_label_customer, jobs.vehicle_label_tr,
        jobs.total_price, jobs.currency, jobs.payment_method, jobs.payment_provider,
        jobs.payment_status, jobs.refund_status, jobs.meet_and_greet,
        jobs.price_manually_overridden, jobs.manual_price_totals,
        jobs.status, jobs.created_at,
        jobs.accepted_partner_id,
        jobs.assigned_driver_kind, jobs.assigned_driver_id, jobs.assigned_driver_snapshot,
        jobs.assigned_vehicle_kind, jobs.assigned_vehicle_id, jobs.assigned_vehicle_snapshot,
        accepted_partner.name AS accepted_partner_name,
        accepted_partner.partner_code AS accepted_partner_code,
        accepted_partner.is_primary_partner AS accepted_partner_is_primary,
        accepted_partner.priority_level AS accepted_partner_priority_level,
        assigned_driver.first_name AS assigned_driver_first_name,
        assigned_driver.last_name AS assigned_driver_last_name,
        assigned_driver.phone AS assigned_driver_phone,
        assigned_driver.phone_country_code AS assigned_driver_phone_country,
        assigned_driver.languages AS assigned_driver_languages,
        assigned_driver.national_id AS assigned_driver_national_id,
        assigned_vehicle.plate AS assigned_vehicle_plate,
        assigned_vehicle.brand AS assigned_vehicle_brand,
        assigned_vehicle.model AS assigned_vehicle_model,
        assigned_vehicle.model_year AS assigned_vehicle_year,
        assigned_vehicle.vehicle_class_code AS assigned_vehicle_class,
        assigned_vehicle.passenger_capacity AS assigned_vehicle_passengers,
        assigned_vehicle.luggage_capacity AS assigned_vehicle_luggage,
        assigned_vehicle.color AS assigned_vehicle_color,
        assigned_vehicle.features AS assigned_vehicle_features
     FROM (
        SELECT
          id, reservation_code, pickup_at, service_type, tour_code,
          duration_hours::text AS duration_hours,
          pickup_name_customer, pickup_name_tr,
          dropoff_name_customer, dropoff_name_tr,
          flight_code,
          customer_first_name, customer_last_name,
          customer_email, customer_phone,
          passenger_count, vehicle_label_customer, vehicle_label_tr,
          total_price::text AS total_price, currency, payment_method, payment_provider,
          payment_status, refund_status, meet_and_greet,
          price_manually_overridden, manual_price_totals,
          status, created_at,
          accepted_partner_id,
          assigned_driver_kind, assigned_driver_id, assigned_driver_snapshot,
          assigned_vehicle_kind, assigned_vehicle_id, assigned_vehicle_snapshot
        FROM reservations
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT $${values.length - 1} OFFSET $${values.length}
     ) AS jobs
     LEFT JOIN partners accepted_partner ON accepted_partner.id = jobs.accepted_partner_id
     LEFT JOIN partner_drivers assigned_driver ON assigned_driver.id = jobs.assigned_driver_id
     LEFT JOIN partner_vehicles assigned_vehicle ON assigned_vehicle.id = jobs.assigned_vehicle_id`,
    values,
  );
  const items = result.rows.map(mapList);
  const sbpIds = items
    .filter((item) => (item.paymentMethod ?? "").trim().toLowerCase() === "sbp")
    .map((item) => item.id);
  if (sbpIds.length > 0) {
    try {
      const { query: dbQuery } = await import("@/lib/db/postgres");
      const {
        paymentMovementDisplayStatus,
      } = await import("@/lib/ops/payment-history");
      const {
        REFUND_ALLOC_COMPLETED,
        refundableBalanceForPayment,
      } = await import("@/lib/payments/ledger/math");
      const txns = await dbQuery<{
        id: string;
        reservation_id: string;
        provider_order_id: string | null;
        amount: string;
        currency: string;
        status: string;
        sequence_no: number;
      }>(
        `SELECT id, reservation_id, provider_order_id, amount::text, currency, status, sequence_no
         FROM reservation_payment_transactions
         WHERE reservation_id = ANY($1::uuid[])
         ORDER BY reservation_id ASC, sequence_no ASC`,
        [sbpIds],
      );
      const refunds = await dbQuery<{
        payment_transaction_id: string;
        amount: string;
        currency: string;
        status: string;
      }>(
        `SELECT payment_transaction_id, amount::text, currency, status
         FROM reservation_refund_allocations
         WHERE reservation_id = ANY($1::uuid[])`,
        [sbpIds],
      );
      const refundsByPayment = new Map<
        string,
        Array<{ amount: number; currency: string; status: string }>
      >();
      for (const refund of refunds.rows) {
        const list = refundsByPayment.get(refund.payment_transaction_id) ?? [];
        list.push({
          amount: Number(refund.amount),
          currency: refund.currency,
          status: refund.status,
        });
        refundsByPayment.set(refund.payment_transaction_id, list);
      }
      const byReservation = new Map<
        string,
        import("@/lib/ops/payment-history").OpsPaymentMovementCompactLine[]
      >();
      for (const txn of txns.rows) {
        const related = refundsByPayment.get(txn.id) ?? [];
        const completed = related
          .filter((r) => r.status === REFUND_ALLOC_COMPLETED)
          .reduce((sum, r) => sum + r.amount, 0);
        const refundable = refundableBalanceForPayment(
          {
            amount: Number(txn.amount),
            status: txn.status as "pending" | "paid" | "cancelled" | "expired",
            currency: txn.currency,
          },
          related.map((r) => ({
            amount: r.amount,
            currency: r.currency,
            status: r.status as
              | "planned"
              | "submitted"
              | "completed"
              | "failed",
          })),
        );
        const line = {
          providerOrderId: txn.provider_order_id,
          amount: Number(txn.amount),
          currency: txn.currency,
          displayStatus: paymentMovementDisplayStatus(
            { amount: Number(txn.amount), status: txn.status as "pending" | "paid" | "cancelled" | "expired" },
            refundable,
            Number(completed.toFixed(2)),
          ),
        };
        const list = byReservation.get(txn.reservation_id) ?? [];
        list.push(line);
        byReservation.set(txn.reservation_id, list);
      }
      for (const item of items) {
        item.paymentMovements = byReservation.get(item.id) ?? [];
      }
    } catch {
      // Ledger may be unavailable before migration.
    }
  }
  return { items, total, pageSize };
}

export async function getReservation(id: string): Promise<ReservationDetail | null> {
  const result = await query<DetailRow>(
    `SELECT
        r.id, r.reservation_code, r.pickup_at,
        r.pickup_name_customer, r.pickup_name_tr, r.pickup_address_customer, r.pickup_address_tr,
        r.dropoff_name_customer, r.dropoff_name_tr, r.dropoff_address_customer, r.dropoff_address_tr,
        r.customer_first_name, r.customer_last_name, r.customer_email, r.customer_phone,
        r.customer_country_code, r.locale, r.service_type, r.tour_code, r.updated_at,
        r.passenger_count, r.luggage_count, r.baby_seat_count, r.duration_hours::text AS duration_hours,
        r.bursa_route, r.service_content_snapshot,
        r.vehicle_code, r.vehicle_label_customer, r.vehicle_label_tr,
        r.total_price::text AS total_price, r.currency, r.payment_method, r.payment_provider,
        r.payment_status, r.meet_and_greet,
        r.distance_km::text AS distance_km, r.flight_code, r.fx_snapshot,
        r.price_manually_overridden, r.manual_price_totals,
        r.system_total_price::text AS system_total_price, r.system_currency, r.system_fx_snapshot,
        r.source_reservation_search_id, r.status, r.notes,
        r.pickup_location_type, r.pickup_airport_code, r.pickup_place_id,
        r.payment_amount::text AS payment_amount, r.payment_currency, r.payment_provider_order_id,
        r.refund_status, r.refund_amount::text AS refund_amount, r.refund_currency,
        r.refund_admin_override,
        r.refund_requested_at, r.refund_completed_at, r.refund_provider_refund_id,
        r.created_at, r.confirmed_at, r.cancelled_at,
        r.accepted_partner_id,
        r.assigned_driver_kind, r.assigned_driver_id, r.assigned_driver_snapshot,
        r.assigned_vehicle_kind, r.assigned_vehicle_id, r.assigned_vehicle_snapshot,
        accepted_partner.name AS accepted_partner_name,
        accepted_partner.partner_code AS accepted_partner_code,
        accepted_partner.is_primary_partner AS accepted_partner_is_primary,
        accepted_partner.priority_level AS accepted_partner_priority_level,
        assigned_driver.first_name AS assigned_driver_first_name,
        assigned_driver.last_name AS assigned_driver_last_name,
        assigned_driver.phone AS assigned_driver_phone,
        assigned_driver.phone_country_code AS assigned_driver_phone_country,
        assigned_driver.languages AS assigned_driver_languages,
        assigned_driver.national_id AS assigned_driver_national_id,
        assigned_vehicle.plate AS assigned_vehicle_plate,
        assigned_vehicle.brand AS assigned_vehicle_brand,
        assigned_vehicle.model AS assigned_vehicle_model,
        assigned_vehicle.model_year AS assigned_vehicle_year,
        assigned_vehicle.vehicle_class_code AS assigned_vehicle_class,
        assigned_vehicle.passenger_capacity AS assigned_vehicle_passengers,
        assigned_vehicle.luggage_capacity AS assigned_vehicle_luggage,
        assigned_vehicle.color AS assigned_vehicle_color,
        assigned_vehicle.features AS assigned_vehicle_features
     FROM reservations r
     LEFT JOIN partners accepted_partner ON accepted_partner.id = r.accepted_partner_id
     LEFT JOIN partner_drivers assigned_driver ON assigned_driver.id = r.assigned_driver_id
     LEFT JOIN partner_vehicles assigned_vehicle ON assigned_vehicle.id = r.assigned_vehicle_id
     WHERE r.id = $1
       AND r.deleted_at IS NULL
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const passengers = await query<PassengerRow>(
    `SELECT sequence_no, first_name, last_name, country_code, identity_number, gender, is_primary_passenger
     FROM reservations_passengers
     WHERE reservation_id = $1
     ORDER BY sequence_no ASC`,
    [id],
  );
  const detail = {
    ...mapList(row),
    locale: row.locale,
    updatedAt: row.updated_at.toISOString(),
    serviceType: row.service_type,
    tourCode: row.tour_code,
    pickupAirportCode: row.pickup_airport_code,
    pickupLocationType: row.pickup_location_type,
    pickupPlaceId: row.pickup_place_id,
    pickupAddress: row.pickup_address_customer?.trim() || row.pickup_address_tr?.trim() || null,
    dropoffAddress: row.dropoff_address_customer?.trim() || row.dropoff_address_tr?.trim() || null,
    distanceKm: row.distance_km,
    flightCode: row.flight_code,
    luggageCount: row.luggage_count,
    babySeatCount: row.baby_seat_count,
    durationHours: row.duration_hours,
    bursaRoute: row.bursa_route,
    serviceContentSnapshot: row.service_content_snapshot,
    vehicleCode: row.vehicle_code,
    customerFirstName: row.customer_first_name,
    customerLastName: row.customer_last_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerCountryCode: row.customer_country_code,
    fxSnapshot: row.fx_snapshot,
    priceManuallyOverridden: row.price_manually_overridden,
    manualPriceTotals: row.manual_price_totals,
    systemTotalPrice: row.system_total_price,
    systemCurrency: row.system_currency,
    systemFxSnapshot: row.system_fx_snapshot,
    sourceReservationSearchId: row.source_reservation_search_id,
    confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
    cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
    notes: row.notes,
    paymentAmount: row.payment_amount,
    paymentCurrency: row.payment_currency,
    paymentProviderOrderId: row.payment_provider_order_id,
    refundStatus: row.refund_status,
    refundAmount: row.refund_amount,
    refundCurrency: row.refund_currency,
    refundAdminOverride: Boolean(row.refund_admin_override),
    refundRequestedAt: row.refund_requested_at
      ? row.refund_requested_at.toISOString()
      : null,
    refundCompletedAt: row.refund_completed_at
      ? row.refund_completed_at.toISOString()
      : null,
    refundProviderRefundId: row.refund_provider_refund_id,
    financeGross: null as string | null,
    financeNet: null as string | null,
    financeCompletedRefunds: null as string | null,
    financePendingRefunds: null as string | null,
    paymentHistoryLines: null as string[] | null,
    paymentHistory: null as import("@/lib/ops/payment-history").OpsPaymentHistorySection | null,
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

  if ((detail.paymentMethod ?? "").trim().toLowerCase() === "sbp") {
    try {
      const { loadReservationFinancialSummary, listPaymentTransactions, listRefundAllocations } =
        await import("@/lib/payments/ledger/store");
      const { buildOpsPaymentHistorySection } = await import(
        "@/lib/ops/payment-history"
      );
      const [summary, payments, refunds] = await Promise.all([
        loadReservationFinancialSummary({
          reservationId: detail.id,
          currentTotal:
            detail.totalPrice != null ? Number(detail.totalPrice) : null,
          currentCurrency: detail.currency,
        }),
        listPaymentTransactions(detail.id),
        listRefundAllocations(detail.id),
      ]);
      detail.paymentHistory = buildOpsPaymentHistorySection({
        payments,
        refunds,
        summary,
      });
      detail.financeGross =
        `${summary.grossSuccessfulPayments} ${summary.currency ?? ""}`.trim();
      detail.financeNet =
        `${summary.netCollectedAmount} ${summary.currency ?? ""}`.trim();
      detail.financeCompletedRefunds =
        `${summary.completedRefunds} ${summary.currency ?? ""}`.trim();
      detail.financePendingRefunds =
        `${summary.pendingRefunds} ${summary.currency ?? ""}`.trim();
    } catch {
      // Ledger may be unavailable before migration.
    }
  }

  return detail;
}
