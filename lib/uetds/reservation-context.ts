import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { type UetdsDraft } from "@/lib/uetds/draft";
import { evaluateUetdsEligibility, mapUetdsCompanyReadiness, type UetdsEligibility } from "@/lib/uetds/eligibility";
import { loadPlaceGeoDetails } from "@/lib/booking/places-server";
import { isOfficialUetdsLocationReady, type UetdsLocation } from "@/lib/uetds/location";
import { prefillUetdsDraftFromReservation } from "@/lib/uetds/prefill";
import {
  reservationPlaceNeedsDetails,
  resolveUetdsLocationFromReservationPlace,
} from "@/lib/uetds/reservation-location";

type ReservationRow = {
  id: string;
  accepted_partner_id: string | null;
  pickup_name_customer: string | null;
  pickup_name_tr: string | null;
  pickup_address_customer: string | null;
  pickup_address_tr: string | null;
  pickup_place_id: string | null;
  pickup_location_type: string | null;
  pickup_airport_code: string | null;
  dropoff_name_customer: string | null;
  dropoff_name_tr: string | null;
  dropoff_address_customer: string | null;
  dropoff_address_tr: string | null;
  dropoff_place_id: string | null;
  dropoff_location_type: string | null;
  dropoff_airport_code: string | null;
  pickup_at: Date | null;
  passenger_count: number | null;
  service_type: string | null;
  tour_code: string | null;
  notes: string | null;
  assigned_driver_kind: string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_kind: string | null;
  assigned_vehicle_id: string | null;
  driver_company_id: string | null;
  vehicle_company_id: string | null;
  company_id: string | null;
  company_short_name: string | null;
  company_status: string | null;
  company_integration_status: string | null;
};

type PassengerRow = {
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
  identity_number: string | null;
  gender: string | null;
};

export type UetdsReservationContext = {
  reservationId: string;
  partnerId: string | null;
  draft: UetdsDraft;
  eligibility: UetdsEligibility;
};

function displayName(customer: string | null, tr: string | null) {
  return customer?.trim() || tr?.trim() || null;
}

export async function loadUetdsReservationContext(
  reservationId: string,
): Promise<UetdsReservationContext | null> {
  if (!isUuid(reservationId)) {
    return null;
  }
  const result = await query<ReservationRow>(
    `SELECT
        r.id,
        r.accepted_partner_id,
        r.pickup_name_customer,
        r.pickup_name_tr,
        r.pickup_address_customer,
        r.pickup_address_tr,
        r.pickup_place_id,
        r.pickup_location_type,
        r.pickup_airport_code,
        r.dropoff_name_customer,
        r.dropoff_name_tr,
        r.dropoff_address_customer,
        r.dropoff_address_tr,
        r.dropoff_place_id,
        r.dropoff_location_type,
        r.dropoff_airport_code,
        r.pickup_at,
        r.passenger_count,
        r.service_type,
        r.tour_code,
        r.notes,
        r.assigned_driver_kind,
        r.assigned_driver_id,
        r.assigned_vehicle_kind,
        r.assigned_vehicle_id,
        d.uetds_company_id AS driver_company_id,
        v.uetds_company_id AS vehicle_company_id,
        COALESCE(dc.id, vc.id) AS company_id,
        COALESCE(dc.short_name, vc.short_name) AS company_short_name,
        COALESCE(dc.status, vc.status) AS company_status,
        COALESCE(dc.integration_status, vc.integration_status) AS company_integration_status
     FROM reservations r
     LEFT JOIN partner_drivers d ON d.id = r.assigned_driver_id
     LEFT JOIN partner_vehicles v ON v.id = r.assigned_vehicle_id
     LEFT JOIN uetds_companies dc ON dc.id = d.uetds_company_id
     LEFT JOIN uetds_companies vc ON vc.id = v.uetds_company_id
     WHERE r.id = $1
       AND r.deleted_at IS NULL
     LIMIT 1`,
    [reservationId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const passengers = await query<PassengerRow>(
    `SELECT first_name, last_name, country_code, identity_number, gender
     FROM reservations_passengers
     WHERE reservation_id = $1
     ORDER BY sequence_no ASC`,
    [reservationId],
  );
  const sameCompany =
    row.driver_company_id && row.vehicle_company_id && row.driver_company_id === row.vehicle_company_id;
  const company = mapUetdsCompanyReadiness({
    id: sameCompany ? row.driver_company_id : row.company_id,
    shortName: row.company_short_name,
    status: row.company_status,
    integrationStatus: row.company_integration_status,
  });
  const eligibility = evaluateUetdsEligibility({
    driverId: row.assigned_driver_id,
    vehicleId: row.assigned_vehicle_id,
    driverKind: row.assigned_driver_kind,
    vehicleKind: row.assigned_vehicle_kind,
    driverCompanyId: row.driver_company_id,
    vehicleCompanyId: row.vehicle_company_id,
    company: sameCompany ? company : null,
  });
  const draft = prefillUetdsDraftFromReservation({
      reservationId: row.id,
      pickupName: displayName(row.pickup_name_customer, row.pickup_name_tr),
      dropoffName: displayName(row.dropoff_name_customer, row.dropoff_name_tr),
      pickupAddress: displayName(row.pickup_address_customer, row.pickup_address_tr),
      dropoffAddress: displayName(row.dropoff_address_customer, row.dropoff_address_tr),
      pickupPlaceId: row.pickup_place_id,
      dropoffPlaceId: row.dropoff_place_id,
      pickupLocationType: row.pickup_location_type,
      dropoffLocationType: row.dropoff_location_type,
      pickupAirportCode: row.pickup_airport_code,
      dropoffAirportCode: row.dropoff_airport_code,
      pickupAt: row.pickup_at?.toISOString() ?? null,
      passengerCount: row.passenger_count,
      serviceType: row.service_type,
      tourCode: row.tour_code,
      notes: row.notes,
      driverId: row.assigned_driver_id,
      vehicleId: row.assigned_vehicle_id,
      driverKind: row.assigned_driver_kind,
      vehicleKind: row.assigned_vehicle_kind,
      passengers: passengers.rows.map((passenger) => ({
        firstName: passenger.first_name,
        lastName: passenger.last_name,
        countryCode: passenger.country_code,
        identityNumber: passenger.identity_number,
        gender: passenger.gender,
      })),
    });
  draft.originLocation = await enrichReservationLocation(
    draft.originLocation,
    {
      name: displayName(row.pickup_name_customer, row.pickup_name_tr),
      address: displayName(row.pickup_address_customer, row.pickup_address_tr),
      placeId: row.pickup_place_id,
      locationType: row.pickup_location_type,
      airportCode: row.pickup_airport_code,
    },
  );
  draft.destinationLocation = await enrichReservationLocation(
    draft.destinationLocation,
    {
      name: displayName(row.dropoff_name_customer, row.dropoff_name_tr),
      address: displayName(row.dropoff_address_customer, row.dropoff_address_tr),
      placeId: row.dropoff_place_id,
      locationType: row.dropoff_location_type,
      airportCode: row.dropoff_airport_code,
    },
  );
  draft.origin = draft.originLocation.placeName || draft.origin;
  draft.destination = draft.destinationLocation.placeName || draft.destination;
  draft.originReview = draft.originLocation.review;
  draft.destinationReview = draft.destinationLocation.review;
  return {
    reservationId: row.id,
    partnerId: row.accepted_partner_id,
    eligibility,
    draft,
  };
}

async function enrichReservationLocation(
  current: UetdsLocation,
  place: {
    name: string | null;
    address: string | null;
    placeId: string | null;
    locationType: string | null;
    airportCode: string | null;
  },
): Promise<UetdsLocation> {
  if (!reservationPlaceNeedsDetails(current, place.placeId) || !place.placeId) {
    return current;
  }
  const details = await loadPlaceGeoDetails(place.placeId);
  if (!details) {
    return current;
  }
  const next = resolveUetdsLocationFromReservationPlace(place, details);
  return isOfficialUetdsLocationReady(next) ? next : current;
}
