import { type UetdsDraft } from "@/lib/uetds/draft";
import { type UetdsLocation } from "@/lib/uetds/location";

export type AiEditSnapshotMeta = {
  notificationId: string;
  partnerId: string;
  companyId: string | null;
  companyName: string;
  seferReference: string | null;
  plate: string;
  driverName: string;
  vehicleLabel: string;
};

export type AiEditLocationSnapshot = {
  place: string;
  countryCode: string;
  provinceCode: string;
  provinceName: string;
  locationType: string;
  districtOrAirportCode: string;
  districtOrAirportName: string;
  placeName: string;
};

export type AiEditPassengerSnapshot = {
  index: number;
  nationality: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  ministryReference: string | null;
};

export type AiEditSnapshot = {
  notificationId: string;
  partnerId: string;
  companyId: string | null;
  companyName: string;
  seferReference: string | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  plate: string;
  driverName: string;
  driverId: string;
  vehicleId: string;
  vehicleLabel: string;
  origin: AiEditLocationSnapshot;
  destination: AiEditLocationSnapshot;
  groupName: string;
  fare: string;
  purpose: string;
  tripKind: string;
  passengers: AiEditPassengerSnapshot[];
};

export type AiEditPassengerChange = {
  old_index: number;
  old: {
    nationality: string;
    document_number: string;
    first_name: string;
    last_name: string;
    gender: string;
  };
  new: {
    nationality: string;
    document_number: string;
    first_name: string;
    last_name: string;
    gender: string;
  };
};

export type AiEditChangePlan = {
  pickup_changed: boolean;
  dropoff_changed: boolean;
  start_datetime_changed: boolean;
  end_datetime_changed: boolean;
  trip_kind_changed: boolean;
  fare_changed: boolean;
  group_changed: boolean;
  purpose_changed: boolean;
  plate_changed: boolean;
  driver_changed: boolean;
  vehicle_changed: boolean;
  passenger_changes: AiEditPassengerChange[];
};

function locationSnapshot(place: string, location: UetdsLocation): AiEditLocationSnapshot {
  return {
    place,
    countryCode: location.countryCode,
    provinceCode: location.provinceCode,
    provinceName: location.provinceName,
    locationType: location.locationType,
    districtOrAirportCode: location.districtOrAirportCode,
    districtOrAirportName: location.districtOrAirportName,
    placeName: location.placeName,
  };
}

function sameLocation(left: AiEditLocationSnapshot, right: AiEditLocationSnapshot) {
  return (
    left.place === right.place &&
    left.countryCode === right.countryCode &&
    left.provinceCode === right.provinceCode &&
    left.provinceName === right.provinceName &&
    left.locationType === right.locationType &&
    left.districtOrAirportCode === right.districtOrAirportCode &&
    left.districtOrAirportName === right.districtOrAirportName &&
    left.placeName === right.placeName
  );
}

export function captureAiEditSnapshot(draft: UetdsDraft, meta: AiEditSnapshotMeta): AiEditSnapshot {
  return {
    notificationId: meta.notificationId,
    partnerId: meta.partnerId,
    companyId: meta.companyId,
    companyName: meta.companyName,
    seferReference: meta.seferReference,
    startDate: draft.startDate,
    startTime: draft.startTime,
    endDate: draft.endDate,
    endTime: draft.endTime,
    plate: meta.plate,
    driverName: meta.driverName,
    driverId: draft.driverId,
    vehicleId: draft.vehicleId,
    vehicleLabel: meta.vehicleLabel,
    origin: locationSnapshot(draft.origin, draft.originLocation),
    destination: locationSnapshot(draft.destination, draft.destinationLocation),
    groupName: draft.groupName,
    fare: draft.fare,
    purpose: draft.purpose,
    tripKind: draft.tripKind,
    passengers: draft.passengers.map((passenger, index) => ({
      index: index + 1,
      nationality: passenger.nationality,
      documentNumber: passenger.identityNumber,
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      gender: passenger.gender,
      ministryReference: passenger.ministryReference,
    })),
  };
}

function passengerChange(previous: AiEditSnapshot["passengers"][number], next: AiEditSnapshot["passengers"][number]): AiEditPassengerChange | null {
  const oldPerson = {
    nationality: previous.nationality,
    document_number: previous.documentNumber,
    first_name: previous.firstName,
    last_name: previous.lastName,
    gender: previous.gender,
  };
  const newPerson = {
    nationality: next.nationality,
    document_number: next.documentNumber,
    first_name: next.firstName,
    last_name: next.lastName,
    gender: next.gender,
  };
  if (
    oldPerson.nationality === newPerson.nationality &&
    oldPerson.document_number === newPerson.document_number &&
    oldPerson.first_name === newPerson.first_name &&
    oldPerson.last_name === newPerson.last_name &&
    oldPerson.gender === newPerson.gender
  ) {
    return null;
  }
  return { old_index: previous.index, old: oldPerson, new: newPerson };
}

export function diffAiEditSnapshots(previous: AiEditSnapshot, next: AiEditSnapshot): AiEditChangePlan {
  const passenger_changes: AiEditPassengerChange[] = [];
  const count = Math.max(previous.passengers.length, next.passengers.length);
  for (let index = 0; index < count; index += 1) {
    const oldRow = previous.passengers[index];
    const newRow = next.passengers[index];
    if (!oldRow || !newRow) continue;
    const change = passengerChange(oldRow, newRow);
    if (change) passenger_changes.push(change);
  }
  return {
    pickup_changed: !sameLocation(previous.origin, next.origin),
    dropoff_changed: !sameLocation(previous.destination, next.destination),
    start_datetime_changed: previous.startDate !== next.startDate || previous.startTime !== next.startTime,
    end_datetime_changed: previous.endDate !== next.endDate || previous.endTime !== next.endTime,
    trip_kind_changed: previous.tripKind !== next.tripKind,
    fare_changed: previous.fare !== next.fare,
    group_changed: previous.groupName !== next.groupName,
    purpose_changed: previous.purpose !== next.purpose,
    plate_changed: previous.plate !== next.plate,
    driver_changed: previous.driverId !== next.driverId || previous.driverName !== next.driverName,
    vehicle_changed: previous.vehicleId !== next.vehicleId || previous.vehicleLabel !== next.vehicleLabel,
    passenger_changes,
  };
}

export type PortalNextDraft = {
  pickup: { provinceName: string; districtName: string; placeName: string };
  dropoff: { provinceName: string; districtName: string; placeName: string };
  passengers: Array<{ nationality: string; documentNumber: string; firstName: string; lastName: string; gender: string }>;
};

export function portalNextDraftFromSnapshot(snapshot: AiEditSnapshot): PortalNextDraft {
  return {
    pickup: {
      provinceName: snapshot.origin.provinceName,
      districtName: snapshot.origin.districtOrAirportName,
      placeName: snapshot.origin.placeName,
    },
    dropoff: {
      provinceName: snapshot.destination.provinceName,
      districtName: snapshot.destination.districtOrAirportName,
      placeName: snapshot.destination.placeName,
    },
    passengers: snapshot.passengers.map((passenger) => ({
      nationality: passenger.nationality,
      documentNumber: passenger.documentNumber,
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      gender: passenger.gender,
    })),
  };
}

export function planAiEditContinue(input: {
  existingOld: AiEditSnapshot | null;
  originalDraft: UetdsDraft;
  currentDraft: UetdsDraft;
  meta: AiEditSnapshotMeta;
  authorityId: string;
}) {
  const old = input.existingOld ?? captureAiEditSnapshot(input.originalDraft, input.meta);
  const next = captureAiEditSnapshot(input.currentDraft, input.meta);
  return {
    old,
    next,
    plan: diffAiEditSnapshots(old, next),
    openLogin: input.authorityId.trim().length > 0,
  };
}
