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
import { computeEditPriceDifference } from "@/lib/booking/edit-price-diff";
import { hasMoreThanMutationWindowBeforePickup } from "@/lib/booking/customer-mutation-policy";
import { timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import { occupancyForVehicleQuotes } from "@/lib/booking/pricing/vehicle-quote";
import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { DISPLAY_CURRENCIES, normalizeDisplayCurrency } from "@/lib/booking/pricing/format-eur";
import { vehicleQuoteViewFromApplied, visibleVehicleQuoteViews } from "@/lib/booking/fx/vehicle-totals";
import { getActiveFxBook } from "@/lib/booking/fx/service";
import { snapshotMatchesTotal } from "@/lib/booking/fx/convert";
import {
  CHECKOUT_STAGE,
  findActiveDraft,
  HOURLY_SERVICE_TYPE,
  storeAppliedTransferQuote,
  TRANSFER_SERVICE_TYPE,
  TOUR_SERVICE_TYPE,
  type ActiveDraft,
  type DraftLocation,
  type DraftTrip,
} from "@/lib/booking/reservation-search";
import { isLayoverTour } from "@/lib/booking/pricing/layover-pricing";
import { isNoKmPackageTour } from "@/lib/booking/pricing/no-km-package-tour";
import {
  emptyLocation,
  isLocationFilled,
  type AirportCode,
  type LocationKind,
  type LocationValue,
  type ServiceType,
  type TourId,
  type TransferFormHydration,
} from "@/lib/booking/types";
import { type Locale } from "@/lib/i18n/config";

export type { TransferFormHydration };

/** Distance is N/A for hourly, layover, no-km packages, and Bosphorus dinner. */
function distanceErrorForDraft(draft: ActiveDraft, flagged: boolean): boolean {
  if (draft.serviceType === HOURLY_SERVICE_TYPE) {
    return false;
  }
  if (isLayoverTour(draft.serviceType, draft.tourCode)) {
    return false;
  }
  if (isNoKmPackageTour(draft.serviceType, draft.tourCode)) {
    return false;
  }
  if (isBosphorusDinnerTour(draft.serviceType, draft.tourCode)) {
    return false;
  }
  return flagged;
}

function homepageServiceType(value: string | null | undefined): ServiceType | null {
  if (value === HOURLY_SERVICE_TYPE || value === "hourly") {
    return "hourly";
  }
  if (value === TRANSFER_SERVICE_TYPE || value === "transfer") {
    return "transfer";
  }
  if (value === "tour") {
    return "tour";
  }
  return null;
}

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
      airportCode,
      type: "airport",
      placeTypes: ["airport"],
    };
  }

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
    tourCode: trip.tourCode,
    pickup: locationFromDraftLocation(trip.pickup, localeLabels),
    dropoff: locationFromDraftLocation(trip.dropoff, localeLabels),
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
    draft.applied.meetAndGreet,
    draft.applied.pickup,
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
  const vehicleQuotes =
    isBosphorusDinnerTour(draft.serviceType, draft.tourCode)
      ? []
      : draft.appliedTransferQuote
        ? visibleVehicleQuoteViews(draft.appliedTransferQuote, occupancy, {
            snapshot: draft.appliedFxSnapshot,
            book,
          })
        : [];
  const bosphorus = isBosphorusDinnerTour(draft.serviceType, draft.tourCode);
  let fxRates: BookingDraftView["fxRates"] = {};
  if (draft.appliedFxSnapshot?.rates) {
    fxRates = draft.appliedFxSnapshot.rates;
  } else if (bosphorus) {
    fxRates = await getActiveFxBook();
  } else {
    const appliedQuote = vehicleQuotes.find(
      (quote) => quote.vehicleCode === draft.appliedVehicleCode,
    );
    fxRates = appliedQuote?.fxRates ?? vehicleQuotes[0]?.fxRates ?? {};
  }
  const fxTotals: BookingDraftView["fxTotals"] = {};
  if (draft.appliedFxSnapshot?.totals) {
    for (const code of DISPLAY_CURRENCIES) {
      const raw = draft.appliedFxSnapshot.totals[code];
      if (raw == null || String(raw).trim() === "") {
        fxTotals[code] = null;
        continue;
      }
      const parsed = Number(raw);
      fxTotals[code] = Number.isFinite(parsed) ? parsed : null;
    }
  }
  return {
    id: draft.id,
    serviceType: draft.serviceType ?? TRANSFER_SERVICE_TYPE,
    tourCode: draft.tourCode,
    currentStage: draft.currentStage === CHECKOUT_STAGE ? "checkout" : "selection",
    selected: tripView(draft.selected, labels),
    applied: tripView(draft.applied, labels),
    distanceError: distanceErrorForDraft(draft, distanceError),
    transferQuote,
    vehicleQuotes,
    fxRates,
    fxTotals,
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
    editMode: Boolean(draft.editingOriginal),
    opsEditMode: Boolean(draft.editingOriginal?.opsUserId),
    editReservationId: draft.editingOriginal?.reservationId ?? null,
    editReservationCode: draft.editingOriginal?.reservationCode ?? null,
    editOriginalTotal: draft.editingOriginal?.totalPrice ?? null,
    editOriginalCurrency: draft.editingOriginal?.currency ?? null,
    editPriceDifference: computeEditPriceDifference({
      originalTotal: draft.editingOriginal?.totalPrice ?? null,
      originalCurrency: draft.editingOriginal?.currency ?? null,
      newTotal: draft.appliedVehicleTotal,
      newCurrency: draft.currency,
    }).difference,
    opsEditWithinSixHours: Boolean(
      draft.editingOriginal?.opsUserId &&
        draft.applied.pickupAt &&
        !hasMoreThanMutationWindowBeforePickup(draft.applied.pickupAt),
    ),
  };
}

export async function loadHomepageTransferDraft(
  locale: Locale,
): Promise<TransferFormHydration | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(BROWSER_SESSION_COOKIE)?.value;
  if (!isBrowserSessionId(sessionId)) {
    return null;
  }

  return loadHomepageTransferDraftForSession(sessionId, locale);
}

export async function loadHomepageTransferDraftForSession(
  sessionId: string,
  locale: Locale,
  findDraft: typeof findActiveDraft = findActiveDraft,
): Promise<TransferFormHydration | null> {
  if (!isBrowserSessionId(sessionId)) {
    return null;
  }

  try {
    const draft = await findDraft(sessionId);
    const labels = bookingCopy[locale].airports;
    const activeService = homepageServiceType(draft?.serviceType);
    if (draft && activeService) {
      const pickup = locationFromDraftLocation(draft.applied.pickup, labels);
      const dropoff = locationFromDraftLocation(draft.applied.dropoff, labels);
      const pickupAtLocal = draft.applied.pickupAt
        ? timestamptzToIstanbulLocal(draft.applied.pickupAt)
        : "";
      const durationHours =
        activeService === "hourly" ? draft.applied.durationHours : null;
      const hasTripFields =
        isLocationFilled(pickup) ||
        isLocationFilled(dropoff) ||
        Boolean(pickupAtLocal) ||
        durationHours !== null;

      if (!hasTripFields && activeService === "transfer") {
        return null;
      }

      return {
        serviceType: activeService,
        tourId: draft.tourCode as TourId | null,
        pickup: isLocationFilled(pickup) ? pickup : emptyLocation(),
        dropoff: isLocationFilled(dropoff) ? dropoff : emptyLocation(),
        pickupAtLocal,
        durationHours,
        currency: draft.currency,
        passengerCount: draft.applied.passengerCount,
        luggageCount: draft.applied.luggageCount,
        babySeatCount: draft.applied.babySeatCount,
        editMode: Boolean(draft.editingOriginal),
        opsEditMode: Boolean(draft.editingOriginal?.opsUserId),
        editReservationId: draft.editingOriginal?.reservationId ?? null,
        editReservationCode: draft.editingOriginal?.reservationCode ?? null,
        opsEditWithinSixHours: Boolean(
          draft.editingOriginal?.opsUserId &&
            draft.applied.pickupAt &&
            !hasMoreThanMutationWindowBeforePickup(draft.applied.pickupAt),
        ),
      };
    }

    return null;
  } catch (error) {
    console.error("[Tripetica draft-hydration]", error);
    return null;
  }
}

export async function loadBookingDraftView(
  locale: Locale,
): Promise<BookingDraftView | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(BROWSER_SESSION_COOKIE)?.value;
  if (!isBrowserSessionId(sessionId)) {
    return null;
  }

  try {
    const draft = await findActiveDraft(sessionId);
    if (
      !draft ||
      (draft.serviceType !== TRANSFER_SERVICE_TYPE &&
        draft.serviceType !== HOURLY_SERVICE_TYPE &&
        draft.serviceType !== TOUR_SERVICE_TYPE)
    ) {
      return null;
    }
    const isHourly = draft.serviceType === HOURLY_SERVICE_TYPE;
    const layover = isLayoverTour(draft.serviceType, draft.tourCode);
    const noKmPackage = isNoKmPackageTour(
      draft.serviceType,
      draft.tourCode,
    );
    const bosphorus = isBosphorusDinnerTour(draft.serviceType, draft.tourCode);
    const packageTour = layover || noKmPackage || bosphorus;
    const needsRepricing = isHourly || packageTour
      ? draft.applied.durationHours !== null &&
        Boolean(draft.applied.pickupAt) &&
        (
          !draft.appliedTransferQuote ||
          draft.applied.pickup.provinceCode === "other"
        )
      : draft.applied.distanceKm !== null &&
        Boolean(draft.applied.pickupAt) &&
        (
          !draft.appliedTransferQuote ||
          draft.applied.pickup.provinceCode === "other" ||
          draft.applied.dropoff.provinceCode === "other"
        );
    if (needsRepricing) {
      await storeAppliedTransferQuote(draft.id);
      const priced = await findActiveDraft(sessionId);
      if (priced) {
        return draftToView(
          priced,
          locale,
          isHourly || packageTour ? false : priced.selected.distanceKm === null,
        );
      }
    }
    return draftToView(
      draft,
      locale,
      isHourly || packageTour ? false : draft.selected.distanceKm === null,
    );
  } catch (error) {
    console.error("[Tripetica booking-draft]", error);
    return null;
  }
}
