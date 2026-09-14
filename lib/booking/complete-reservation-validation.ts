import { isValidEmail } from "@/lib/booking/phone";
import { HOURLY_SERVICE_TYPE } from "@/lib/booking/pricing/hourly-pricing";
import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { resolveStoredPriceAmount, type ManualPriceTotals } from "@/lib/ops/price-override";

export const COMPLETION_CHECKOUT_STAGE = "checkout";

export type CompletionLocation = {
  nameCustomer: string | null;
  nameTr: string | null;
  addressCustomer: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  airportCode: string | null;
  locationType: string | null;
};

export type CompletionTrip = {
  pickup: CompletionLocation;
  dropoff: CompletionLocation;
  pickupAt: Date | null;
  distanceKm: number | null;
  durationHours: number | null;
  passengerCount: number | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  meetAndGreet: boolean | null;
  flightCode: string | null;
};

export type CompletionPassenger = {
  sequenceNo: number;
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  gender: "female" | "male" | null;
  isPrimaryPassenger: boolean;
};

export type CompletionDraft = {
  currentStage: string | null;
  serviceType: string | null;
  tourCode?: string | null;
  appliedVehicleCode: string | null;
  applied: CompletionTrip;
  selected: CompletionTrip;
  currency: string | null;
  appliedVehicleTotal: number | null;
  appliedFxSnapshot: unknown;
  priceManuallyOverridden?: boolean;
  manualPriceTotals?: ManualPriceTotals | null;
  customerEmail: string | null;
  customerPhone: string | null;
  passengers: CompletionPassenger[];
};

function trim(value: string | null | undefined) {
  return value?.trim() || "";
}

function sameText(a: string | null | undefined, b: string | null | undefined) {
  return trim(a) === trim(b);
}

function sameLocation(a: CompletionLocation, b: CompletionLocation) {
  return (
    sameText(a.nameCustomer, b.nameCustomer) &&
    sameText(a.nameTr, b.nameTr) &&
    sameText(a.addressCustomer, b.addressCustomer) &&
    sameText(a.placeId, b.placeId) &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    sameText(a.airportCode, b.airportCode) &&
    sameText(a.locationType, b.locationType)
  );
}

function isHourlyService(serviceType: string | null | undefined) {
  return serviceType === HOURLY_SERVICE_TYPE || serviceType === "hourly";
}

function serviceDoesNotUseDropoff(serviceType: string | null | undefined) {
  return isHourlyService(serviceType) || serviceType === "tour";
}

function locationReady(location: CompletionLocation) {
  return Boolean(trim(location.nameCustomer) || trim(location.nameTr));
}

export function draftTripIsDirty(draft: CompletionDraft) {
  const { selected, applied } = draft;
  if (selected.pickupAt?.getTime() !== applied.pickupAt?.getTime()) {
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
  if (!sameLocation(selected.pickup, applied.pickup)) {
    return true;
  }
  if (serviceDoesNotUseDropoff(draft.serviceType)) {
    return false;
  }
  return !sameLocation(selected.dropoff, applied.dropoff);
}

export function isPrimaryPassengerReady(passenger: CompletionPassenger | undefined) {
  if (!passenger?.isPrimaryPassenger) {
    return false;
  }
  return Boolean(
    trim(passenger.countryCode) &&
      trim(passenger.firstName) &&
      trim(passenger.lastName) &&
      (passenger.gender === "female" || passenger.gender === "male"),
  );
}

export function validateDraftForCashCompletion(draft: CompletionDraft) {
  if (draft.currentStage !== COMPLETION_CHECKOUT_STAGE) {
    return "checkout-stage";
  }
  const bosphorusPackage =
    isBosphorusDinnerTour(draft.serviceType, draft.tourCode) &&
    draft.appliedVehicleTotal != null;
  if (!draft.appliedVehicleCode && !bosphorusPackage) {
    return "vehicle";
  }
  if (!draft.applied.pickupAt) {
    return "pickup-at";
  }
  if (!locationReady(draft.applied.pickup)) {
    return "pickup";
  }
  if (isHourlyService(draft.serviceType)) {
    if (draft.applied.durationHours === null) {
      return "duration";
    }
  } else if (
    !serviceDoesNotUseDropoff(draft.serviceType) &&
    !locationReady(draft.applied.dropoff)
  ) {
    return "dropoff";
  }
  if (draftTripIsDirty(draft)) {
    return "unapplied-changes";
  }
  if (!trim(draft.customerEmail) || !isValidEmail(draft.customerEmail!)) {
    return "email";
  }
  if (!trim(draft.customerPhone)) {
    return "phone";
  }
  const primary = draft.passengers.find((item) => item.isPrimaryPassenger);
  if (!isPrimaryPassengerReady(primary)) {
    return "passenger";
  }
  const price = resolveStoredPriceAmount({
    currency: draft.currency,
    appliedVehicleTotal: draft.appliedVehicleTotal,
    fxSnapshot: draft.appliedFxSnapshot,
    priceManuallyOverridden: draft.priceManuallyOverridden,
    manualPriceTotals: draft.manualPriceTotals,
  });
  if (!price.amount || !price.currency) {
    return "price";
  }
  return null;
}
