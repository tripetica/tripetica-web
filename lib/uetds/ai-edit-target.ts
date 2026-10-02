import { type UetdsDraft } from "@/lib/uetds/draft";
import { lockUetdsNotificationIdentities } from "@/lib/uetds/firma-sefer-no";

export type AiEditSyncPassenger = {
  index: number;
  nationality: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
};

export type AiEditSyncPlace = {
  provinceName: string;
  districtName: string;
  placeName: string;
};

export type AiEditPortalSync = {
  unfinished: boolean;
  pickup: AiEditSyncPlace;
  dropoff: AiEditSyncPlace;
  passengers: AiEditSyncPassenger[];
};

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function placeOf(value: unknown, fallbackPlace = ""): AiEditSyncPlace {
  const row = record(value) ?? {};
  return {
    provinceName: text(row.provinceName),
    districtName: text(row.districtName) || text(row.districtOrAirportName),
    placeName: text(row.placeName) || fallbackPlace,
  };
}

function passengerOf(value: unknown, index: number): AiEditSyncPassenger {
  const row = record(value) ?? {};
  const gender = text(row.gender);
  return {
    index,
    nationality: text(row.nationality),
    documentNumber: text(row.documentNumber) || text(row.identityNumber),
    firstName: text(row.firstName),
    lastName: text(row.lastName),
    gender: gender === "male" || gender === "female" ? gender : "",
  };
}

export function readUnfinishedPortalSync(snapshot: unknown): AiEditPortalSync | null {
  const row = record(snapshot);
  const sync = record(row?.portalSync);
  if (!sync || sync.unfinished !== true || !Array.isArray(sync.passengers) || sync.passengers.length === 0) return null;
  return {
    unfinished: true,
    pickup: placeOf(sync.pickup),
    dropoff: placeOf(sync.dropoff),
    passengers: sync.passengers.map((item, index) => passengerOf(item, index + 1)),
  };
}

function visibleSource(snapshot: Record<string, unknown>): AiEditPortalSync {
  const trip = record(snapshot.trip) ?? {};
  const passengers = Array.isArray(snapshot.passengers) ? snapshot.passengers : [];
  return {
    unfinished: true,
    pickup: placeOf(trip.originLocation, text(trip.origin)),
    dropoff: placeOf(trip.destinationLocation, text(trip.destination)),
    passengers: passengers.map((item, index) => passengerOf(item, index + 1)),
  };
}

/**
 * The visible notification becomes the form's current TARGET.
 * Source identities used to find an existing ministry row stay in portalSync
 * until that sync finishes. A later ministry failure does not restore the previous form.
 */
export function applyAiEditTargetSnapshot(previous: unknown, draft: UetdsDraft): Record<string, unknown> {
  const snapshot = record(previous) ?? {};
  const trip = record(snapshot.trip) ?? {};
  const kept = readUnfinishedPortalSync(snapshot);
  const source = kept ?? visibleSource(snapshot);
  const previousPassengers = Array.isArray(snapshot.passengers) ? snapshot.passengers : [];
  const next = {
    ...snapshot,
    source: text(snapshot.source) || draft.source,
    reservationId: draft.reservationId,
    trip: {
      ...trip,
      origin: draft.origin.trim(),
      destination: draft.destination.trim(),
      originLocation: draft.originLocation,
      destinationLocation: draft.destinationLocation,
      startDate: text(trip.startDate),
      startTime: text(trip.startTime),
      endDate: text(trip.endDate),
      endTime: text(trip.endTime),
      tripKind: draft.tripKind,
      groupName: draft.groupName.trim(),
      purpose: draft.purpose.trim(),
      fare: draft.fare.trim(),
    },
    passengers: draft.passengers.map((passenger, index) => ({
      ...(record(previousPassengers[index]) ?? {}),
      nationality: passenger.nationality.trim(),
      identityType: passenger.identityType,
      identityNumber: passenger.identityNumber.trim(),
      firstName: passenger.firstName.trim(),
      lastName: passenger.lastName.trim(),
      gender: passenger.gender,
      ministryReference: passenger.ministryReference,
    })),
    driver: { ...(record(snapshot.driver) ?? {}), id: draft.driverId },
    vehicle: { ...(record(snapshot.vehicle) ?? {}), id: draft.vehicleId },
    portalSync: {
      unfinished: true,
      pickup: source.pickup,
      dropoff: source.dropoff,
      passengers: source.passengers,
    },
  };
  return lockUetdsNotificationIdentities(snapshot, next);
}

/** Clears the retry marker only. Visible trip and passengers stay the saved TARGET. */
export function finishAiEditPortalSync(snapshot: unknown): Record<string, unknown> | null {
  const row = record(snapshot);
  if (!row) return null;
  const sync = record(row.portalSync);
  if (!sync) return row;
  return { ...row, portalSync: { ...sync, unfinished: false } };
}
