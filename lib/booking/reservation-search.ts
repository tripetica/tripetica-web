import "server-only";

import { type PoolClient } from "pg";
import { fxSnapshotForVehicle, parseFxSnapshot, isKnownVehicleCode, isVehicleCodeVisible, vehicleQuoteViewFromApplied } from "@/lib/booking/fx/vehicle-totals";
import { getActiveFxBook } from "@/lib/booking/fx/service";
import { type FxSnapshot } from "@/lib/booking/fx/types";
import { DEFAULT_DISPLAY_CURRENCY, normalizeDisplayCurrency } from "@/lib/booking/pricing/format-eur";
import { toE164 } from "@/lib/booking/phone";
import { normalizeIso2 } from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import { query } from "@/lib/db/postgres";
import { type ManualPriceTotals, parseManualPriceTotals } from "@/lib/ops/price-override";
import { hasUnappliedTripChanges, type BookingTripView } from "@/lib/booking/draft-view";
import { timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import {
  type PersistedLocation,
  resolveLocationGeo,
  UntrustedLocationError,
} from "@/lib/booking/location-persist";
import {
  normalizeMeetAndGreet,
  pickupAirportCode,
} from "@/lib/booking/meet-and-greet";
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
  HOURLY_MAX_HOURS,
  HOURLY_MIN_HOURS,
  HOURLY_SERVICE_TYPE,
  quoteHourlyBase,
} from "@/lib/booking/pricing/hourly-pricing";
import {
  FULL_DAY_TOUR_CODE,
  HALF_DAY_TOUR_CODE,
} from "@/lib/booking/pricing/istanbul-address-package-tour";
import {
  isNoKmPackageTour,
  noKmPackageTourDurationHours,
  quoteNoKmPackageTourBase,
} from "@/lib/booking/pricing/no-km-package-tour";
import {
  BURSA_ROUTE_FERRY,
  BURSA_TOUR_CODE,
  isBursaTour,
  normalizeBursaRoute,
  type BursaRouteOption,
} from "@/lib/booking/pricing/bursa-pricing";
import {
  BOSPHORUS_DINNER_PRICING_VERSION,
  BOSPHORUS_DINNER_TOUR_CODE,
  bosphorusHasBookablePax,
  bosphorusTotalPax,
  clampBosphorusPaxAdultRule,
  emptyBosphorusPaxCounts,
  isBosphorusDinnerTour,
  quoteBosphorusDinnerPackageTotalEur,
  type BosphorusPaxCounts,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import {
  SAPANCA_TOUR_CODE,
} from "@/lib/booking/pricing/sapanca-pricing";
import {
  LAYOVER_PACKAGE_HOURS,
  LAYOVER_TOUR_CODE,
  TOUR_SERVICE_TYPE,
  isLayoverTour,
  quoteLayoverBase,
} from "@/lib/booking/pricing/layover-pricing";
import { draftLocationsRepresentSamePlace } from "@/lib/booking/hourly-dropoff-distance";
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
import { bookingCopy } from "@/lib/booking/copy";
import { buildFxSnapshot } from "@/lib/booking/fx/convert";
import {
  computeDrivingRoute,
  coordsFromLatLng,
} from "@/lib/booking/route-distance";
import { type LocationValue } from "@/lib/booking/types";

export const TRANSFER_SERVICE_TYPE = "transfer";
export {
  HOURLY_SERVICE_TYPE,
  TOUR_SERVICE_TYPE,
  LAYOVER_TOUR_CODE,
  HALF_DAY_TOUR_CODE,
  FULL_DAY_TOUR_CODE,
  SAPANCA_TOUR_CODE,
  BURSA_TOUR_CODE,
  BOSPHORUS_DINNER_TOUR_CODE,
};
export const DRAFT_STATUS = "draft";
export const COMPLETED_STATUS = "completed";
/** Soft-closed edit/booking draft; frees unique draft indexes without hard DELETE. */
export const ABANDONED_STATUS = "abandoned";
export const VEHICLE_SELECTION_STAGE = "vehicle_selection";
export const CHECKOUT_STAGE = "checkout";
export const COMPLETED_STAGE = "completed";
export const PASSENGER_GENDERS = ["female", "male"] as const;
export type PassengerGender = (typeof PASSENGER_GENDERS)[number];

export type TransferSearchFields = {
  locale: Locale;
  serviceType: "transfer" | "hourly" | "tour";
  tourCode: string | null;
  pickup: PersistedLocation;
  dropoff: PersistedLocation;
  pickupAt: Date;
  distanceKm: number | null;
  durationHours: number | null;
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
  tourCode?: string | null;
  pickup: DraftLocation;
  dropoff: DraftLocation;
  pickupAt: Date | null;
  distanceKm: number | null;
  durationHours: number | null;
  passengerCount: number | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  meetAndGreet: boolean | null;
  flightCode: string | null;
  bursaRoute: BursaRouteOption | null;
  bosphorusPax: BosphorusPaxCounts | null;
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

export type EditOriginalFinancialSnapshot = {
  reservationId: string;
  reservationCode: string;
  totalPrice: number | null;
  currency: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paymentAmount: number | null;
  paymentCurrency: string | null;
  paymentProvider: string | null;
  paymentProviderOrderId: string | null;
  fxSnapshot: FxSnapshot | null;
  /** Set when an ops user started this edit draft (not customer self-service). */
  opsUserId: string | null;
};

export type ActiveDraft = {
  id: string;
  serviceType: string | null;
  tourCode: string | null;
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
  priceManuallyOverridden: boolean;
  manualPriceTotals: ManualPriceTotals | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCountryCode: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  notes: string | null;
  passengers: DraftPassenger[];
  /** Set only when this draft edits an existing reservation (Stage 2). */
  editingOriginal: EditOriginalFinancialSnapshot | null;
};

/** @deprecated Use ActiveDraft.applied.pickup */
export type ActiveDraftLocation = DraftLocation;

type DraftRow = SearchIdRow & {
  service_type: string | null;
  tour_code: string | null;
  selected_tour_code: string | null;
  current_stage: string | null;
  locale: string | null;
  service_timezone: string | null;
  selected_pickup_at: Date | null;
  applied_pickup_at: Date | null;
  selected_distance_km: string | number | null;
  applied_distance_km: string | number | null;
  selected_duration_hours: string | number | null;
  applied_duration_hours: string | number | null;
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
  selected_bursa_route: string | null;
  applied_bursa_route: string | null;
  selected_bosphorus_adult_soft: string | number | null;
  selected_bosphorus_adult_alcohol: string | number | null;
  selected_bosphorus_child_5_9: string | number | null;
  selected_bosphorus_child_0_4: string | number | null;
  applied_bosphorus_adult_soft: string | number | null;
  applied_bosphorus_adult_alcohol: string | number | null;
  applied_bosphorus_child_5_9: string | number | null;
  applied_bosphorus_child_0_4: string | number | null;
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
  price_manually_overridden: boolean;
  manual_price_totals: unknown;
  customer_email: string | null;
  customer_phone: string | null;
  customer_country_code: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  notes: string | null;
  editing_reservation_id: string | null;
  editing_ops_user_id: string | null;
  edit_original_reservation_code: string | null;
  edit_original_total_price: string | number | null;
  edit_original_currency: string | null;
  edit_original_payment_method: string | null;
  edit_original_payment_status: string | null;
  edit_original_payment_amount: string | number | null;
  edit_original_payment_currency: string | null;
  edit_original_payment_provider: string | null;
  edit_original_payment_provider_order_id: string | null;
  edit_original_fx_snapshot: unknown;
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
       tour_code,
       selected_tour_code,
       current_stage,
       locale,
       service_timezone,
       selected_pickup_at,
       applied_pickup_at,
       selected_distance_km,
       applied_distance_km,
       selected_duration_hours,
       applied_duration_hours,
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
       price_manually_overridden,
       manual_price_totals,
       customer_email,
       customer_phone,
      customer_country_code,
      customer_first_name,
      customer_last_name,
      notes,
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
      edit_original_fx_snapshot
`;

function asDistanceKm(value: string | number | null) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDurationHours(value: string | number | null) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const hours = Math.round(parsed);
  if (hours < HOURLY_MIN_HOURS || hours > HOURLY_MAX_HOURS) {
    return null;
  }
  return hours;
}

function normalizeDurationHours(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  return asDurationHours(value);
}

function isDraftLocationFilled(location: DraftLocation) {
  return Boolean(location.nameCustomer?.trim() || location.placeId);
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

function draftBursaRoute(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
  value: string | null | undefined,
): BursaRouteOption | null {
  if (!isBursaTour(serviceType, tourCode)) {
    return null;
  }
  return normalizeBursaRoute(value ?? BURSA_ROUTE_FERRY);
}

function draftBosphorusPax(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
  adultSoft: string | number | null | undefined,
  adultAlcohol: string | number | null | undefined,
  child5to9: string | number | null | undefined,
  child0to4: string | number | null | undefined,
): BosphorusPaxCounts | null {
  if (!isBosphorusDinnerTour(serviceType, tourCode)) {
    return null;
  }
  return clampBosphorusPaxAdultRule({
    adultSoft: asInteger(adultSoft ?? null) ?? 0,
    adultAlcohol: asInteger(adultAlcohol ?? null) ?? 0,
    child5to9: asInteger(child5to9 ?? null) ?? 0,
    child0to4: asInteger(child0to4 ?? null) ?? 0,
  });
}

function quoteBosphorusDinnerBase(
  counts: BosphorusPaxCounts,
  pickup: LocationGeo,
  dropoff: LocationGeo,
  airportCode: string | null,
  meetAndGreet: boolean,
): TransferPricingBreakdown {
  const total = quoteBosphorusDinnerPackageTotalEur(
    counts,
    airportCode,
    meetAndGreet,
  );
  return {
    openingFeeEur: 0,
    distanceFeeEur: 0,
    locationSurchargeEur: 0,
    timeSurchargeEur: 0,
    baseTransferFeeEur: total,
    pricingVersion: BOSPHORUS_DINNER_PRICING_VERSION,
    pickupProvinceCode: pickup.provinceCode,
    pickupDistrictCode: pickup.districtCode,
    dropoffProvinceCode: dropoff.provinceCode,
    dropoffDistrictCode: dropoff.districtCode,
  };
}

function mapDraft(row: DraftRow): ActiveDraft {
  const appliedTourCode = row.tour_code?.trim() || null;
  const selectedTourCode = row.selected_tour_code?.trim() || appliedTourCode;
  return {
    id: row.id,
    serviceType: row.service_type,
    tourCode: appliedTourCode,
    currentStage: row.current_stage,
    locale: row.locale,
    serviceTimezone: row.service_timezone,
    selected: {
      tourCode: selectedTourCode,
      pickup: mapLocation(row, "selected", "pickup"),
      dropoff: mapLocation(row, "selected", "dropoff"),
      pickupAt: row.selected_pickup_at,
      distanceKm: asDistanceKm(row.selected_distance_km),
      durationHours: asDurationHours(row.selected_duration_hours),
      passengerCount: asInteger(row.selected_passenger_count),
      luggageCount: asInteger(row.selected_luggage_count),
      babySeatCount: asInteger(row.selected_baby_seat_count),
      meetAndGreet: asBoolean(row.selected_meet_and_greet),
      flightCode: row.selected_flight_code,
      bursaRoute: draftBursaRoute(
        row.service_type,
        selectedTourCode,
        row.selected_bursa_route,
      ),
      bosphorusPax: draftBosphorusPax(
        row.service_type,
        selectedTourCode,
        row.selected_bosphorus_adult_soft,
        row.selected_bosphorus_adult_alcohol,
        row.selected_bosphorus_child_5_9,
        row.selected_bosphorus_child_0_4,
      ),
    },
    applied: {
      tourCode: appliedTourCode,
      pickup: mapLocation(row, "applied", "pickup"),
      dropoff: mapLocation(row, "applied", "dropoff"),
      pickupAt: row.applied_pickup_at,
      distanceKm: asDistanceKm(row.applied_distance_km),
      durationHours: asDurationHours(row.applied_duration_hours),
      passengerCount: asInteger(row.applied_passenger_count),
      luggageCount: asInteger(row.applied_luggage_count),
      babySeatCount: asInteger(row.applied_baby_seat_count),
      meetAndGreet: asBoolean(row.applied_meet_and_greet),
      flightCode: row.applied_flight_code,
      bursaRoute: draftBursaRoute(
        row.service_type,
        row.tour_code,
        row.applied_bursa_route,
      ),
      bosphorusPax: draftBosphorusPax(
        row.service_type,
        row.tour_code,
        row.applied_bosphorus_adult_soft,
        row.applied_bosphorus_adult_alcohol,
        row.applied_bosphorus_child_5_9,
        row.applied_bosphorus_child_0_4,
      ),
    },
    appliedTransferQuote: asQuote(row.applied_transfer_quote),
    appliedFxSnapshot: parseFxSnapshot(row.applied_fx_snapshot),
    currency: row.currency?.trim() || null,
    appliedVehicleCode: row.applied_vehicle_code?.trim() || null,
    appliedVehicleLabelCustomer: row.applied_vehicle_label_customer,
    appliedVehicleLabelTr: row.applied_vehicle_label_tr,
    appliedVehicleTotalEur: asMoney(row.applied_vehicle_total_eur),
    appliedVehicleTotal: asMoney(row.applied_vehicle_total),
    priceManuallyOverridden: row.price_manually_overridden === true,
    manualPriceTotals: parseManualPriceTotals(row.manual_price_totals),
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerCountryCode: row.customer_country_code,
    customerFirstName: row.customer_first_name,
    customerLastName: row.customer_last_name,
    notes: row.notes,
    passengers: [],
    editingOriginal: mapEditingOriginal(row),
  };
}

function mapEditingOriginal(
  row: DraftRow,
): EditOriginalFinancialSnapshot | null {
  const reservationId = row.editing_reservation_id?.trim() || null;
  if (!reservationId) {
    return null;
  }
  return {
    reservationId,
    reservationCode: row.edit_original_reservation_code?.trim() || "",
    totalPrice: asMoney(row.edit_original_total_price),
    currency: row.edit_original_currency?.trim().toUpperCase() || null,
    paymentMethod: row.edit_original_payment_method,
    paymentStatus: row.edit_original_payment_status,
    paymentAmount: asMoney(row.edit_original_payment_amount),
    paymentCurrency:
      row.edit_original_payment_currency?.trim().toUpperCase() || null,
    paymentProvider: row.edit_original_payment_provider,
    paymentProviderOrderId: row.edit_original_payment_provider_order_id,
    fxSnapshot: parseFxSnapshot(row.edit_original_fx_snapshot),
    opsUserId: row.editing_ops_user_id?.trim() || null,
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

export async function findActiveDraftWithClient(
  client: PoolClient,
  browserSessionId: string,
): Promise<ActiveDraft | null> {
  const result = await client.query<DraftRow>(
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
  const passengers = await client.query<PassengerRow>(
    `SELECT sequence_no, first_name, last_name, country_code, identity_number,
            gender, is_primary_passenger
     FROM reservation_searches_passengers
     WHERE reservation_search_id = $1
     ORDER BY sequence_no`,
    [draft.id],
  );
  draft.passengers = passengers.rows.map(mapPassenger).filter((item) => item.sequenceNo > 0);
  return draft;
}

function packageTourDurationHours(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): number | null {
  if (isLayoverTour(serviceType, tourCode)) {
    return LAYOVER_PACKAGE_HOURS;
  }
  return noKmPackageTourDurationHours(serviceType, tourCode);
}

function persistValues(browserSessionId: string, fields: TransferSearchFields) {
  const { pickup, dropoff } = fields;
  const isHourly = fields.serviceType === HOURLY_SERVICE_TYPE;
  const durationHours = isHourly
    ? normalizeDurationHours(fields.durationHours)
    : packageTourDurationHours(fields.serviceType, fields.tourCode);
  const distanceKm = fields.distanceKm;
  const tourCode = fields.tourCode;
  return [
    browserSessionId,
    DRAFT_STATUS,
    VEHICLE_SELECTION_STAGE,
    fields.locale,
    fields.serviceType,
    tourCode,
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
    distanceKm,
    distanceKm,
    durationHours,
    durationHours,
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
       tour_code,
       selected_tour_code,
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
       selected_duration_hours,
       applied_duration_hours,
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
       $1, $2, $3, $4, $5, $6, $6,
       $7, $8, $9, $10, $11, $12, $13, $14, $15,
       $16, $17, $18, $19, $20, $21, $22, $23, $24,
       $25, $26, $27, $28, $29, $30, $31, $32, $33,
       $34, $35, $36, $37, $38, $39, $40, $41, $42,
       $43, $44, $45, $46, $47, $48, $49,
       $50, $51, $52, $53, $54, $55, $56, $57, $58,
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
  const isHourly = fields.serviceType === HOURLY_SERVICE_TYPE;
  const durationHours = isHourly
    ? normalizeDurationHours(fields.durationHours)
    : packageTourDurationHours(fields.serviceType, fields.tourCode);
  const distanceKm = fields.distanceKm;
  const tourCode = fields.tourCode;
  await query(
    `UPDATE reservation_searches SET
       service_type = $2,
       tour_code = $3,
       selected_tour_code = $3,
       locale = $4,
       current_stage = $5,
       selected_meet_and_greet = applied_meet_and_greet,
       selected_pickup_name_customer = $6,
       selected_pickup_address_customer = $7,
       selected_pickup_name_tr = $8,
       selected_pickup_address_tr = $9,
       selected_pickup_place_id = $10,
       selected_pickup_latitude = $11,
       selected_pickup_longitude = $12,
       selected_pickup_location_type = $13,
       selected_pickup_airport_code = $14,
       applied_pickup_name_customer = $15,
       applied_pickup_address_customer = $16,
       applied_pickup_name_tr = $17,
       applied_pickup_address_tr = $18,
       applied_pickup_place_id = $19,
       applied_pickup_latitude = $20,
       applied_pickup_longitude = $21,
       applied_pickup_location_type = $22,
       applied_pickup_airport_code = $23,
       selected_dropoff_name_customer = $24,
       selected_dropoff_address_customer = $25,
       selected_dropoff_name_tr = $26,
       selected_dropoff_address_tr = $27,
       selected_dropoff_place_id = $28,
       selected_dropoff_latitude = $29,
       selected_dropoff_longitude = $30,
       selected_dropoff_location_type = $31,
       selected_dropoff_airport_code = $32,
       applied_dropoff_name_customer = $33,
       applied_dropoff_address_customer = $34,
       applied_dropoff_name_tr = $35,
       applied_dropoff_address_tr = $36,
       applied_dropoff_place_id = $37,
       applied_dropoff_latitude = $38,
       applied_dropoff_longitude = $39,
       applied_dropoff_location_type = $40,
       applied_dropoff_airport_code = $41,
       selected_pickup_at = $42,
       applied_pickup_at = $43,
       selected_distance_km = $44,
       applied_distance_km = $45,
       selected_duration_hours = $47,
       applied_duration_hours = $48,
       selected_pickup_province_code = $49,
       selected_pickup_district_code = $50,
       applied_pickup_province_code = $51,
       applied_pickup_district_code = $52,
       selected_dropoff_province_code = $53,
       selected_dropoff_district_code = $54,
       applied_dropoff_province_code = $55,
       applied_dropoff_district_code = $56
     WHERE id = $1
       AND status = $46`,
    [
      id,
      fields.serviceType,
      tourCode,
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
      distanceKm,
      distanceKm,
      DRAFT_STATUS,
      durationHours,
      durationHours,
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
  const isHourly = draft.serviceType === HOURLY_SERVICE_TYPE;
  const layover = isLayoverTour(draft.serviceType, draft.tourCode);
  const noKmPackage = isNoKmPackageTour(
    draft.serviceType,
    draft.tourCode,
  );
  const bosphorus = isBosphorusDinnerTour(draft.serviceType, draft.tourCode);

  const clearQuote = async () => {
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
  };

  if (isHourly) {
    if (
      draft.applied.durationHours === null ||
      !draft.applied.pickupAt ||
      !isDraftLocationFilled(draft.applied.pickup)
    ) {
      await clearQuote();
      return;
    }
  } else if (layover) {
    if (!draft.applied.pickupAt || !isDraftLocationFilled(draft.applied.pickup)) {
      await clearQuote();
      return;
    }
  } else if (noKmPackage) {
    if (
      !draft.applied.pickupAt ||
      !isDraftLocationFilled(draft.applied.pickup)
    ) {
      await clearQuote();
      return;
    }
  } else if (bosphorus) {
    const counts = draft.applied.bosphorusPax ?? emptyBosphorusPaxCounts();
    if (
      !draft.applied.pickupAt ||
      !isDraftLocationFilled(draft.applied.pickup) ||
      !bosphorusHasBookablePax(counts)
    ) {
      await clearQuote();
      return;
    }
  } else if (draft.applied.distanceKm === null || !draft.applied.pickupAt) {
    await clearQuote();
    return;
  }

  const rules = await loadActiveTransferPricingRules();
  const pickupGeo = await geoFromLocation(draft.applied.pickup);
  const dropoffGeo = await geoFromLocation(draft.applied.dropoff);
  const bosphorusCounts = draft.applied.bosphorusPax ?? emptyBosphorusPaxCounts();
  const meetAndGreet = normalizeMeetAndGreet(
    draft.applied.pickup,
    draft.applied.meetAndGreet,
  );
  const quote = isHourly
    ? quoteHourlyBase(
        {
          durationHours: draft.applied.durationHours!,
          pickup: pickupGeo,
          pickupAirportCode: draft.applied.pickup.airportCode,
          dropoffDistanceKm: draft.applied.distanceKm ?? 0,
        },
        rules,
      )
    : layover
      ? quoteLayoverBase(pickupGeo, {
          pickupAirportCode: draft.applied.pickup.airportCode,
          dropoffAirportCode: draft.applied.dropoff.airportCode,
          pickupLocationType: draft.applied.pickup.locationType,
          dropoffLocationType: draft.applied.dropoff.locationType,
        })
      : bosphorus
        ? quoteBosphorusDinnerBase(
            bosphorusCounts,
            pickupGeo,
            dropoffGeo,
            pickupAirportCode(draft.applied.pickup),
            meetAndGreet,
          )
        : noKmPackage
          ? quoteNoKmPackageTourBase(draft.tourCode, pickupGeo, {
              bursaRoute: draft.applied.bursaRoute,
            })
          : quoteTransferBase(
              {
                distanceKm: draft.applied.distanceKm!,
                pickupAtLocal: timestamptzToIstanbulLocal(draft.applied.pickupAt!),
                pickup: pickupGeo,
                dropoff: dropoffGeo,
              },
              rules,
            );
  if (!quote) {
    await clearQuote();
    return;
  }
  const book = await getActiveFxBook();
  const snapshot = bosphorus
    ? buildFxSnapshot(quote.baseTransferFeeEur, book)
    : fxSnapshotForVehicle(
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
      isHourly || layover ? quote.dropoffProvinceCode : dropoffGeo.provinceCode,
      isHourly || layover ? quote.dropoffDistrictCode : dropoffGeo.districtCode,
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
    draft.applied.meetAndGreet,
    draft.applied.pickup,
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

/** Pick the already-captured package total for the active currency from frozen FX snapshot. */
function frozenPackageTotalFromSnapshot(draft: ActiveDraft): number | null {
  const currency = normalizeDisplayCurrency(draft.currency);
  const raw = draft.appliedFxSnapshot?.totals?.[currency];
  if (raw != null && String(raw).trim() !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return currency === "EUR" ? draft.appliedVehicleTotalEur : null;
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
  if (code && isKnownVehicleCode(code)) {
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
    return;
  }

  if (code) {
    await clearAppliedVehicle(id);
    return;
  }

  // Package flows (e.g. Bosphorus): use frozen snapshot totals — no new FX conversion.
  if (draft.appliedVehicleTotalEur == null) {
    return;
  }
  const total = frozenPackageTotalFromSnapshot(draft);
  await writeAppliedVehicle(id, {
    code: null,
    labelCustomer: draft.appliedVehicleLabelCustomer,
    labelTr: draft.appliedVehicleLabelTr,
    totalEur: draft.appliedVehicleTotalEur,
    total,
  });
}

function locationValueFromDraftLocation(stored: DraftLocation): LocationValue {
  const restoredProvince =
    stored.provinceCode && stored.provinceCode !== "other"
      ? stored.provinceCode
      : null;
  return {
    source: stored.placeId ? "google" : "query",
    name: stored.nameCustomer?.trim() ?? "",
    formattedAddress: stored.addressCustomer,
    placeId: stored.placeId,
    lat: stored.latitude,
    lng: stored.longitude,
    city: restoredProvince,
    district: stored.districtCode,
    region: null,
    country: null,
    countryCode: null,
    airportCode: stored.airportCode,
    type: stored.locationType === "airport" ? "airport" : stored.nameCustomer ? "place" : null,
    placeTypes: stored.locationType === "airport" ? ["airport"] : null,
  };
}

function tripViewForDirtyCheck(trip: DraftTrip): BookingTripView {
  return {
    pickup: locationValueFromDraftLocation(trip.pickup),
    dropoff: locationValueFromDraftLocation(trip.dropoff),
    pickupAtLocal: trip.pickupAt ? timestamptzToIstanbulLocal(trip.pickupAt) : "",
    distanceKm: trip.distanceKm,
    durationHours: trip.durationHours,
    passengerCount: trip.passengerCount,
    luggageCount: trip.luggageCount,
    babySeatCount: trip.babySeatCount,
    meetAndGreet: trip.meetAndGreet,
    flightCode: trip.flightCode,
    bursaRoute: trip.bursaRoute,
    bosphorusPax: trip.bosphorusPax,
  };
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
  if (
    hasUnappliedTripChanges(
      tripViewForDirtyCheck(existing.selected),
      tripViewForDirtyCheck(existing.applied),
    )
  ) {
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
  const resolvedFields =
    fields.serviceType === HOURLY_SERVICE_TYPE ||
    isLayoverTour(fields.serviceType, fields.tourCode)
      ? {
          ...fields,
          distanceKm: await computeHourlyDropoffDistanceKm(
            fields.pickup,
            fields.dropoff,
          ),
        }
      : isNoKmPackageTour(fields.serviceType, fields.tourCode) ||
          isBosphorusDinnerTour(fields.serviceType, fields.tourCode)
        ? { ...fields, distanceKm: null }
        : fields;
  const existing = await findActiveDraft(browserSessionId);
  let id: string;
  let created = false;
  if (existing) {
    id = await updateDraft(existing.id, resolvedFields);
  } else {
    try {
      id = await insertDraft(browserSessionId, resolvedFields);
      created = true;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const raced = await findActiveDraft(browserSessionId);
      if (!raced) {
        throw error;
      }
      id = await updateDraft(raced.id, resolvedFields);
    }
  }
  await storeAppliedTransferQuote(id);
  return { id, created };
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

export async function computeHourlyDropoffDistanceKm(
  pickup: DraftLocation | PersistedLocation,
  dropoff: DraftLocation | PersistedLocation,
) {
  if (!isDraftLocationFilled(pickup) || !isDraftLocationFilled(dropoff)) {
    return 0;
  }
  if (draftLocationsRepresentSamePlace(pickup, dropoff)) {
    return 0;
  }
  return computeSelectedDistanceKm(pickup, dropoff);
}

export type SelectedTripPatch = {
  tourCode?: string | null;
  pickup?: PersistedLocation;
  dropoff?: PersistedLocation;
  pickupAt?: Date;
  durationHours?: number | null;
  passengerCount?: number | null;
  luggageCount?: number | null;
  babySeatCount?: number | null;
  meetAndGreet?: boolean | null;
  flightCode?: string | null;
  currency?: string | null;
  bursaRoute?: BursaRouteOption | null;
  bosphorusAdultSoft?: number | null;
  bosphorusAdultAlcohol?: number | null;
  bosphorusChild5to9?: number | null;
  bosphorusChild0to4?: number | null;
};

export type ClearDraftFields = {
  pickup?: boolean;
  dropoff?: boolean;
  pickupAt?: boolean;
  durationHours?: boolean;
  tourCode?: boolean;
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
  if (fields.durationHours) {
    assignments.push(
      "selected_duration_hours = NULL",
      "applied_duration_hours = NULL",
    );
  }
  if (fields.tourCode) {
    assignments.push("tour_code = NULL", "selected_tour_code = NULL");
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

  const previousSelectedTourCode =
    existing.selected.tourCode ?? existing.tourCode;
  const selectedTourCode =
    patch.tourCode !== undefined
      ? patch.tourCode
      : (existing.selected.tourCode ?? existing.tourCode);
  const isHourly = existing.serviceType === HOURLY_SERVICE_TYPE;
  const layover = isLayoverTour(existing.serviceType, selectedTourCode);
  const noKmPackage = isNoKmPackageTour(
    existing.serviceType,
    selectedTourCode,
  );
  const bosphorus = isBosphorusDinnerTour(
    existing.serviceType,
    selectedTourCode,
  );
  const leavingBosphorus =
    patch.tourCode !== undefined &&
    isBosphorusDinnerTour(existing.serviceType, previousSelectedTourCode) &&
    !bosphorus;
  const enteringBosphorus =
    patch.tourCode !== undefined &&
    !isBosphorusDinnerTour(existing.serviceType, previousSelectedTourCode) &&
    bosphorus;
  const pickup = patch.pickup ?? existing.selected.pickup;
  const dropoff = patch.dropoff ?? existing.selected.dropoff;
  const pickupAt = patch.pickupAt ?? existing.selected.pickupAt;
  const syncAppliedPickupAt =
    patch.pickupAt !== undefined &&
    bosphorus &&
    existing.currentStage === CHECKOUT_STAGE;
  const durationHours = normalizeDurationHours(
    patch.durationHours !== undefined
      ? patch.durationHours
      : existing.selected.durationHours,
  );
  const existingBosphorus = existing.selected.bosphorusPax ?? emptyBosphorusPaxCounts();
  const bosphorusPax = bosphorus
    ? clampBosphorusPaxAdultRule({
        adultSoft:
          patch.bosphorusAdultSoft !== undefined
            ? (patch.bosphorusAdultSoft ?? 0)
            : existingBosphorus.adultSoft,
        adultAlcohol:
          patch.bosphorusAdultAlcohol !== undefined
            ? (patch.bosphorusAdultAlcohol ?? 0)
            : existingBosphorus.adultAlcohol,
        child5to9:
          patch.bosphorusChild5to9 !== undefined
            ? (patch.bosphorusChild5to9 ?? 0)
            : existingBosphorus.child5to9,
        child0to4:
          patch.bosphorusChild0to4 !== undefined
            ? (patch.bosphorusChild0to4 ?? 0)
            : existingBosphorus.child0to4,
      })
    : null;
  const passengerCount = bosphorus
    ? enteringBosphorus
      ? existing.selected.passengerCount
      : bosphorusTotalPax(bosphorusPax ?? emptyBosphorusPaxCounts())
    : normalizeOccupancyCount(
        patch.passengerCount !== undefined
          ? patch.passengerCount
          : leavingBosphorus
            ? null
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
  const bursaRoute =
    patch.bursaRoute !== undefined
      ? patch.bursaRoute
      : existing.selected.bursaRoute;
  const currency =
    patch.currency !== undefined
      ? patch.currency
      : (existing.currency ?? DEFAULT_DISPLAY_CURRENCY);
  const locationChanged = Boolean(
    patch.pickup || patch.dropoff || patch.tourCode !== undefined,
  );
  if (bosphorus && pickup.provinceCode !== "istanbul") {
    throw new UntrustedLocationError();
  }

  let distanceKm = existing.selected.distanceKm;
  let distanceError = false;
  if (locationChanged) {
    if (isHourly || layover) {
      distanceKm = await computeHourlyDropoffDistanceKm(pickup, dropoff);
      distanceError = distanceKm === null;
    } else if (noKmPackage || bosphorus) {
      distanceKm = null;
      distanceError = false;
    } else {
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
       applied_pickup_at = CASE WHEN $40::boolean THEN $21 ELSE applied_pickup_at END,
       selected_distance_km = $22,
       selected_passenger_count = $23,
       selected_luggage_count = $24,
       selected_baby_seat_count = $25,
       selected_meet_and_greet = $26,
       selected_flight_code = $27,
       selected_bursa_route = $28,
       selected_pickup_province_code = $29,
       selected_pickup_district_code = $30,
       selected_dropoff_province_code = $31,
       selected_dropoff_district_code = $32,
       currency = $33,
       selected_duration_hours = $34,
       selected_bosphorus_adult_soft = $35,
       selected_bosphorus_adult_alcohol = $36,
       selected_bosphorus_child_5_9 = $37,
       selected_bosphorus_child_0_4 = $38,
       selected_tour_code = $41
     WHERE id = $1
       AND browser_session_id = $2
       AND status = $39
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
      bursaRoute,
      pickup.provinceCode,
      pickup.districtCode,
      dropoff.provinceCode,
      dropoff.districtCode,
      currency,
      isHourly
        ? durationHours
        : packageTourDurationHours(existing.serviceType, selectedTourCode),
      bosphorus ? (bosphorusPax?.adultSoft ?? 0) : null,
      bosphorus ? (bosphorusPax?.adultAlcohol ?? 0) : null,
      bosphorus ? (bosphorusPax?.child5to9 ?? 0) : null,
      bosphorus ? (bosphorusPax?.child0to4 ?? 0) : null,
      DRAFT_STATUS,
      syncAppliedPickupAt,
      selectedTourCode,
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
  const selectedTourCode = existing.selected.tourCode ?? existing.tourCode;
  const isHourly = existing.serviceType === HOURLY_SERVICE_TYPE;
  const layover = isLayoverTour(existing.serviceType, selectedTourCode);
  const noKmPackage = isNoKmPackageTour(
    existing.serviceType,
    selectedTourCode,
  );
  const bosphorus = isBosphorusDinnerTour(
    existing.serviceType,
    selectedTourCode,
  );
  const previouslyBosphorus = isBosphorusDinnerTour(
    existing.serviceType,
    existing.tourCode,
  );
  if (isHourly) {
    if (
      existing.selected.durationHours === null ||
      existing.selected.pickupAt === null ||
      !isDraftLocationFilled(existing.selected.pickup)
    ) {
      return { status: "incomplete" as const, draft: existing };
    }
  } else if (layover) {
    if (
      existing.selected.pickupAt === null ||
      !isDraftLocationFilled(existing.selected.pickup) ||
      (existing.selected.pickup.airportCode !== "IST" &&
        existing.selected.pickup.airportCode !== "SAW")
    ) {
      return { status: "incomplete" as const, draft: existing };
    }
  } else if (noKmPackage) {
    if (
      existing.selected.pickupAt === null ||
      !isDraftLocationFilled(existing.selected.pickup)
    ) {
      return { status: "incomplete" as const, draft: existing };
    }
  } else if (bosphorus) {
    if (
      existing.selected.pickupAt === null ||
      !isDraftLocationFilled(existing.selected.pickup)
    ) {
      return { status: "incomplete" as const, draft: existing };
    }
  } else if (
    existing.selected.distanceKm === null ||
    existing.selected.pickupAt === null
  ) {
    return { status: "incomplete" as const, draft: existing };
  }

  const selectedBosphorus =
    existing.selected.bosphorusPax ?? emptyBosphorusPaxCounts();
  const previousAppliedBosphorus =
    existing.applied.bosphorusPax ?? emptyBosphorusPaxCounts();
  const passengerCount = bosphorus
    ? bosphorusTotalPax(selectedBosphorus)
    : normalizeOccupancyCount(
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
       tour_code = COALESCE(selected_tour_code, tour_code),
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
       applied_duration_hours = selected_duration_hours,
       selected_passenger_count = $4,
       applied_passenger_count = $4,
       selected_luggage_count = $5,
       applied_luggage_count = $5,
       selected_baby_seat_count = $6,
       applied_baby_seat_count = $6,
       selected_meet_and_greet = $7,
       applied_meet_and_greet = $7,
       applied_flight_code = selected_flight_code,
       applied_bursa_route = selected_bursa_route,
       applied_bosphorus_adult_soft = selected_bosphorus_adult_soft,
       applied_bosphorus_adult_alcohol = selected_bosphorus_adult_alcohol,
       applied_bosphorus_child_5_9 = selected_bosphorus_child_5_9,
       applied_bosphorus_child_0_4 = selected_bosphorus_child_0_4,
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
       AND selected_pickup_at IS NOT NULL
       AND (
         (service_type = $12 AND selected_duration_hours IS NOT NULL)
         OR (
           service_type = $13
           AND COALESCE(selected_tour_code, tour_code) IN ($14, $15, $16, $17, $18)
         )
         OR (
           service_type IS DISTINCT FROM $12
           AND NOT (
             service_type = $13
             AND COALESCE(selected_tour_code, tour_code) IN ($14, $15, $16, $17, $18)
           )
           AND selected_distance_km IS NOT NULL
         )
       )
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
      HOURLY_SERVICE_TYPE,
      TOUR_SERVICE_TYPE,
      HALF_DAY_TOUR_CODE,
      FULL_DAY_TOUR_CODE,
      SAPANCA_TOUR_CODE,
      BURSA_TOUR_CODE,
      BOSPHORUS_DINNER_TOUR_CODE,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    return { status: "incomplete" as const, draft: existing };
  }
  if (
    previouslyBosphorus !== bosphorus ||
    (bosphorus &&
      (previousAppliedBosphorus.adultSoft !== selectedBosphorus.adultSoft ||
        previousAppliedBosphorus.adultAlcohol !==
          selectedBosphorus.adultAlcohol ||
        previousAppliedBosphorus.child5to9 !== selectedBosphorus.child5to9 ||
        previousAppliedBosphorus.child0to4 !== selectedBosphorus.child0to4))
  ) {
    await clearAppliedVehicle(row.id);
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
  const bosphorusCheckoutOk =
    isBosphorusDinnerTour(existing.serviceType, existing.tourCode) &&
    existing.appliedVehicleTotal != null;
  if (
    stage === CHECKOUT_STAGE &&
    !existing.appliedVehicleCode &&
    !bosphorusCheckoutOk
  ) {
    return { status: "incomplete" as const, draft: existing };
  }
  await setDraftStageById(existing.id, stage);
  const next = await findActiveDraft(browserSessionId);
  return next
    ? { status: "ok" as const, draft: next }
    : { status: "missing" as const };
}

export async function applyBosphorusPackage(
  browserSessionId: string,
  locale: Locale,
): Promise<
  | { status: "ok"; draft: ActiveDraft }
  | { status: "missing" }
  | { status: "incomplete"; draft: ActiveDraft }
> {
  let existing = await findActiveDraft(browserSessionId);
  if (!existing) {
    return { status: "missing" };
  }
  if (!isBosphorusDinnerTour(existing.serviceType, existing.tourCode)) {
    return { status: "incomplete", draft: existing };
  }

  if (
    hasUnappliedTripChanges(
      tripViewForDirtyCheck(existing.selected),
      tripViewForDirtyCheck(existing.applied),
    )
  ) {
    const applied = await applySelectedTripToApplied(browserSessionId);
    if (applied.status === "missing") {
      return { status: "missing" };
    }
    if (applied.status !== "ok") {
      return { status: "incomplete", draft: applied.draft };
    }
    existing = applied.draft;
  }

  const counts = existing.applied.bosphorusPax ?? emptyBosphorusPaxCounts();
  if (!bosphorusHasBookablePax(counts)) {
    return { status: "incomplete", draft: existing };
  }

  const airportCode = pickupAirportCode(existing.applied.pickup);
  const meetAndGreet = normalizeMeetAndGreet(
    existing.applied.pickup,
    existing.applied.meetAndGreet,
  );
  const totalEur = quoteBosphorusDinnerPackageTotalEur(
    counts,
    airportCode,
    meetAndGreet,
  );
  const book = await getActiveFxBook();
  const snapshot = buildFxSnapshot(totalEur, book);
  const currency = normalizeDisplayCurrency(existing.currency);
  const totalRaw = snapshot.totals[currency];
  const total =
    totalRaw != null && String(totalRaw).trim() !== ""
      ? Number(totalRaw)
      : totalEur;

  const tourName =
    bookingCopy[locale].tours[BOSPHORUS_DINNER_TOUR_CODE] ??
    bookingCopy.en.tours[BOSPHORUS_DINNER_TOUR_CODE];
  const tourNameTr = bookingCopy.tr.tours[BOSPHORUS_DINNER_TOUR_CODE];

  await query(
    `UPDATE reservation_searches
     SET applied_transfer_quote = $2::jsonb,
         applied_transfer_pricing_version = $3,
         applied_price = $4,
         applied_fx_snapshot = $5::jsonb,
         currency = COALESCE(currency, $6)
     WHERE id = $1
       AND status = $7`,
    [
      existing.id,
      JSON.stringify(
        quoteBosphorusDinnerBase(
          counts,
          await geoFromLocation(existing.applied.pickup),
          await geoFromLocation(existing.applied.dropoff),
          airportCode,
          meetAndGreet,
        ),
      ),
      BOSPHORUS_DINNER_PRICING_VERSION,
      totalEur,
      JSON.stringify(snapshot),
      DEFAULT_DISPLAY_CURRENCY,
      DRAFT_STATUS,
    ],
  );

  await writeAppliedVehicle(existing.id, {
    code: null,
    labelCustomer: tourName,
    labelTr: tourNameTr,
    totalEur,
    total: Number.isFinite(total) ? total : totalEur,
  });
  await setDraftStageById(existing.id, CHECKOUT_STAGE);

  const next = await findActiveDraft(browserSessionId);
  if (!next) {
    return { status: "missing" };
  }
  return { status: "ok", draft: next };
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

