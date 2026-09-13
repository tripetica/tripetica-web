import { isLocationFilled, type LocationValue } from "@/lib/booking/types";
import { intlLocaleTag, type Locale } from "@/lib/i18n/config";
import { hasAppliedPassengerCount } from "@/lib/booking/occupancy";
import { type CurrencyTotalView, type DisplayCurrency } from "@/lib/booking/pricing/format-eur";
import { type FxRateQuote } from "@/lib/booking/fx/types";
import { type BosphorusPaxCounts } from "@/lib/booking/pricing/bosphorus-dinner-pricing";

export type BookingTripView = {
  tourCode?: string | null;
  pickup: LocationValue;
  dropoff: LocationValue;
  pickupAtLocal: string;
  distanceKm: number | null;
  durationHours: number | null;
  passengerCount: number | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  meetAndGreet: boolean | null;
  flightCode: string | null;
  bursaRoute: string | null;
  bosphorusPax: BosphorusPaxCounts | null;
};

export type TransferQuoteView = {
  openingFeeEur: number;
  distanceFeeEur: number;
  locationSurchargeEur: number;
  timeSurchargeEur: number;
  baseTransferFeeEur: number;
  pricingVersion: string;
};

export type VehicleQuoteView = {
  vehicleCode: string;
  multiplier: number;
  baseServiceFeeEur: number;
  extraPassengerFeeEur: number;
  extraLuggageFeeEur: number;
  babySeatFeeEur: number;
  meetAndGreetFeeEur: number;
  totalEur: number;
  totals: CurrencyTotalView[];
  fxRates: Partial<Record<DisplayCurrency, FxRateQuote>>;
};

export type BookingPassengerView = {
  sequenceNo: number;
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  identityNumber: string | null;
  gender: "female" | "male" | null;
  isPrimaryPassenger: boolean;
};

export type BookingDraftView = {
  id: string;
  serviceType: string;
  tourCode: string | null;
  currentStage: "selection" | "checkout";
  selected: BookingTripView;
  applied: BookingTripView;
  distanceError: boolean;
  transferQuote: TransferQuoteView | null;
  vehicleQuotes: VehicleQuoteView[];
  /** Live / snapshot FX quotes for package flows without vehicle cards (e.g. Bosphorus). */
  fxRates: Partial<Record<DisplayCurrency, FxRateQuote>>;
  /** Frozen snapshot currency totals for package flows (precise prepared amounts). */
  fxTotals: Partial<Record<DisplayCurrency, number | null>>;
  currency: DisplayCurrency;
  appliedVehicleCode: string | null;
  appliedVehicleTotalEur: number | null;
  appliedVehicleTotal: number | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCountryCode: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  notes: string | null;
  passengers: BookingPassengerView[];
  /** Edit-mode: original reservation financial snapshot for price-diff review. */
  editMode: boolean;
  opsEditMode: boolean;
  editReservationId: string | null;
  editReservationCode: string | null;
  editOriginalTotal: number | null;
  editOriginalCurrency: string | null;
  editPriceDifference: number | null;
  /** Ops-only: warn when inside customer 6h window (edit still allowed). */
  opsEditWithinSixHours: boolean;
};

export function intlLocale(locale: Locale) {
  return intlLocaleTag(locale);
}

export function formatDistanceKm(km: number, locale: Locale) {
  const value = (Math.round(km * 10) / 10).toFixed(1);
  if (locale === "en" || locale === "ar") {
    return value;
  }
  return value.replace(".", ",");
}

function roundCoord(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sameText(a: string | null | undefined, b: string | null | undefined) {
  return (a?.trim() || "") === (b?.trim() || "");
}

export function locationsEqual(a: LocationValue, b: LocationValue) {
  return (
    sameText(a.placeId, b.placeId) &&
    roundCoord(a.lat) === roundCoord(b.lat) &&
    roundCoord(a.lng) === roundCoord(b.lng) &&
    sameText(a.formattedAddress, b.formattedAddress) &&
    sameText(a.name, b.name) &&
    sameText(a.airportCode, b.airportCode) &&
    (a.type ?? null) === (b.type ?? null)
  );
}

/** True when two filled locations identify the same place (transfer same-stop check). */
export function locationsRepresentSamePlace(a: LocationValue, b: LocationValue) {
  if (!isLocationFilled(a) || !isLocationFilled(b)) {
    return false;
  }
  const placeA = a.placeId?.trim() ?? "";
  const placeB = b.placeId?.trim() ?? "";
  if (placeA && placeB) {
    return placeA === placeB;
  }
  const airportA = a.airportCode?.trim().toUpperCase() ?? "";
  const airportB = b.airportCode?.trim().toUpperCase() ?? "";
  if (airportA && airportB) {
    return airportA === airportB;
  }
  const latA = roundCoord(a.lat);
  const lngA = roundCoord(a.lng);
  const latB = roundCoord(b.lat);
  const lngB = roundCoord(b.lng);
  if (latA !== null && lngA !== null && latB !== null && lngB !== null) {
    return latA === latB && lngA === lngB;
  }
  return locationsEqual(a, b);
}

function sameLocation(a: LocationValue, b: LocationValue) {
  return locationsEqual(a, b);
}

export function cloneLocation(value: LocationValue): LocationValue {
  return {
    ...value,
    placeTypes: value.placeTypes ? [...value.placeTypes] : value.placeTypes,
  };
}

function locationIsBlank(location: LocationValue) {
  return (
    !(location.placeId?.trim()) &&
    roundCoord(location.lat) === null &&
    roundCoord(location.lng) === null &&
    !(location.formattedAddress?.trim()) &&
    !(location.name?.trim()) &&
    !(location.airportCode?.trim()) &&
    (location.type ?? null) === null
  );
}

export function appliedTripFingerprint(applied: BookingTripView) {
  return [
    applied.tourCode ?? "",
    applied.pickupAtLocal,
    applied.distanceKm ?? "",
    applied.durationHours ?? "",
    applied.pickup.placeId ?? "",
    applied.pickup.lat ?? "",
    applied.pickup.lng ?? "",
    applied.dropoff.placeId ?? "",
    applied.dropoff.lat ?? "",
    applied.dropoff.lng ?? "",
    applied.passengerCount ?? "",
    applied.luggageCount ?? "",
    applied.babySeatCount ?? "",
    applied.meetAndGreet ?? "",
    applied.flightCode ?? "",
    applied.bursaRoute ?? "",
    applied.bosphorusPax
      ? [
          applied.bosphorusPax.adultSoft,
          applied.bosphorusPax.adultAlcohol,
          applied.bosphorusPax.child5to9,
          applied.bosphorusPax.child0to4,
        ].join(",")
      : "",
  ].join("|");
}

function sameBosphorusPax(
  a: BosphorusPaxCounts | null,
  b: BosphorusPaxCounts | null,
) {
  if (a === null && b === null) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return (
    a.adultSoft === b.adultSoft &&
    a.adultAlcohol === b.adultAlcohol &&
    a.child5to9 === b.child5to9 &&
    a.child0to4 === b.child0to4
  );
}

export function isTripSelectionDirty(
  selected: BookingTripView,
  applied: BookingTripView,
) {
  if (!sameText(selected.tourCode, applied.tourCode)) {
    return true;
  }
  if (selected.pickupAtLocal !== applied.pickupAtLocal) {
    return true;
  }
  if (selected.distanceKm !== applied.distanceKm) {
    return true;
  }
  if (selected.durationHours !== applied.durationHours) {
    return true;
  }
  if (selected.passengerCount !== applied.passengerCount) {
    return true;
  }
  if (selected.luggageCount !== applied.luggageCount) {
    return true;
  }
  if (selected.babySeatCount !== applied.babySeatCount) {
    return true;
  }
  if (selected.meetAndGreet !== applied.meetAndGreet) {
    return true;
  }
  if (!sameText(selected.flightCode, applied.flightCode)) {
    return true;
  }
  if (!sameText(selected.bursaRoute, applied.bursaRoute)) {
    return true;
  }
  if (!sameBosphorusPax(selected.bosphorusPax, applied.bosphorusPax)) {
    return true;
  }
  if (!sameLocation(selected.pickup, applied.pickup)) {
    return true;
  }
  // Hourly dropoff stays empty; ignore differences when both sides are blank.
  if (locationIsBlank(selected.dropoff) && locationIsBlank(applied.dropoff)) {
    return false;
  }
  return !sameLocation(selected.dropoff, applied.dropoff);
}

export function hasUnappliedTripChanges(
  selected: BookingTripView,
  applied: BookingTripView,
) {
  return isTripSelectionDirty(selected, applied);
}

export function canSelectVehicle(
  selected: BookingTripView,
  applied: BookingTripView,
) {
  return (
    hasAppliedPassengerCount(applied.passengerCount) &&
    !hasUnappliedTripChanges(selected, applied)
  );
}
