import { replaceCount, type UetdsFormCopy } from "@/lib/uetds/copy";
import { type UetdsDraft, type UetdsPassengerDraft } from "@/lib/uetds/draft";
import { formatUetdsSnapshotDateTime } from "@/lib/uetds/edit-policy";
import { isExistingMinistryPassenger, passengerMinistryRef } from "@/lib/uetds/passenger-class";

function passengerSignature(passenger: UetdsPassengerDraft) {
  return [
    passenger.nationality,
    passenger.identityType,
    passenger.identityNumber.trim(),
    passenger.firstName.trim(),
    passenger.lastName.trim(),
    passenger.gender,
  ].join("|");
}

function samePassenger(left: UetdsPassengerDraft, right: UetdsPassengerDraft) {
  const leftRef = passengerMinistryRef(left);
  const rightRef = passengerMinistryRef(right);
  if (leftRef && rightRef) {
    return leftRef === rightRef;
  }
  return Boolean(left.key) && left.key === right.key;
}

function findMatch(passenger: UetdsPassengerDraft, list: UetdsPassengerDraft[]) {
  return list.find((item) => samePassenger(passenger, item)) ?? null;
}

export function diffUetdsEdit(original: UetdsDraft, edited: UetdsDraft) {
  const changed: string[] = [];
  if (original.startDate !== edited.startDate || original.startTime !== edited.startTime) {
    changed.push("start");
  }
  if (original.endDate !== edited.endDate || original.endTime !== edited.endTime) {
    changed.push("end");
  }
  if (original.purpose.trim() !== edited.purpose.trim()) {
    changed.push("purpose");
  }
  if (
    original.originLocation.placeName !== edited.originLocation.placeName ||
    original.originLocation.districtOrAirportCode !== edited.originLocation.districtOrAirportCode ||
    original.destinationLocation.placeName !== edited.destinationLocation.placeName ||
    original.destinationLocation.districtOrAirportCode !== edited.destinationLocation.districtOrAirportCode ||
    original.groupName.trim() !== edited.groupName.trim() ||
    original.fare.trim() !== edited.fare.trim()
  ) {
    changed.push("group");
  }
  const existingChanged = original.passengers.some((passenger) => {
    const next = findMatch(passenger, edited.passengers);
    return Boolean(next) && passengerSignature(passenger) !== passengerSignature(next!);
  });
  if (existingChanged) {
    changed.push("existingPassenger");
  }
  if (edited.passengers.some((passenger) => !isExistingMinistryPassenger(passenger, original))) {
    changed.push("newPassenger");
  }
  if (original.passengers.some((passenger) => !findMatch(passenger, edited.passengers))) {
    changed.push("removedPassenger");
  }
  if (original.driverId.trim() !== edited.driverId.trim()) {
    changed.push("driver");
  }
  if (original.vehicleId.trim() !== edited.vehicleId.trim()) {
    changed.push("vehicle");
  }
  return changed;
}

function arrow(label: string, from: string, to: string) {
  return `• ${label}:\n${from || "—"} → ${to || "—"}`;
}

function passengerLabel(copy: UetdsFormCopy, index: number, field: string) {
  return `${replaceCount(copy.passengerN, index + 1)} ${field}`;
}

function passengerName(passenger: UetdsPassengerDraft) {
  return [passenger.firstName, passenger.lastName].filter(Boolean).join(" ");
}

export function describeUetdsEditChanges(
  original: UetdsDraft,
  edited: UetdsDraft,
  copy: UetdsFormCopy,
  labels?: {
    driverLabel?: (id: string) => string;
    vehicleLabel?: (id: string) => string;
  },
): string[] {
  const lines: string[] = [];
  const driverLabel = (id: string) => labels?.driverLabel?.(id) || id;
  const vehicleLabel = (id: string) => labels?.vehicleLabel?.(id) || id;
  if (original.startDate !== edited.startDate || original.startTime !== edited.startTime) {
    lines.push(
      arrow(
        copy.listStart,
        formatUetdsSnapshotDateTime(original.startDate, original.startTime),
        formatUetdsSnapshotDateTime(edited.startDate, edited.startTime),
      ),
    );
  }
  if (original.endDate !== edited.endDate || original.endTime !== edited.endTime) {
    lines.push(
      arrow(
        copy.listEnd,
        formatUetdsSnapshotDateTime(original.endDate, original.endTime),
        formatUetdsSnapshotDateTime(edited.endDate, edited.endTime),
      ),
    );
  }
  if (original.origin !== edited.origin) {
    lines.push(arrow(copy.origin, original.origin, edited.origin));
  }
  if (original.destination !== edited.destination) {
    lines.push(arrow(copy.destination, original.destination, edited.destination));
  }
  if (original.groupName.trim() !== edited.groupName.trim()) {
    lines.push(arrow(copy.groupName, original.groupName, edited.groupName));
  }
  if (original.purpose.trim() !== edited.purpose.trim()) {
    lines.push(arrow(copy.groupPurpose, original.purpose, edited.purpose));
  }
  if (original.fare.trim() !== edited.fare.trim()) {
    lines.push(arrow(copy.groupFare, original.fare, edited.fare));
  }
  if (original.driverId.trim() !== edited.driverId.trim()) {
    lines.push(arrow(copy.driver, driverLabel(original.driverId), driverLabel(edited.driverId)));
  }
  if (original.vehicleId.trim() !== edited.vehicleId.trim()) {
    lines.push(arrow(copy.vehicle, vehicleLabel(original.vehicleId), vehicleLabel(edited.vehicleId)));
  }
  original.passengers.forEach((passenger, index) => {
    const next = findMatch(passenger, edited.passengers);
    if (!next) {
      lines.push(`• ${passengerLabel(copy, index, copy.removePassenger)}: ${passengerName(passenger)}`);
      return;
    }
    if (passenger.nationality !== next.nationality) {
      lines.push(arrow(passengerLabel(copy, index, copy.nationality), passenger.nationality, next.nationality));
    }
    if (passenger.identityNumber.trim() !== next.identityNumber.trim()) {
      lines.push(arrow(passengerLabel(copy, index, copy.identity), passenger.identityNumber, next.identityNumber));
    }
    if (passenger.firstName.trim() !== next.firstName.trim()) {
      lines.push(arrow(passengerLabel(copy, index, copy.firstName), passenger.firstName, next.firstName));
    }
    if (passenger.lastName.trim() !== next.lastName.trim()) {
      lines.push(arrow(passengerLabel(copy, index, copy.lastName), passenger.lastName, next.lastName));
    }
    if (passenger.gender !== next.gender) {
      lines.push(arrow(passengerLabel(copy, index, copy.gender), passenger.gender, next.gender));
    }
  });
  edited.passengers.forEach((passenger, index) => {
    if (isExistingMinistryPassenger(passenger, original)) {
      return;
    }
    lines.push(
      `• ${replaceCount(copy.passengerN, original.passengers.length + index + 1)}: ${passengerName(passenger)}`,
    );
  });
  return lines;
}
