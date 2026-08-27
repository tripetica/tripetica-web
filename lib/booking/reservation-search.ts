import "server-only";

import { fxSnapshotForVehicle, parseFxSnapshot, isKnownVehicleCode, isVehicleCodeVisible, vehicleQuoteViewFromApplied } from "@/lib/booking/fx/vehicle-totals";
import { getActiveFxBook } from "@/lib/booking/fx/service";
import { type FxSnapshot } from "@/lib/booking/fx/types";
import { DEFAULT_DISPLAY_CURRENCY, normalizeDisplayCurrency } from "@/lib/booking/pricing/format-eur";
import { toE164 } from "@/lib/booking/phone";
import { normalizeIso2 } from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import { query } from "@/lib/db/postgres";
import { timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import { type PersistedLocation, resolveLocationGeo } from "@/lib/booking/location-persist";
import { normalizeMeetAndGreet } from "@/lib/booking/meet-and-greet";
import {
  BABY_SEAT_COUNT_MAX,
  BABY_SEAT_COUNT_MIN,
  LUGGAGE_COUNT_MAX,
  LUGGAGE_COUNT_MIN,
  PASSENGER_COUNT_MAX,
  PASSENGER_COUNT_UNSET,
  hasAppliedPassengerCount,
  maxKeptDraftPassengerSequence,
  normalizeOccupancyCount,
} from "@/lib/booking/occupancy";
import {
  type LocationGeo,
} from "@/lib/booking/pricing/location-codes";
import {
  quoteTransferBase,
  type TransferPricingBreakdown,
} from "@/lib/booking/pricing/transfer-pricing";
import { loadActiveTransferPricingRules } from "@/lib/booking/pricing/transfer-pricing-store";
import {
  meetAndGreetForVehicleSelection,
  occupancyForVehicleQuotes,
  type VehicleOccupancy,
} from "@/lib/booking/pricing/vehicle-quote";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import {
  computeDrivingRoute,
  coordsFromLatLng,
} from "@/lib/booking/route-distance";

export const TRANSFER_SERVICE_TYPE = "transfer";
export const DRAFT_STATUS = "draft";
export const VEHICLE_SELECTION_STAGE = "vehicle_selection";
export const CHECKOUT_STAGE = "checkout";
export const PASSENGER_GENDERS = ["female", "male"] as const;
export type PassengerGender = (typeof PASSENGER_GENDERS)[number];

export type TransferSearchFields = {
  locale: Locale;
  pickup: PersistedLocation;
  dropoff: PersistedLocation;
  pickupAt: Date;
  distanceKm: number | null;
};

type SearchIdRow = {
  id: string;
};

export type DraftLocation = {
  nameCustomer: string | null;
  addressCustomer: string | null;
  nameTr: string | null;
  addressTr: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  locationType: string | null;
  airportCode: string | null;
  provinceCode: string | null;
  districtCode: string | null;
};

export type DraftTrip = {
  pickup: DraftLocation;
  dropoff: DraftLocation;
  pickupAt: Date | null;
  distanceKm: number | null;
  passengerCount: number | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  meetAndGreet: boolean | null;
  flightCode: string | null;
};

export type DraftPassenger = {
  sequenceNo: number;
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  identityNumber: string | null;
  gender: PassengerGender | null;
  isPrimaryPassenger: boolean;
};

export type ActiveDraft = {
  id: string;
  serviceType: string | null;
  currentStage: string | null;
  locale: string | null;
  serviceTimezone: string | null;
  selected: DraftTrip;
  applied: DraftTrip;
  appliedTransferQuote: TransferPricingBreakdown | null;
  appliedFxSnapshot: FxSnapshot | null;
  currency: string | null;
  appliedVehicleCode: string | null;
  appliedVehicleLabelCustomer: string | null;
  appliedVehicleLabelTr: string | null;
  appliedVehicleTotalEur: number | null;
  appliedVehicleTotal: number | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCountryCode: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  notes: string | null;
  passengers: DraftPassenger[];
};

/** @deprecated Use ActiveDraft.applied.pickup */
export type ActiveDraftLocation = DraftLocation;

type DraftRow = SearchIdRow & {
  service_type: string | null;
  current_stage: string | null;
  locale: string | null;
  service_timezone: string | null;
  selected_pickup_at: Date | null;
  applied_pickup_at: Date | null;
  selected_distance_km: string | number | null;
  applied_distance_km: string | number | null;
  selected_pickup_name_customer: string | null;
  selected_pickup_address_customer: string | null;
  selected_pickup_name_tr: string | null;
  selected_pickup_address_tr: string | null;
  selected_pickup_place_id: string | null;
  selected_pickup_latitude: number | null;
  selected_pickup_longitude: number | null;
  selected_pickup_location_type: string | null;
  selected_pickup_airport_code: string | null;
  applied_pickup_name_customer: string | null;
  applied_pickup_address_customer: string | null;
  applied_pickup_name_tr: string | null;
  applied_pickup_address_tr: string | null;
  applied_pickup_place_id: string | null;
  applied_pickup_latitude: number | null;
  applied_pickup_longitude: number | null;
  applied_pickup_location_type: string | null;
  applied_pickup_airport_code: string | null;
  selected_dropoff_name_customer: string | null;
  selected_dropoff_address_customer: string | null;
  selected_dropoff_name_tr: string | null;
  selected_dropoff_address_tr: string | null;
  selected_dropoff_place_id: string | null;
  selected_dropoff_latitude: number | null;
  selected_dropoff_longitude: number | null;
  selected_dropoff_location_type: string | null;
  selected_dropoff_airport_code: string | null;
  applied_dropoff_name_customer: string | null;
  applied_dropoff_address_customer: string | null;
  applied_dropoff_name_tr: string | null;
  applied_dropoff_address_tr: string | null;
  applied_dropoff_place_id: string | null;
  applied_dropoff_latitude: number | null;
  applied_dropoff_longitude: number | null;
  applied_dropoff_location_type: string | null;
  applied_dropoff_airport_code: string | null;
  selected_passenger_count: string | number | null;
  applied_passenger_count: string | number | null;
  selected_luggage_count: string | number | null;
  applied_luggage_count: string | number | null;
  selected_baby_seat_count: string | number | null;
  applied_baby_seat_count: string | number | null;
  selected_meet_and_greet: boolean | null;
  applied_meet_and_greet: boolean | null;
  selected_flight_code: string | null;
  applied_flight_code: string | null;
  selected_pickup_province_code: string | null;
  selected_pickup_district_code: string | null;
  applied_pickup_province_code: string | null;
  applied_pickup_district_code: string | null;
  selected_dropoff_province_code: string | null;
  selected_dropoff_district_code: string | null;
  applied_dropoff_province_code: string | null;
  applied_dropoff_district_code: string | null;
  applied_transfer_quote: TransferPricingBreakdown | null;
  applied_transfer_pricing_version: string | null;
  applied_fx_snapshot: unknown;
  currency: string | null;
  applied_vehicle_code: string | null;
  applied_vehicle_label_customer: string | null;
  applied_vehicle_label_tr: string | null;
  selected_vehicle_code: string | null;
  selected_vehicle_label_customer: string | null;
  selected_vehicle_label_tr: string | null;
  applied_vehicle_total_eur: string | number | null;
  applied_vehicle_total: string | number | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_country_code: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  notes: string | null;
};

type PassengerRow = {
  sequence_no: string | number;
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
  identity_number: string | null;
  gender: string | null;
  is_primary_passenger: boolean;
};

const DRAFT_SELECT = `
       id,
       service_type,
       current_stage,
       locale,
       service_timezone,
       selected_pickup_at,
       applied_pickup_at,
       selected_distance_km,
       applied_distance_km,
       selected_pickup_name_customer,
       selected_pickup_address_customer,
       selected_pickup_name_tr,
       selected_pickup_address_tr,
       selected_pickup_place_id,
       selected_pickup_latitude,
       selected_pickup_longitude,
       selected_pickup_location_type,
       selected_pickup_airport_code,
       applied_pickup_name_customer,
       applied_pickup_address_customer,
       applied_pickup_name_tr,
       applied_pickup_address_tr,
       applied_pickup_place_id,
       applied_pickup_latitude,
       applied_pickup_longitude,
       applied_pickup_location_type,
       applied_pickup_airport_code,
       selected_dropoff_name_customer,
       selected_dropoff_address_customer,
       selected_dropoff_name_tr,
       selected_dropoff_address_tr,
       selected_dropoff_place_id,
       selected_dropoff_latitude,
       selected_dropoff_longitude,
       selected_dropoff_location_type,
       selected_dropoff_airport_code,
       applied_dropoff_name_customer,
       applied_dropoff_address_customer,
       applied_dropoff_name_tr,
       applied_dropoff_address_tr,
       applied_dropoff_place_id,
       applied_dropoff_latitude,
       applied_dropoff_longitude,
       applied_dropoff_location_type,
       applied_dropoff_airport_code,
       selected_passenger_count,
       applied_passenger_count,
       selected_luggage_count,
       applied_luggage_count,
       selected_baby_seat_count,
       applied_baby_seat_count,
       selected_meet_and_greet,
       applied_meet_and_greet,
       selected_flight_code,
       applied_flight_code,
       selected_pickup_province_code,
       selected_pickup_district_code,
       applied_pickup_province_code,
       applied_pickup_district_code,
       selected_dropoff_province_code,
       selected_dropoff_district_code,
       applied_dropoff_province_code,
       applied_dropoff_district_code,
       applied_transfer_quote,
       applied_transfer_pricing_version,
       applied_fx_snapshot,
       currency,
       applied_vehicle_code,
       applied_vehicle_label_customer,
       applied_vehicle_label_tr,
       selected_vehicle_code,
       selected_vehicle_label_customer,
       selected_vehicle_label_tr,
       applied_vehicle_total_eur,
       applied_vehicle_total,
       customer_email,
       customer_phone,
       customer_country_code,
       customer_first_name,
       customer_last_name,
       notes
`;

function asDistanceKm(value: string | number | null) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asMoney(value: string | number | null) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asInteger(value: string | number | null) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function asBoolean(value: boolean | null) {
  return value === true ? true : value === false ? false : null;
}

function mapLocation(
  row: DraftRow,
  kind: "selected" | "applied",
  side: "pickup" | "dropoff",
): DraftLocation {
  if (kind === "selected" && side === "pickup") {
    return {
      nameCustomer: row.selected_pickup_name_customer,
      addressCustomer: row.selected_pickup_address_customer,
      nameTr: row.selected_pickup_name_tr,
      addressTr: row.selected_pickup_address_tr,
      placeId: row.selected_pickup_place_id,
      latitude: row.selected_pickup_latitude,
      longitude: row.selected_pickup_longitude,
      locationType: row.selected_pickup_location_type,
      airportCode: row.selected_pickup_airport_code,
      provinceCode: row.selected_pickup_province_code,
      districtCode: row.selected_pickup_district_code,
    };
  }
  if (kind === "applied" && side === "pickup") {
    return {
      nameCustomer: row.applied_pickup_name_customer,
      addressCustomer: row.applied_pickup_address_customer,
      nameTr: row.applied_pickup_name_tr,
      addressTr: row.applied_pickup_address_tr,
      placeId: row.applied_pickup_place_id,
      latitude: row.applied_pickup_latitude,
      longitude: row.applied_pickup_longitude,
      locationType: row.applied_pickup_location_type,
      airportCode: row.applied_pickup_airport_code,
      provinceCode: row.applied_pickup_province_code,
      districtCode: row.applied_pickup_district_code,
    };
  }
  if (kind === "selected" && side === "dropoff") {
    return {
      nameCustomer: row.selected_dropoff_name_customer,
      addressCustomer: row.selected_dropoff_address_customer,
      nameTr: row.selected_dropoff_name_tr,
      addressTr: row.selected_dropoff_address_tr,
      placeId: row.selected_dropoff_place_id,
      latitude: row.selected_dropoff_latitude,
      longitude: row.selected_dropoff_longitude,
      locationType: row.selected_dropoff_location_type,
      airportCode: row.selected_dropoff_airport_code,
      provinceCode: row.selected_dropoff_province_code,
      districtCode: row.selected_dropoff_district_code,
    };
  }
  return {
    nameCustomer: row.applied_dropoff_name_customer,
    addressCustomer: row.applied_dropoff_address_customer,
    nameTr: row.applied_dropoff_name_tr,
    addressTr: row.applied_dropoff_address_tr,
    placeId: row.applied_dropoff_place_id,
    latitude: row.applied_dropoff_latitude,
    longitude: row.applied_dropoff_longitude,
    locationType: row.applied_dropoff_location_type,
    airportCode: row.applied_dropoff_airport_code,
    provinceCode: row.applied_dropoff_province_code,
    districtCode: row.applied_dropoff_district_code,
  };
}

function asQuote(value: TransferPricingBreakdown | null): TransferPricingBreakdown | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (typeof value.baseTransferFeeEur !== "number") {
    return null;
  }
  return value;
}

function mapDraft(row: DraftRow): ActiveDraft {
  return {
    id: row.id,
    serviceType: row.service_type,
    currentStage: row.current_stage,
    locale: row.locale,
    serviceTimezone: row.service_timezone,
    selected: {
      pickup: mapLocation(row, "selected", "pickup"),
      dropoff: mapLocation(row, "selected", "dropoff"),
      pickupAt: row.selected_pickup_at,
      distanceKm: asDistanceKm(row.selected_distance_km),
      passengerCount: asInteger(row.selected_passenger_count),
      luggageCount: asInteger(row.selected_luggage_count),
      babySeatCount: asInteger(row.selected_baby_seat_count),
      meetAndGreet: asBoolean(row.selected_meet_and_greet),
      flightCode: row.selected_flight_code,
    },
    applied: {
      pickup: mapLocation(row, "applied", "pickup"),
      dropoff: mapLocation(row, "applied", "dropoff"),
      pickupAt: row.applied_pickup_at,
      distanceKm: asDistanceKm(row.applied_distance_km),
      passengerCount: asInteger(row.applied_passenger_count),
      luggageCount: asInteger(row.applied_luggage_count),
      babySeatCount: asInteger(row.applied_baby_seat_count),
      meetAndGreet: asBoolean(row.applied_meet_and_greet),
      flightCode: row.applied_flight_code,
    },
    appliedTransferQuote: asQuote(row.applied_transfer_quote),
    appliedFxSnapshot: parseFxSnapshot(row.applied_fx_snapshot),
    currency: row.currency?.trim() || null,
    appliedVehicleCode: row.applied_vehicle_code?.trim() || null,
    appliedVehicleLabelCustomer: row.applied_vehicle_label_customer,
    appliedVehicleLabelTr: row.applied_vehicle_label_tr,
    appliedVehicleTotalEur: asMoney(row.applied_vehicle_total_eur),
    appliedVehicleTotal: asMoney(row.applied_vehicle_total),
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerCountryCode: row.customer_country_code,
    customerFirstName: row.customer_first_name,
    customerLastName: row.customer_last_name,
    notes: row.notes,
    passengers: [],
  };
}

export async function findActiveDraft(
  browserSessionId: string,
): Promise<ActiveDraft | null> {
  const result = await query<DraftRow>(
    `SELECT ${DRAFT_SELECT}
     FROM reservation_searches
     WHERE browser_session_id = $1
       AND status = $2
     ORDER BY updated_at DESC
     LIMIT 1`,
    [browserSessionId, DRAFT_STATUS],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const draft = mapDraft(row);
  draft.passengers = await listDraftPassengers(draft.id);
  return draft;
}

function persistValues(browserSessionId: string, fields: TransferSearchFields) {
  const { pickup, dropoff } = fields;
  return [
    browserSessionId,
    DRAFT_STATUS,
    VEHICLE_SELECTION_STAGE,
    fields.locale,
    TRANSFER_SERVICE_TYPE,
    pickup.nameCustomer,
    pickup.addressCustomer,
    pickup.nameTr,
    pickup.addressTr,
    pickup.placeId,
    pickup.latitude,
    pickup.longitude,
    pickup.locationType,
    pickup.airportCode,
    pickup.nameCustomer,
    pickup.addressCustomer,
    pickup.nameTr,
    pickup.addressTr,
    pickup.placeId,
    pickup.latitude,
    pickup.longitude,
    pickup.locationType,
    pickup.airportCode,
    dropoff.nameCustomer,
    dropoff.addressCustomer,
    dropoff.nameTr,
    dropoff.addressTr,
    dropoff.placeId,
    dropoff.latitude,
    dropoff.longitude,
    dropoff.locationType,
    dropoff.airportCode,
    dropoff.nameCustomer,
    dropoff.addressCustomer,
    dropoff.nameTr,
    dropoff.addressTr,
    dropoff.placeId,
    dropoff.latitude,
    dropoff.longitude,
    dropoff.locationType,
    dropoff.airportCode,
    fields.pickupAt,
    fields.pickupAt,
    "Europe/Istanbul",
    fields.distanceKm,
    fields.distanceKm,
    pickup.provinceCode,
    pickup.districtCode,
    pickup.provinceCode,
    pickup.districtCode,
    dropoff.provinceCode,
    dropoff.districtCode,
    dropoff.provinceCode,
    dropoff.districtCode,
    DEFAULT_DISPLAY_CURRENCY,
  ];
}

async function insertDraft(
  browserSessionId: string,
  fields: TransferSearchFields,
) {
  const result = await query<SearchIdRow>(
    `INSERT INTO reservation_searches (
       browser_session_id,
       status,
       current_stage,
       locale,
       service_type,
       selected_pickup_name_customer,
       selected_pickup_address_customer,
       selected_pickup_name_tr,
       selected_pickup_address_tr,
       selected_pickup_place_id,
       selected_pickup_latitude,
       selected_pickup_longitude,
       selected_pickup_location_type,
       selected_pickup_airport_code,
       applied_pickup_name_customer,
       applied_pickup_address_customer,
       applied_pickup_name_tr,
       applied_pickup_address_tr,
       applied_pickup_place_id,
       applied_pickup_latitude,
       applied_pickup_longitude,
       applied_pickup_location_type,
       applied_pickup_airport_code,
       selected_dropoff_name_customer,
       selected_dropoff_address_customer,
       selected_dropoff_name_tr,
       selected_dropoff_address_tr,
       selected_dropoff_place_id,
       selected_dropoff_latitude,
       selected_dropoff_longitude,
       selected_dropoff_location_type,
       selected_dropoff_airport_code,
       applied_dropoff_name_customer,
       applied_dropoff_address_customer,
       applied_dropoff_name_tr,
       applied_dropoff_address_tr,
       applied_dropoff_place_id,
       applied_dropoff_latitude,
       applied_dropoff_longitude,
       applied_dropoff_location_type,
       applied_dropoff_airport_code,
       selected_pickup_at,
       applied_pickup_at,
       service_timezone,
       selected_distance_km,
       applied_distance_km,
       selected_pickup_province_code,
       selected_pickup_district_code,
       applied_pickup_province_code,
       applied_pickup_district_code,
       selected_dropoff_province_code,
       selected_dropoff_district_code,
       applied_dropoff_province_code,
       applied_dropoff_district_code,
       currency,
       selected_meet_and_greet,
       applied_meet_and_greet
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20, $21, $22, $23,
       $24, $25, $26, $27, $28, $29, $30, $31, $32,
       $33, $34, $35, $36, $37, $38, $39, $40, $41,
       $42, $43, $44, $45, $46,
       $47, $48, $49, $50, $51, $52, $53, $54, $55,
       FALSE,
       FALSE
     )
     RETURNING id`,
    persistValues(browserSessionId, fields),
  );
  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error("Failed to insert reservation_search");
  }
  return id;
}

async function updateDraft(id: string, fields: TransferSearchFields) {
  // Homepage "View Options" commits a new route/datetime as both
  // selected and applied. Vehicle/price already stored on this draft may
  // no longer match the new route. Controlled invalidation comes later —
  // do not null those columns here.
  // Keep the last applied meet-and-greet preference. Never reset it to
  // false here; selected follows applied so the booking UI hydrates it.
  await query(
    `UPDATE reservation_searches SET
       service_type = $2,
       locale = $3,
       current_stage = $4,
       selected_meet_and_greet = applied_meet_and_greet,
       selected_pickup_name_customer = $5,
       selected_pickup_address_customer = $6,
       selected_pickup_name_tr = $7,
       selected_pickup_address_tr = $8,
       selected_pickup_place_id = $9,
       selected_pickup_latitude = $10,
       selected_pickup_longitude = $11,
       selected_pickup_location_type = $12,
       selected_pickup_airport_code = $13,
       applied_pickup_name_customer = $14,
       applied_pickup_address_customer = $15,
       applied_pickup_name_tr = $16,
       applied_pickup_address_tr = $17,
       applied_pickup_place_id = $18,
       applied_pickup_latitude = $19,
       applied_pickup_longitude = $20,
       applied_pickup_location_type = $21,
       applied_pickup_airport_code = $22,
       selected_dropoff_name_customer = $23,
       selected_dropoff_address_customer = $24,
       selected_dropoff_name_tr = $25,
       selected_dropoff_address_tr = $26,
       selected_dropoff_place_id = $27,
       selected_dropoff_latitude = $28,
       selected_dropoff_longitude = $29,
       selected_dropoff_location_type = $30,
       selected_dropoff_airport_code = $31,
       applied_dropoff_name_customer = $32,
       applied_dropoff_address_customer = $33,
       applied_dropoff_name_tr = $34,
       applied_dropoff_address_tr = $35,
       applied_dropoff_place_id = $36,
       applied_dropoff_latitude = $37,
       applied_dropoff_longitude = $38,
       applied_dropoff_location_type = $39,
       applied_dropoff_airport_code = $40,
       selected_pickup_at = $41,
       applied_pickup_at = $42,
       selected_distance_km = $43,
       applied_distance_km = $44,
       selected_pickup_province_code = $46,
       selected_pickup_district_code = $47,
       applied_pickup_province_code = $48,
       applied_pickup_district_code = $49,
       selected_dropoff_province_code = $50,
       selected_dropoff_district_code = $51,
       applied_dropoff_province_code = $52,
       applied_dropoff_district_code = $53
     WHERE id = $1
       AND status = $45`,
    [
      id,
      TRANSFER_SERVICE_TYPE,
      fields.locale,
      VEHICLE_SELECTION_STAGE,
      fields.pickup.nameCustomer,
      fields.pickup.addressCustomer,
      fields.pickup.nameTr,
      fields.pickup.addressTr,
      fields.pickup.placeId,
      fields.pickup.latitude,
      fields.pickup.longitude,
      fields.pickup.locationType,
      fields.pickup.airportCode,
      fields.pickup.nameCustomer,
      fields.pickup.addressCustomer,
      fields.pickup.nameTr,
      fields.pickup.addressTr,
      fields.pickup.placeId,
      fields.pickup.latitude,
      fields.pickup.longitude,
      fields.pickup.locationType,
      fields.pickup.airportCode,
      fields.dropoff.nameCustomer,
      fields.dropoff.addressCustomer,
      fields.dropoff.nameTr,
      fields.dropoff.addressTr,
      fields.dropoff.placeId,
      fields.dropoff.latitude,
      fields.dropoff.longitude,
      fields.dropoff.locationType,
      fields.dropoff.airportCode,
      fields.dropoff.nameCustomer,
      fields.dropoff.addressCustomer,
      fields.dropoff.nameTr,
      fields.dropoff.addressTr,
      fields.dropoff.placeId,
      fields.dropoff.latitude,
      fields.dropoff.longitude,
      fields.dropoff.locationType,
      fields.dropoff.airportCode,
      fields.pickupAt,
      fields.pickupAt,
      fields.distanceKm,
      fields.distanceKm,
      DRAFT_STATUS,
      fields.pickup.provinceCode,
      fields.pickup.districtCode,
      fields.pickup.provinceCode,
      fields.pickup.districtCode,
      fields.dropoff.provinceCode,
      fields.dropoff.districtCode,
      fields.dropoff.provinceCode,
      fields.dropoff.districtCode,
    ],
  );
  return id;
}

async function geoFromLocation(location: DraftLocation): Promise<LocationGeo> {
  return resolveLocationGeo(location);
}

export async function storeAppliedTransferQuote(id: string) {
  const result = await query<DraftRow>(
    `SELECT ${DRAFT_SELECT}
     FROM reservation_searches
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) {
    return;
  }
  const draft = mapDraft(row);
  if (draft.applied.distanceKm === null || !draft.applied.pickupAt) {
    await query(
      `UPDATE reservation_searches
       SET applied_transfer_quote = NULL,
           applied_transfer_pricing_version = NULL,
           applied_fx_snapshot = NULL,
           applied_vehicle_code = NULL,
           applied_vehicle_label_customer = NULL,
           applied_vehicle_label_tr = NULL,
           selected_vehicle_code = NULL,
           selected_vehicle_label_customer = NULL,
           selected_vehicle_label_tr = NULL,
           applied_vehicle_total_eur = NULL,
           applied_vehicle_total = NULL
       WHERE id = $1`,
      [id],
    );
    return;
  }

  const rules = await loadActiveTransferPricingRules();
  const pickupGeo = await geoFromLocation(draft.applied.pickup);
  const dropoffGeo = await geoFromLocation(draft.applied.dropoff);
  const quote = quoteTransferBase(
    {
      distanceKm: draft.applied.distanceKm,
      pickupAtLocal: timestamptzToIstanbulLocal(draft.applied.pickupAt),
      pickup: pickupGeo,
      dropoff: dropoffGeo,
    },
    rules,
  );
  const meetAndGreet = normalizeMeetAndGreet(
    draft.applied.pickup,
    draft.applied.meetAndGreet,
  );
  const book = await getActiveFxBook();
  const snapshot = fxSnapshotForVehicle(
    quote,
    {
      passengerCount: draft.applied.passengerCount,
      luggageCount: draft.applied.luggageCount,
      babySeatCount: draft.applied.babySeatCount,
      meetAndGreet,
    },
    book,
  );
  await query(
    `UPDATE reservation_searches
     SET applied_transfer_quote = $2::jsonb,
         applied_transfer_pricing_version = $3,
         applied_price = $4,
         currency = COALESCE(currency, $5),
         applied_pickup_province_code = $6,
         applied_pickup_district_code = $7,
         applied_dropoff_province_code = $8,
         applied_dropoff_district_code = $9,
         applied_meet_and_greet = $10,
         applied_fx_snapshot = $11::jsonb
     WHERE id = $1`,
    [
      id,
      JSON.stringify(quote),
      quote.pricingVersion,
      quote.baseTransferFeeEur,
      DEFAULT_DISPLAY_CURRENCY,
      pickupGeo.provinceCode,
      pickupGeo.districtCode,
      dropoffGeo.provinceCode,
      dropoffGeo.districtCode,
      meetAndGreet,
      JSON.stringify(snapshot),
    ],
  );
  await syncAppliedVehicleTotals(id);
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function appliedOccupancy(draft: ActiveDraft): VehicleOccupancy {
  return occupancyForVehicleQuotes(
    draft.applied,
    draft.selected.meetAndGreet,
    draft.selected.pickup,
  );
}

function moneySql(amount: number | null) {
  if (amount === null || !Number.isFinite(amount)) {
    return null;
  }
  return amount.toFixed(2);
}

async function writeAppliedVehicle(
  id: string,
  patch: {
    code: string | null;
    labelCustomer: string | null;
    labelTr: string | null;
    totalEur: number | null;
    total: number | null;
  },
) {
  await query(
    `UPDATE reservation_searches SET
       applied_vehicle_code = $2,
       applied_vehicle_label_customer = $3,
       applied_vehicle_label_tr = $4,
       selected_vehicle_code = $2,
       selected_vehicle_label_customer = $3,
       selected_vehicle_label_tr = $4,
       applied_vehicle_total_eur = $5,
       applied_vehicle_total = $6
     WHERE id = $1`,
    [
      id,
      patch.code,
      patch.labelCustomer,
      patch.labelTr,
      moneySql(patch.totalEur),
      moneySql(patch.total),
    ],
  );
}

async function clearAppliedVehicle(id: string) {
  await writeAppliedVehicle(id, {
    code: null,
    labelCustomer: null,
    labelTr: null,
    totalEur: null,
    total: null,
  });
}

function frozenVehicleTotals(draft: ActiveDraft, vehicleCode: string) {
  const quote = draft.appliedTransferQuote;
  if (!quote) {
    return null;
  }
  const occupancy = appliedOccupancy(draft);
  if (!isVehicleCodeVisible(vehicleCode, occupancy)) {
    return null;
  }
  const view = vehicleQuoteViewFromApplied(quote, occupancy, {
    snapshot: draft.appliedFxSnapshot,
  }, vehicleCode);
  const currency = normalizeDisplayCurrency(draft.currency);
  const total = view.totals.find((item) => item.code === currency)?.amount ?? null;
  return {
    totalEur: view.totalEur,
    total,
    currency,
  };
}

export async function syncAppliedVehicleTotals(id: string) {
  const result = await query<DraftRow>(
    `SELECT ${DRAFT_SELECT}
     FROM reservation_searches
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) {
    return;
  }
  const draft = mapDraft(row);
  const code = draft.appliedVehicleCode;
  if (!code || !isKnownVehicleCode(code)) {
    if (code) {
      await clearAppliedVehicle(id);
    }
    return;
  }
  const frozen = frozenVehicleTotals(draft, code);
  if (!frozen) {
    await clearAppliedVehicle(id);
    return;
  }
  await writeAppliedVehicle(id, {
    code,
    labelCustomer: draft.appliedVehicleLabelCustomer,
    labelTr: draft.appliedVehicleLabelTr,
    totalEur: frozen.totalEur,
    total: frozen.total,
  });
}

export async function applySelectedVehicle(
  browserSessionId: string,
  vehicleCode: string,
  locale: Locale,
): Promise<
  | { status: "ok"; draft: ActiveDraft }
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "incomplete"; draft: ActiveDraft }
> {
  if (!isKnownVehicleCode(vehicleCode)) {
    return { status: "invalid" };
  }
  const existing = await findActiveDraft(browserSessionId);
  if (!existing) {
    return { status: "missing" };
  }
  if (!existing.appliedTransferQuote) {
    return { status: "incomplete", draft: existing };
  }
  if (!hasAppliedPassengerCount(existing.applied.passengerCount)) {
    return { status: "incomplete", draft: existing };
  }
  const meetAndGreet = meetAndGreetForVehicleSelection(
    vehicleCode,
    existing.selected.pickup,
    existing.selected.meetAndGreet,
  );
  const forPricing = {
    ...existing,
    selected: { ...existing.selected, meetAndGreet },
    applied: { ...existing.applied, meetAndGreet },
  };
  const frozen = frozenVehicleTotals(forPricing, vehicleCode);
  if (!frozen) {
    return { status: "incomplete", draft: existing };
  }
  if (
    existing.selected.meetAndGreet !== meetAndGreet ||
    existing.applied.meetAndGreet !== meetAndGreet
  ) {
    await query(
      `UPDATE reservation_searches
       SET selected_meet_and_greet = $2,
           applied_meet_and_greet = $2
       WHERE id = $1
         AND status = $3`,
      [existing.id, meetAndGreet, DRAFT_STATUS],
    );
  }
  const labelCustomer = vehicleCardCopyFor(vehicleCode, locale).title;
  const labelTr = vehicleCardCopyFor(vehicleCode, "tr").title;
  await writeAppliedVehicle(existing.id, {
    code: vehicleCode,
    labelCustomer,
    labelTr,
    totalEur: frozen.totalEur,
    total: frozen.total,
  });
  await deletePassengersBeyondAppliedCount(
    existing.id,
    existing.applied.passengerCount,
  );
  await setDraftStageById(existing.id, CHECKOUT_STAGE);
  const next = await findActiveDraft(browserSessionId);
  if (!next) {
    return { status: "missing" };
  }
  return { status: "ok", draft: next };
}

export async function upsertTransferDraft(
  browserSessionId: string,
  fields: TransferSearchFields,
) {
  const existing = await findActiveDraft(browserSessionId);
  let id: string;
  if (existing) {
    id = await updateDraft(existing.id, fields);
  } else {
    try {
      id = await insertDraft(browserSessionId, fields);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const raced = await findActiveDraft(browserSessionId);
      if (!raced) {
        throw error;
      }
      id = await updateDraft(raced.id, fields);
    }
  }
  await storeAppliedTransferQuote(id);
  return id;
}

export async function computeSelectedRoute(
  pickup: DraftLocation | PersistedLocation,
  dropoff: DraftLocation | PersistedLocation,
) {
  return computeDrivingRoute(
    coordsFromLatLng(pickup.latitude, pickup.longitude),
    coordsFromLatLng(dropoff.latitude, dropoff.longitude),
  );
}

export async function computeSelectedDistanceKm(
  pickup: DraftLocation | PersistedLocation,
  dropoff: DraftLocation | PersistedLocation,
) {
  const route = await computeSelectedRoute(pickup, dropoff);
  return route?.distanceKm ?? null;
}

export type SelectedTripPatch = {
  pickup?: PersistedLocation;
  dropoff?: PersistedLocation;
  pickupAt?: Date;
  passengerCount?: number | null;
  luggageCount?: number | null;
  babySeatCount?: number | null;
  meetAndGreet?: boolean | null;
  flightCode?: string | null;
  currency?: string | null;
};

export type ClearDraftFields = {
  pickup?: boolean;
  dropoff?: boolean;
  pickupAt?: boolean;
};

const PICKUP_CLEAR_SQL = `
  selected_pickup_name_customer = NULL,
  selected_pickup_address_customer = NULL,
  selected_pickup_name_tr = NULL,
  selected_pickup_address_tr = NULL,
  selected_pickup_place_id = NULL,
  selected_pickup_latitude = NULL,
  selected_pickup_longitude = NULL,
  selected_pickup_location_type = NULL,
  selected_pickup_airport_code = NULL,
  selected_pickup_province_code = NULL,
  selected_pickup_district_code = NULL,
  applied_pickup_name_customer = NULL,
  applied_pickup_address_customer = NULL,
  applied_pickup_name_tr = NULL,
  applied_pickup_address_tr = NULL,
  applied_pickup_place_id = NULL,
  applied_pickup_latitude = NULL,
  applied_pickup_longitude = NULL,
  applied_pickup_location_type = NULL,
  applied_pickup_airport_code = NULL,
  applied_pickup_province_code = NULL,
  applied_pickup_district_code = NULL,
  selected_meet_and_greet = FALSE,
  applied_meet_and_greet = FALSE
`;

const DROPOFF_CLEAR_SQL = `
  selected_dropoff_name_customer = NULL,
  selected_dropoff_address_customer = NULL,
  selected_dropoff_name_tr = NULL,
  selected_dropoff_address_tr = NULL,
  selected_dropoff_place_id = NULL,
  selected_dropoff_latitude = NULL,
  selected_dropoff_longitude = NULL,
  selected_dropoff_location_type = NULL,
  selected_dropoff_airport_code = NULL,
  selected_dropoff_province_code = NULL,
  selected_dropoff_district_code = NULL,
  applied_dropoff_name_customer = NULL,
  applied_dropoff_address_customer = NULL,
  applied_dropoff_name_tr = NULL,
  applied_dropoff_address_tr = NULL,
  applied_dropoff_place_id = NULL,
  applied_dropoff_latitude = NULL,
  applied_dropoff_longitude = NULL,
  applied_dropoff_location_type = NULL,
  applied_dropoff_airport_code = NULL,
  applied_dropoff_province_code = NULL,
  applied_dropoff_district_code = NULL
`;

export async function clearDraftTripFields(
  browserSessionId: string,
  fields: ClearDraftFields,
): Promise<ActiveDraft | null> {
  const existing = await findActiveDraft(browserSessionId);
  if (!existing) {
    return null;
  }

  const assignments: string[] = [];
  if (fields.pickup) {
    assignments.push(PICKUP_CLEAR_SQL);
  }
  if (fields.dropoff) {
    assignments.push(DROPOFF_CLEAR_SQL);
  }
  if (fields.pickupAt) {
    assignments.push("selected_pickup_at = NULL", "applied_pickup_at = NULL");
  }
  if (fields.pickup || fields.dropoff) {
    assignments.push("selected_distance_km = NULL", "applied_distance_km = NULL");
  }
  if (assignments.length === 0) {
    return existing;
  }

  const result = await query<DraftRow>(
    `UPDATE reservation_searches SET
       ${assignments.join(", ")}
     WHERE id = $1
       AND browser_session_id = $2
       AND status = $3
     RETURNING ${DRAFT_SELECT}`,
    [existing.id, browserSessionId, DRAFT_STATUS],
  );
  const row = result.rows[0];
  return row ? mapDraft(row) : null;
}

export async function updateSelectedTrip(
  browserSessionId: string,
  patch: SelectedTripPatch,
): Promise<{ draft: ActiveDraft; distanceError: boolean } | null> {
  const existing = await findActiveDraft(browserSessionId);
  if (!existing) {
    return null;
  }

  const pickup = patch.pickup ?? existing.selected.pickup;
  const dropoff = patch.dropoff ?? existing.selected.dropoff;
  const pickupAt = patch.pickupAt ?? existing.selected.pickupAt;
  const passengerCount = normalizeOccupancyCount(
    patch.passengerCount !== undefined
      ? patch.passengerCount
      : existing.selected.passengerCount,
    PASSENGER_COUNT_UNSET,
    PASSENGER_COUNT_MAX,
  );
  const luggageCount = normalizeOccupancyCount(
    patch.luggageCount !== undefined
      ? patch.luggageCount
      : existing.selected.luggageCount,
    LUGGAGE_COUNT_MIN,
    LUGGAGE_COUNT_MAX,
  );
  const babySeatCount = normalizeOccupancyCount(
    patch.babySeatCount !== undefined
      ? patch.babySeatCount
      : existing.selected.babySeatCount,
    BABY_SEAT_COUNT_MIN,
    BABY_SEAT_COUNT_MAX,
  );
  const meetAndGreet = normalizeMeetAndGreet(
    pickup,
    patch.meetAndGreet !== undefined
      ? patch.meetAndGreet
      : existing.selected.meetAndGreet,
  );
  const flightCode =
    patch.flightCode !== undefined
      ? patch.flightCode
      : existing.selected.flightCode;
  const currency =
    patch.currency !== undefined
      ? patch.currency
      : (existing.currency ?? DEFAULT_DISPLAY_CURRENCY);
  const locationChanged = Boolean(patch.pickup || patch.dropoff);

  let distanceKm = existing.selected.distanceKm;
  let distanceError = false;
  if (locationChanged) {
    const origin = coordsFromLatLng(pickup.latitude, pickup.longitude);
    const destination = coordsFromLatLng(dropoff.latitude, dropoff.longitude);
    if (!origin || !destination) {
      distanceKm = null;
      distanceError = true;
    } else {
      const route = await computeDrivingRoute(origin, destination);
      distanceKm = route?.distanceKm ?? null;
      distanceError = route === null;
    }
  }

  const result = await query<DraftRow>(
    `UPDATE reservation_searches SET
       selected_pickup_name_customer = $3,
       selected_pickup_address_customer = $4,
       selected_pickup_name_tr = $5,
       selected_pickup_address_tr = $6,
       selected_pickup_place_id = $7,
       selected_pickup_latitude = $8,
       selected_pickup_longitude = $9,
       selected_pickup_location_type = $10,
       selected_pickup_airport_code = $11,
       selected_dropoff_name_customer = $12,
       selected_dropoff_address_customer = $13,
       selected_dropoff_name_tr = $14,
       selected_dropoff_address_tr = $15,
       selected_dropoff_place_id = $16,
       selected_dropoff_latitude = $17,
       selected_dropoff_longitude = $18,
       selected_dropoff_location_type = $19,
       selected_dropoff_airport_code = $20,
       selected_pickup_at = $21,
       selected_distance_km = $22,
       selected_passenger_count = $23,
       selected_luggage_count = $24,
       selected_baby_seat_count = $25,
       selected_meet_and_greet = $26,
       selected_flight_code = $27,
       selected_pickup_province_code = $29,
       selected_pickup_district_code = $30,
       selected_dropoff_province_code = $31,
       selected_dropoff_district_code = $32,
       currency = $33
     WHERE id = $1
       AND browser_session_id = $2
       AND status = $28
     RETURNING ${DRAFT_SELECT}`,
    [
      existing.id,
      browserSessionId,
      pickup.nameCustomer,
      pickup.addressCustomer,
      pickup.nameTr,
      pickup.addressTr,
      pickup.placeId,
      pickup.latitude,
      pickup.longitude,
      pickup.locationType,
      pickup.airportCode,
      dropoff.nameCustomer,
      dropoff.addressCustomer,
      dropoff.nameTr,
      dropoff.addressTr,
      dropoff.placeId,
      dropoff.latitude,
      dropoff.longitude,
      dropoff.locationType,
      dropoff.airportCode,
      pickupAt,
      distanceKm,
      passengerCount,
      luggageCount,
      babySeatCount,
      meetAndGreet,
      flightCode,
      DRAFT_STATUS,
      pickup.provinceCode,
      pickup.districtCode,
      dropoff.provinceCode,
      dropoff.districtCode,
      currency,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  if (patch.currency !== undefined) {
    await syncAppliedVehicleTotals(existing.id);
    const refreshed = await query<DraftRow>(
      `SELECT ${DRAFT_SELECT}
       FROM reservation_searches
       WHERE id = $1
       LIMIT 1`,
      [existing.id],
    );
    const next = refreshed.rows[0];
    return next
      ? { draft: mapDraft(next), distanceError }
      : { draft: mapDraft(row), distanceError };
  }
  return { draft: mapDraft(row), distanceError };
}

export async function applySelectedTripToApplied(browserSessionId: string) {
  const existing = await findActiveDraft(browserSessionId);
  if (!existing) {
    return { status: "missing" as const };
  }
  if (
    existing.selected.distanceKm === null ||
    existing.selected.pickupAt === null
  ) {
    return { status: "incomplete" as const, draft: existing };
  }

  const passengerCount = normalizeOccupancyCount(
    existing.selected.passengerCount,
    PASSENGER_COUNT_UNSET,
    PASSENGER_COUNT_MAX,
  );
  const luggageCount = normalizeOccupancyCount(
    existing.selected.luggageCount,
    LUGGAGE_COUNT_MIN,
    LUGGAGE_COUNT_MAX,
  );
  const babySeatCount = normalizeOccupancyCount(
    existing.selected.babySeatCount,
    BABY_SEAT_COUNT_MIN,
    BABY_SEAT_COUNT_MAX,
  );
  const pickupGeo = await geoFromLocation(existing.selected.pickup);
  const dropoffGeo = await geoFromLocation(existing.selected.dropoff);
  const meetAndGreet = normalizeMeetAndGreet(
    existing.selected.pickup,
    existing.selected.meetAndGreet,
  );

  const result = await query<DraftRow>(
    `UPDATE reservation_searches SET
       applied_pickup_name_customer = selected_pickup_name_customer,
       applied_pickup_address_customer = selected_pickup_address_customer,
       applied_pickup_name_tr = selected_pickup_name_tr,
       applied_pickup_address_tr = selected_pickup_address_tr,
       applied_pickup_place_id = selected_pickup_place_id,
       applied_pickup_latitude = selected_pickup_latitude,
       applied_pickup_longitude = selected_pickup_longitude,
       applied_pickup_location_type = selected_pickup_location_type,
       applied_pickup_airport_code = selected_pickup_airport_code,
       applied_dropoff_name_customer = selected_dropoff_name_customer,
       applied_dropoff_address_customer = selected_dropoff_address_customer,
       applied_dropoff_name_tr = selected_dropoff_name_tr,
       applied_dropoff_address_tr = selected_dropoff_address_tr,
       applied_dropoff_place_id = selected_dropoff_place_id,
       applied_dropoff_latitude = selected_dropoff_latitude,
       applied_dropoff_longitude = selected_dropoff_longitude,
       applied_dropoff_location_type = selected_dropoff_location_type,
       applied_dropoff_airport_code = selected_dropoff_airport_code,
       applied_pickup_at = selected_pickup_at,
       applied_distance_km = selected_distance_km,
       selected_passenger_count = $4,
       applied_passenger_count = $4,
       selected_luggage_count = $5,
       applied_luggage_count = $5,
       selected_baby_seat_count = $6,
       applied_baby_seat_count = $6,
       selected_meet_and_greet = $7,
       applied_meet_and_greet = $7,
       applied_flight_code = selected_flight_code,
       selected_pickup_province_code = $8,
       selected_pickup_district_code = $9,
       selected_dropoff_province_code = $10,
       selected_dropoff_district_code = $11,
       applied_pickup_province_code = $8,
       applied_pickup_district_code = $9,
       applied_dropoff_province_code = $10,
       applied_dropoff_district_code = $11
     WHERE id = $1
       AND browser_session_id = $2
       AND status = $3
       AND selected_distance_km IS NOT NULL
       AND selected_pickup_at IS NOT NULL
     RETURNING ${DRAFT_SELECT}`,
    [
      existing.id,
      browserSessionId,
      DRAFT_STATUS,
      passengerCount,
      luggageCount,
      babySeatCount,
      meetAndGreet,
      pickupGeo.provinceCode,
      pickupGeo.districtCode,
      dropoffGeo.provinceCode,
      dropoffGeo.districtCode,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    return { status: "incomplete" as const, draft: existing };
  }
  await storeAppliedTransferQuote(row.id);
  const priced = await query<DraftRow>(
    `SELECT ${DRAFT_SELECT}
     FROM reservation_searches
     WHERE id = $1
     LIMIT 1`,
    [row.id],
  );
  const pricedRow = priced.rows[0];
  return { status: "ok" as const, draft: mapDraft(pricedRow ?? row) };
}

function asGender(value: string | null | undefined): PassengerGender | null {
  return value === "female" || value === "male" ? value : null;
}

function trimToNull(value: string | null | undefined, max = 200) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

function mapPassenger(row: PassengerRow): DraftPassenger {
  return {
    sequenceNo: asInteger(row.sequence_no) ?? 0,
    firstName: row.first_name,
    lastName: row.last_name,
    countryCode: normalizeIso2(row.country_code),
    identityNumber: row.identity_number,
    gender: asGender(row.gender),
    isPrimaryPassenger: row.is_primary_passenger === true,
  };
}

export async function listDraftPassengers(searchId: string) {
  const result = await query<PassengerRow>(
    `SELECT sequence_no, first_name, last_name, country_code, identity_number,
            gender, is_primary_passenger
     FROM reservation_searches_passengers
     WHERE reservation_search_id = $1
     ORDER BY sequence_no`,
    [searchId],
  );
  return result.rows.map(mapPassenger).filter((row) => row.sequenceNo > 0);
}

async function deletePassengersBeyondAppliedCount(
  draftId: string,
  appliedPassengerCount: number | null,
) {
  const keepThrough = maxKeptDraftPassengerSequence(appliedPassengerCount);
  if (keepThrough === null) {
    return;
  }
  await query(
    `DELETE FROM reservation_searches_passengers
     WHERE reservation_search_id = $1
       AND sequence_no > $2`,
    [draftId, keepThrough],
  );
}

async function setDraftStageById(id: string, stage: string) {
  await query(
    `UPDATE reservation_searches
     SET current_stage = $2
     WHERE id = $1
       AND status = $3`,
    [id, stage, DRAFT_STATUS],
  );
}

export async function setDraftStage(
  browserSessionId: string,
  stage: typeof VEHICLE_SELECTION_STAGE | typeof CHECKOUT_STAGE,
) {
  const existing = await findActiveDraft(browserSessionId);
  if (!existing) {
    return { status: "missing" as const };
  }
  if (stage === CHECKOUT_STAGE && !existing.appliedVehicleCode) {
    return { status: "incomplete" as const, draft: existing };
  }
  await setDraftStageById(existing.id, stage);
  const next = await findActiveDraft(browserSessionId);
  return next
    ? { status: "ok" as const, draft: next }
    : { status: "missing" as const };
}

export type DraftContactPatch = {
  email?: string | null;
  phoneCountryCode?: string | null;
  phoneNational?: string | null;
  notes?: string | null;
};

export async function updateDraftContact(
  browserSessionId: string,
  patch: DraftContactPatch,
) {
  const existing = await findActiveDraft(browserSessionId);
  if (!existing) {
    return { status: "missing" as const };
  }

  const email =
    patch.email === undefined ? existing.customerEmail : trimToNull(patch.email, 254);
  const phoneCountryCode =
    patch.phoneCountryCode === undefined
      ? existing.customerCountryCode
      : normalizeIso2(patch.phoneCountryCode);
  const notes =
    patch.notes === undefined ? existing.notes : trimToNull(patch.notes, 2000);

  let phone = existing.customerPhone;
  if (patch.phoneCountryCode !== undefined || patch.phoneNational !== undefined) {
    const national =
      patch.phoneNational !== undefined
        ? patch.phoneNational
        : (existing.customerPhone ?? "");
    phone = toE164(phoneCountryCode, national);
    if (patch.phoneNational !== undefined && trimToNull(patch.phoneNational, 32) === null) {
      phone = null;
    }
  }

  await query(
    `UPDATE reservation_searches
     SET customer_email = $2,
         customer_phone = $3,
         customer_country_code = $4,
         notes = $5
     WHERE id = $1
       AND status = $6`,
    [existing.id, email, phone, phoneCountryCode, notes, DRAFT_STATUS],
  );
  const next = await findActiveDraft(browserSessionId);
  return next
    ? { status: "ok" as const, draft: next }
    : { status: "missing" as const };
}

export type DraftPassengerPatch = {
  sequenceNo: number;
  firstName?: string | null;
  lastName?: string | null;
  countryCode?: string | null;
  identityNumber?: string | null;
  gender?: PassengerGender | null;
};

function passengerPatchHasContent(patch: DraftPassengerPatch) {
  return (
    trimToNull(patch.firstName ?? null) !== null ||
    trimToNull(patch.lastName ?? null) !== null ||
    normalizeIso2(patch.countryCode) !== null ||
    trimToNull(patch.identityNumber ?? null, 64) !== null
  );
}

export async function upsertDraftPassenger(
  browserSessionId: string,
  patch: DraftPassengerPatch,
) {
  const existing = await findActiveDraft(browserSessionId);
  if (!existing) {
    return { status: "missing" as const };
  }
  const sequenceNo = Math.floor(patch.sequenceNo);
  if (!Number.isInteger(sequenceNo) || sequenceNo < 1) {
    return { status: "invalid" as const };
  }
  const keepThrough = maxKeptDraftPassengerSequence(existing.applied.passengerCount);
  if (keepThrough !== null && sequenceNo > keepThrough) {
    return { status: "ok" as const, draft: existing };
  }
  const current = existing.passengers.find((row) => row.sequenceNo === sequenceNo) ?? null;
  const isPrimary = sequenceNo === 1;
  if (!isPrimary && !current && !passengerPatchHasContent(patch)) {
    return { status: "ok" as const, draft: existing };
  }

  const firstName =
    patch.firstName !== undefined
      ? trimToNull(patch.firstName, 80)
      : (current?.firstName ?? null);
  const lastName =
    patch.lastName !== undefined
      ? trimToNull(patch.lastName, 80)
      : (current?.lastName ?? null);
  const countryCode =
    patch.countryCode !== undefined
      ? normalizeIso2(patch.countryCode)
      : (current?.countryCode ?? null);
  const identityNumber =
    patch.identityNumber !== undefined
      ? trimToNull(patch.identityNumber, 64)
      : (current?.identityNumber ?? null);
  const gender =
    patch.gender !== undefined
      ? asGender(patch.gender)
      : (current?.gender ?? (isPrimary ? "female" : null));

  await query(
    `INSERT INTO reservation_searches_passengers (
       reservation_search_id, sequence_no, first_name, last_name,
       country_code, identity_number, gender, is_primary_passenger
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (reservation_search_id, sequence_no)
     DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       country_code = EXCLUDED.country_code,
       identity_number = EXCLUDED.identity_number,
       gender = EXCLUDED.gender,
       is_primary_passenger = EXCLUDED.is_primary_passenger`,
    [
      existing.id,
      sequenceNo,
      firstName,
      lastName,
      countryCode,
      identityNumber,
      gender,
      isPrimary,
    ],
  );

  if (isPrimary) {
    await query(
      `UPDATE reservation_searches
       SET customer_first_name = $2,
           customer_last_name = $3
       WHERE id = $1
         AND status = $4`,
      [existing.id, firstName, lastName, DRAFT_STATUS],
    );
  }

  const next = await findActiveDraft(browserSessionId);
  return next
    ? { status: "ok" as const, draft: next }
    : { status: "missing" as const };
}

