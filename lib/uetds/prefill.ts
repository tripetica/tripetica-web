import { timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import { normalizeIso2 } from "@/lib/geo/countries";
import {
  createEmptyDraft,
  createPassengerDraft,
  emptyPassengerProvenance,
  emptyTripProvenance,
  ensurePassengerCount,
  identityTypeFromValue,
  purposeForTripKind,
  syncDraftLocations,
  type UetdsDraft,
  type UetdsFieldProvenance,
  type UetdsTripKind,
} from "@/lib/uetds/draft";
import { partnerPassengerIdentityFields } from "@/lib/partner/job-view";
import { resolveUetdsLocationFromReservationPlace } from "@/lib/uetds/reservation-location";

export const UETDS_EMPTY_IDENTITY_PREFILL = "11111111111";

export type UetdsReservationPrefillPassenger = {
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  identityNumber: string | null;
  gender: string | null;
};

export type UetdsReservationPlacePrefill = {
  name: string | null;
  address: string | null;
  placeId: string | null;
  locationType: string | null;
  airportCode: string | null;
};

export type UetdsReservationPrefillInput = {
  reservationId: string;
  pickupName: string | null;
  dropoffName: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  pickupPlaceId?: string | null;
  dropoffPlaceId?: string | null;
  pickupLocationType?: string | null;
  dropoffLocationType?: string | null;
  pickupAirportCode?: string | null;
  dropoffAirportCode?: string | null;
  pickupAt: string | null;
  passengerCount: number | null;
  serviceType: string | null;
  tourCode: string | null;
  notes: string | null;
  driverId: string | null;
  vehicleId: string | null;
  driverKind: string | null;
  vehicleKind: string | null;
  passengers: UetdsReservationPrefillPassenger[];
};

function reservationValue(value: string | null | undefined): { value: string; provenance: UetdsFieldProvenance } {
  const trimmed = value?.trim() ?? "";
  return { value: trimmed, provenance: trimmed ? "reservation" : "missing" };
}

function tripKindFromService(serviceType: string | null | undefined): UetdsTripKind {
  const folded = serviceType?.trim().toLocaleLowerCase("tr-TR") ?? "";
  if (folded.includes("tour") || folded.includes("tur")) {
    return "tour";
  }
  if (folded.includes("charter") || folded.includes("tahsis")) {
    return "charter";
  }
  return "transfer";
}

function mapGender(value: string | null | undefined): "" | "male" | "female" {
  if (value === "male" || value === "female") {
    return value;
  }
  return "";
}

export function prefillUetdsDraftFromReservation(input: UetdsReservationPrefillInput): UetdsDraft {
  const draft = createEmptyDraft("reservation");
  const pickup = reservationValue(input.pickupName);
  const dropoff = reservationValue(input.dropoffName);
  const local = input.pickupAt ? timestamptzToIstanbulLocal(input.pickupAt) : "";
  const startDate = local.slice(0, 10);
  const startTime = local.slice(11, 16);
  const tripKind = tripKindFromService(input.serviceType);
  const purpose = purposeForTripKind(tripKind);
  const driverId =
    input.driverKind === "registered" ? input.driverId?.trim() ?? "" : "";
  const vehicleId =
    input.vehicleKind === "registered" ? input.vehicleId?.trim() ?? "" : "";

  draft.reservationId = input.reservationId;
  draft.origin = pickup.value;
  draft.destination = dropoff.value;
  draft.originLocation = resolveUetdsLocationFromReservationPlace({
    name: pickup.value,
    address: input.pickupAddress ?? null,
    placeId: input.pickupPlaceId ?? null,
    locationType: input.pickupLocationType ?? null,
    airportCode: input.pickupAirportCode ?? null,
  });
  draft.destinationLocation = resolveUetdsLocationFromReservationPlace({
    name: dropoff.value,
    address: input.dropoffAddress ?? null,
    placeId: input.dropoffPlaceId ?? null,
    locationType: input.dropoffLocationType ?? null,
    airportCode: input.dropoffAirportCode ?? null,
  });
  draft.startDate = startDate;
  draft.startTime = startTime;
  draft.tripKind = tripKind;
  draft.purpose = purpose;
  draft.groupName = input.tourCode?.trim() ?? "";
  draft.driverId = driverId;
  draft.vehicleId = vehicleId;
  draft.fieldProvenance = {
    ...emptyTripProvenance(),
    origin: pickup.provenance,
    destination: dropoff.provenance,
    startDate: startDate ? "reservation" : "missing",
    startTime: startTime ? "reservation" : "missing",
    purpose: purpose ? "reservation" : "missing",
    groupName: draft.groupName ? "reservation" : "missing",
    driverId: driverId ? "reservation" : "missing",
    vehicleId: vehicleId ? "reservation" : "missing",
  };

  const known = input.passengers.map((passenger) => {
    const identity = partnerPassengerIdentityFields(passenger.identityNumber);
    const realIdentity = identity.nationalId || identity.passportNumber || "";
    const identityNumber = realIdentity || UETDS_EMPTY_IDENTITY_PREFILL;
    const nationality = normalizeIso2(passenger.countryCode) ?? "";
    const firstName = passenger.firstName?.trim() ?? "";
    const lastName = passenger.lastName?.trim() ?? "";
    const gender = mapGender(passenger.gender);
    return createPassengerDraft({
      firstName,
      lastName,
      nationality,
      identityNumber,
      identityType: identityTypeFromValue(identityNumber),
      gender,
      provenance: {
        ...emptyPassengerProvenance(),
        firstName: firstName ? "reservation" : "missing",
        lastName: lastName ? "reservation" : "missing",
        nationality: nationality ? "reservation" : "missing",
        identityNumber: realIdentity ? "reservation" : "suggested",
        gender: gender ? "reservation" : "missing",
      },
    });
  });
  const count = Math.max(input.passengerCount ?? 0, known.length, 1);
  draft.passengers = ensurePassengerCount(known, count).map((passenger) => {
    if (passenger.identityNumber.trim()) {
      return passenger;
    }
    return {
      ...passenger,
      identityNumber: UETDS_EMPTY_IDENTITY_PREFILL,
      identityType: identityTypeFromValue(UETDS_EMPTY_IDENTITY_PREFILL),
      provenance: {
        ...passenger.provenance,
        identityNumber: "suggested",
      },
    };
  });
  return syncDraftLocations(draft);
}

/** Keep user-picked Places; refresh reservation-sourced locations from current canonical resolve. */
export function mergeSavedReservationDraft(saved: UetdsDraft, fresh: UetdsDraft): UetdsDraft {
  const next = { ...saved };
  if (saved.fieldProvenance.origin !== "user") {
    next.originLocation = fresh.originLocation;
    next.origin = fresh.originLocation.placeName || fresh.origin;
    next.originReview = fresh.originLocation.review;
  }
  if (saved.fieldProvenance.destination !== "user") {
    next.destinationLocation = fresh.destinationLocation;
    next.destination = fresh.destinationLocation.placeName || fresh.destination;
    next.destinationReview = fresh.destinationLocation.review;
  }
  return syncDraftLocations(next);
}
