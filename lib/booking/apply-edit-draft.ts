import "server-only";

import { type PoolClient } from "pg";
import {
  COMPLETED_STAGE,
  COMPLETED_STATUS,
  DRAFT_STATUS,
  HOURLY_SERVICE_TYPE,
  type ActiveDraft,
} from "@/lib/booking/reservation-search";
import { isBursaTour } from "@/lib/booking/pricing/bursa-pricing";
import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { isLayoverTour } from "@/lib/booking/pricing/layover-pricing";
import { isNoKmPackageTour } from "@/lib/booking/pricing/no-km-package-tour";
import { buildReservationServiceSnapshot } from "@/lib/booking/reservation-service-snapshot";
import { canonicalFxSnapshot, selectedStoredAmount } from "@/lib/ops/money";
import { resolveStoredPriceAmount } from "@/lib/ops/price-override";

/**
 * Apply edit draft trip/price/customer fields onto the existing reservation.
 * Does NOT touch payment ledger columns (except total_price/currency).
 * Keeps reservation_code unchanged.
 */
export async function applyEditDraftToReservation(
  client: PoolClient,
  reservationId: string,
  draft: ActiveDraft,
) {
  const pickupAt = draft.applied.pickupAt;
  if (!pickupAt) {
    throw new Error("edit-draft missing pickup_at");
  }
  const price = resolveStoredPriceAmount({
    currency: draft.currency,
    appliedVehicleTotal: draft.appliedVehicleTotal,
    fxSnapshot: draft.appliedFxSnapshot,
    priceManuallyOverridden: draft.priceManuallyOverridden,
    manualPriceTotals: draft.manualPriceTotals,
  });
  const calculatedPrice = selectedStoredAmount({
    currency: draft.currency,
    appliedVehicleTotal: draft.appliedVehicleTotal,
    fxSnapshot: draft.appliedFxSnapshot,
  });
  const fxSnapshot = canonicalFxSnapshot(
    draft.appliedFxSnapshot,
    draft.appliedVehicleTotalEur,
  );
  const bosphorus = isBosphorusDinnerTour(draft.serviceType, draft.tourCode);
  const serviceContentSnapshot =
    draft.serviceType === "hourly" ||
    draft.serviceType === "tour" ||
    Boolean(draft.appliedVehicleCode)
      ? buildReservationServiceSnapshot({
          serviceType: draft.serviceType,
          tourCode: draft.tourCode,
          durationHours: draft.applied.durationHours,
          bursaRoute: draft.applied.bursaRoute,
          vehicleCode: draft.appliedVehicleCode,
        })
      : null;

  await client.query(
    `UPDATE reservations SET
       locale = $2,
       service_type = $3,
       tour_code = $4,
       pickup_name_customer = $5,
       pickup_address_customer = $6,
       pickup_name_tr = $7,
       pickup_address_tr = $8,
       pickup_place_id = $9,
       pickup_latitude = $10,
       pickup_longitude = $11,
       pickup_location_type = $12,
       pickup_airport_code = $13,
       dropoff_name_customer = $14,
       dropoff_address_customer = $15,
       dropoff_name_tr = $16,
       dropoff_address_tr = $17,
       dropoff_place_id = $18,
       dropoff_latitude = $19,
       dropoff_longitude = $20,
       dropoff_location_type = $21,
       dropoff_airport_code = $22,
       pickup_at = $23,
       service_timezone = $24,
       distance_km = $25,
       passenger_count = $26,
       luggage_count = $27,
       baby_seat_count = $28,
       flight_code = $29,
       meet_and_greet = $30,
       duration_hours = $31,
       bursa_route = $32,
       bosphorus_adult_soft = $33,
       bosphorus_adult_alcohol = $34,
       bosphorus_child_5_9 = $35,
       bosphorus_child_0_4 = $36,
       vehicle_code = $37,
       vehicle_label_customer = $38,
       vehicle_label_tr = $39,
       total_price = $40,
       currency = $41,
       fx_snapshot = $42::jsonb,
       price_manually_overridden = $43,
       manual_price_totals = $44::jsonb,
       system_total_price = $45,
       system_currency = $46,
       system_fx_snapshot = $47::jsonb,
       customer_first_name = $48,
       customer_last_name = $49,
       customer_email = $50,
       customer_phone = $51,
       customer_country_code = $52,
       notes = $53,
       service_content_snapshot = $54::jsonb,
       updated_at = NOW()
     WHERE id = $1`,
    [
      reservationId,
      draft.locale ?? "tr",
      draft.serviceType ?? "transfer",
      draft.tourCode,
      draft.applied.pickup.nameCustomer,
      draft.applied.pickup.addressCustomer,
      draft.applied.pickup.nameTr,
      draft.applied.pickup.addressTr,
      draft.applied.pickup.placeId,
      draft.applied.pickup.latitude,
      draft.applied.pickup.longitude,
      draft.applied.pickup.locationType,
      draft.applied.pickup.airportCode,
      draft.applied.dropoff.nameCustomer,
      draft.applied.dropoff.addressCustomer,
      draft.applied.dropoff.nameTr,
      draft.applied.dropoff.addressTr,
      draft.applied.dropoff.placeId,
      draft.applied.dropoff.latitude,
      draft.applied.dropoff.longitude,
      draft.applied.dropoff.locationType,
      draft.applied.dropoff.airportCode,
      pickupAt,
      draft.serviceTimezone ?? "Europe/Istanbul",
      draft.applied.distanceKm,
      draft.applied.passengerCount,
      draft.applied.luggageCount,
      draft.applied.babySeatCount,
      draft.applied.flightCode,
      draft.applied.meetAndGreet,
      draft.serviceType === HOURLY_SERVICE_TYPE ||
      isLayoverTour(draft.serviceType, draft.tourCode) ||
      isNoKmPackageTour(draft.serviceType, draft.tourCode)
        ? draft.applied.durationHours
        : null,
      isBursaTour(draft.serviceType, draft.tourCode)
        ? draft.applied.bursaRoute
        : null,
      bosphorus ? (draft.applied.bosphorusPax?.adultSoft ?? 0) : null,
      bosphorus ? (draft.applied.bosphorusPax?.adultAlcohol ?? 0) : null,
      bosphorus ? (draft.applied.bosphorusPax?.child5to9 ?? 0) : null,
      bosphorus ? (draft.applied.bosphorusPax?.child0to4 ?? 0) : null,
      bosphorus ? null : draft.appliedVehicleCode,
      draft.appliedVehicleLabelCustomer,
      draft.appliedVehicleLabelTr,
      price.amount,
      price.currency,
      fxSnapshot ? JSON.stringify(fxSnapshot) : null,
      draft.priceManuallyOverridden,
      draft.manualPriceTotals ? JSON.stringify(draft.manualPriceTotals) : null,
      calculatedPrice.amount,
      calculatedPrice.currency,
      draft.appliedFxSnapshot ? JSON.stringify(draft.appliedFxSnapshot) : null,
      draft.customerFirstName,
      draft.customerLastName,
      draft.customerEmail,
      draft.customerPhone,
      draft.customerCountryCode,
      draft.notes,
      serviceContentSnapshot ? JSON.stringify(serviceContentSnapshot) : null,
    ],
  );

  await client.query(
    `DELETE FROM reservations_passengers WHERE reservation_id = $1`,
    [reservationId],
  );
  const passengers = await client.query<{
    sequence_no: number;
    first_name: string | null;
    last_name: string | null;
    country_code: string | null;
    identity_number: string | null;
    gender: string | null;
    is_primary_passenger: boolean;
  }>(
    `SELECT sequence_no, first_name, last_name, country_code, identity_number,
            gender, is_primary_passenger
     FROM reservation_searches_passengers
     WHERE reservation_search_id = $1
     ORDER BY sequence_no ASC`,
    [draft.id],
  );
  for (const passenger of passengers.rows) {
    await client.query(
      `INSERT INTO reservations_passengers (
         reservation_id, sequence_no, first_name, last_name,
         country_code, identity_number, gender, is_primary_passenger
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        reservationId,
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

  await client.query(
    `UPDATE reservation_searches
     SET status = $2,
         current_stage = $3,
         completed_at = COALESCE(completed_at, NOW())
     WHERE id = $1 AND status = $4`,
    [draft.id, COMPLETED_STATUS, COMPLETED_STAGE, DRAFT_STATUS],
  );

  return {
    total: price.amount,
    currency: price.currency,
  };
}
