import "server-only";

import { cookies } from "next/headers";
import {
  airportPresetByCode,
  locationFromAirportPreset,
} from "@/lib/booking/catalog";
import {
  BROWSER_SESSION_COOKIE,
  isBrowserSessionId,
} from "@/lib/booking/browser-session";
import { bookingCopy } from "@/lib/booking/copy";
import { type BookingDraftView, type BookingTripView } from "@/lib/booking/draft-view";
import { timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import { occupancyForVehicleQuotes } from "@/lib/booking/pricing/vehicle-quote";
import { normalizeDisplayCurrency } from "@/lib/booking/pricing/format-eur";
import { vehicleQuoteViewFromApplied, visibleVehicleQuoteViews } from "@/lib/booking/fx/vehicle-totals";
import { getActiveFxBook } from "@/lib/booking/fx/service";
import { snapshotMatchesTotal } from "@/lib/booking/fx/convert";
import {
  CHECKOUT_STAGE,
  findActiveDraft,
  storeAppliedTransferQuote,
  TRANSFER_SERVICE_TYPE,
  type ActiveDraft,
  type DraftLocation,
  type DraftTrip,
} from "@/lib/booking/reservation-search";
import {
  emptyLocation,
  isLocationFilled,
  type AirportCode,
  type LocationKind,
  type LocationValue,
  type TransferFormHydration,
} from "@/lib/booking/types";
import { type Locale } from "@/lib/i18n/config";

export type { TransferFormHydration };

const KNOWN_AIRPORT_CODES = new Set<AirportCode>(["IST", "SAW", "AYT"]);

function asAirportCode(value: string | null): AirportCode | null {
  const code = value?.trim().toUpperCase() ?? "";
  return KNOWN_AIRPORT_CODES.has(code as AirportCode)
    ? (code as AirportCode)
    : null;
}

function locationKind(locationType: string | null): LocationKind {
  return locationType === "airport" ? "airport" : "place";
}

export function locationFromDraftLocation(
  stored: DraftLocation,
  localeLabels: Record<AirportCode, string>,
): LocationValue {
  const airportCode = asAirportCode(stored.airportCode);
  if (airportCode && stored.locationType === "airport") {
    const preset = locationFromAirportPreset(
      airportPresetByCode(airportCode),
      localeLabels[airportCode],
    );
    return {
      ...preset,
      name: localeLabels[airportCode],
      formattedAddress: stored.addressCustomer ?? preset.formattedAddress,
      placeId: stored.placeId ?? preset.placeId,
      lat: stored.latitude ?? preset.lat,
      lng: stored.longitude ?? preset.lng,
      airportCode,
      type: "airport",
      placeTypes: ["airport"],
    };
  }

  return {
    source: stored.placeId ? "google" : "query",
    name: stored.nameCustomer?.trim() ?? "",
    formattedAddress: stored.addressCustomer,
    placeId: stored.placeId,
    lat: stored.latitude,
    lng: stored.longitude,
    city: null,
    district: null,
    region: null,
    country: null,
    countryCode: null,
    airportCode: stored.airportCode,
    type: stored.nameCustomer ? locationKind(stored.locationType) : null,
    placeTypes: stored.locationType === "airport" ? ["airport"] : null,
  };
}

/** @deprecated Use locationFromDraftLocation */
export const locationFromAppliedDraft = locationFromDraftLocation;

function tripView(
  trip: DraftTrip,
  localeLabels: Record<AirportCode, string>,
): BookingTripView {
  return {
    pickup: locationFromDraftLocation(trip.pickup, localeLabels),
    dropoff: locationFromDraftLocation(trip.dropoff, localeLabels),
    pickupAtLocal: trip.pickupAt ? timestamptzToIstanbulLocal(trip.pickupAt) : "",
    distanceKm: trip.distanceKm,
    passengerCount: trip.passengerCount,
    luggageCount: trip.luggageCount,
    babySeatCount: trip.babySeatCount,
    meetAndGreet: trip.meetAndGreet,
    flightCode: trip.flightCode,
  };
}

export async function draftToView(
  draft: ActiveDraft,
  locale: Locale,
  distanceError = false,
): Promise<BookingDraftView> {
  const labels = bookingCopy[locale].airports;
  const transferQuote = draft.appliedTransferQuote
    ? {
        openingFeeEur: draft.appliedTransferQuote.openingFeeEur,
        distanceFeeEur: draft.appliedTransferQuote.distanceFeeEur,
        locationSurchargeEur: draft.appliedTransferQuote.locationSurchargeEur,
        timeSurchargeEur: draft.appliedTransferQuote.timeSurchargeEur,
        baseTransferFeeEur: draft.appliedTransferQuote.baseTransferFeeEur,
        pricingVersion: draft.appliedTransferQuote.pricingVersion,
      }
    : null;
  const occupancy = occupancyForVehicleQuotes(
    draft.applied,
    draft.selected.meetAndGreet,
    draft.selected.pickup,
  );
  let book = null;
  if (draft.appliedTransferQuote) {
    const preview = vehicleQuoteViewFromApplied(
      draft.appliedTransferQuote,
      occupancy,
      { snapshot: draft.appliedFxSnapshot },
    );
    if (!snapshotMatchesTotal(draft.appliedFxSnapshot, preview.totalEur)) {
      book = await getActiveFxBook();
    }
  }
  const vehicleQuotes = draft.appliedTransferQuote
    ? visibleVehicleQuoteViews(draft.appliedTransferQuote, occupancy, {
        snapshot: draft.appliedFxSnapshot,
        book,
      })
    : [];
  return {
    id: draft.id,
    serviceType: draft.serviceType ?? TRANSFER_SERVICE_TYPE,
    currentStage: draft.currentStage === CHECKOUT_STAGE ? "checkout" : "selection",
    selected: tripView(draft.selected, labels),
    applied: tripView(draft.applied, labels),
    distanceError,
    transferQuote,
    vehicleQuotes,
    currency: normalizeDisplayCurrency(draft.currency),
    appliedVehicleCode: draft.appliedVehicleCode,
    appliedVehicleTotalEur: draft.appliedVehicleTotalEur,
    appliedVehicleTotal: draft.appliedVehicleTotal,
    customerEmail: draft.customerEmail,
    customerPhone: draft.customerPhone,
    customerCountryCode: draft.customerCountryCode,
    customerFirstName: draft.customerFirstName,
    customerLastName: draft.customerLastName,
    notes: draft.notes,
    passengers: draft.passengers.map((passenger) => ({
      sequenceNo: passenger.sequenceNo,
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      countryCode: passenger.countryCode,
      identityNumber: passenger.identityNumber,
      gender: passenger.gender,
      isPrimaryPassenger: passenger.isPrimaryPassenger,
    })),
  };
}

export async function loadHomepageTransferDraft(
  locale: Locale,
): Promise<TransferFormHydration | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(BROWSER_SESSION_COOKIE)?.value;
    if (!isBrowserSessionId(sessionId)) {
      return null;
    }

    const draft = await findActiveDraft(sessionId);
    if (!draft || draft.serviceType !== TRANSFER_SERVICE_TYPE) {
      return null;
    }

    const labels = bookingCopy[locale].airports;
    const pickup = locationFromDraftLocation(draft.applied.pickup, labels);
    const dropoff = locationFromDraftLocation(draft.applied.dropoff, labels);
    const pickupAtLocal = draft.applied.pickupAt
      ? timestamptzToIstanbulLocal(draft.applied.pickupAt)
      : "";
    if (
      !isLocationFilled(pickup) &&
      !isLocationFilled(dropoff) &&
      !pickupAtLocal
    ) {
      return null;
    }

    return {
      pickup: isLocationFilled(pickup) ? pickup : emptyLocation(),
      dropoff: isLocationFilled(dropoff) ? dropoff : emptyLocation(),
      pickupAtLocal,
    };
  } catch (error) {
    console.error("[Tripetica draft-hydration]", error);
    return null;
  }
}

export async function loadBookingDraftView(
  locale: Locale,
): Promise<BookingDraftView | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(BROWSER_SESSION_COOKIE)?.value;
    if (!isBrowserSessionId(sessionId)) {
      return null;
    }
    const draft = await findActiveDraft(sessionId);
    if (!draft || draft.serviceType !== TRANSFER_SERVICE_TYPE) {
      return null;
    }
    if (
      draft.applied.distanceKm !== null &&
      draft.applied.pickupAt &&
      (
        !draft.appliedTransferQuote ||
        draft.applied.pickup.provinceCode === "other" ||
        draft.applied.dropoff.provinceCode === "other"
      )
    ) {
      await storeAppliedTransferQuote(draft.id);
      const priced = await findActiveDraft(sessionId);
      if (priced) {
        return draftToView(priced, locale, priced.selected.distanceKm === null);
      }
    }
    return draftToView(draft, locale, draft.selected.distanceKm === null);
  } catch (error) {
    console.error("[Tripetica booking-draft]", error);
    return null;
  }
}
