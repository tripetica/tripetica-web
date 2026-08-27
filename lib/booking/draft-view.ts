import { type LocationValue } from "@/lib/booking/types";
import { type Locale } from "@/lib/i18n/config";
import { type CurrencyTotalView, type DisplayCurrency } from "@/lib/booking/pricing/format-eur";
import { type FxRateQuote } from "@/lib/booking/fx/types";

export type BookingTripView = {
  pickup: LocationValue;
  dropoff: LocationValue;
  pickupAtLocal: string;
  distanceKm: number | null;
  passengerCount: number | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  meetAndGreet: boolean | null;
  flightCode: string | null;
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
  currentStage: "selection" | "checkout";
  selected: BookingTripView;
  applied: BookingTripView;
  distanceError: boolean;
  transferQuote: TransferQuoteView | null;
  vehicleQuotes: VehicleQuoteView[];
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
};

export function intlLocale(locale: Locale) {
  if (locale === "ru") {
    return "ru-RU";
  }
  if (locale === "tr") {
    return "tr-TR";
  }
  return "en-GB";
}

export function formatDistanceKm(km: number, locale: Locale) {
  const value = (Math.round(km * 10) / 10).toFixed(1);
  if (locale === "en") {
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

function sameLocation(a: LocationValue, b: LocationValue) {
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

export function appliedTripFingerprint(applied: BookingTripView) {
  return [
    applied.pickupAtLocal,
    applied.distanceKm ?? "",
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
  ].join("|");
}

export function isTripSelectionDirty(
  selected: BookingTripView,
  applied: BookingTripView,
) {
  if (selected.pickupAtLocal !== applied.pickupAtLocal) {
    return true;
  }
  if (selected.distanceKm !== applied.distanceKm) {
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
  return (
    !sameLocation(selected.pickup, applied.pickup) ||
    !sameLocation(selected.dropoff, applied.dropoff)
  );
}
