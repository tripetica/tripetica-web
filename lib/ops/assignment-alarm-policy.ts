export type AssignmentAlarmReservationStatus = {
  status: string | null;
  deletedAt: Date | null;
  pickupAt: Date | null;
  driverTaskStage: string | null;
};

/** Reservation-level statuses that must not receive assignment alarms. */
export function isTerminalReservationStatus(status: string | null | undefined) {
  const raw = (status ?? "").trim().toLowerCase();
  return raw === "cancelled";
}

export function isDriverTaskCompleted(stage: string | null | undefined) {
  return (stage ?? "").trim().toLowerCase() === "completed";
}

export function shouldSkipAssignmentAlarm(
  input: AssignmentAlarmReservationStatus,
  now: Date = new Date(),
) {
  if (input.deletedAt) {
    return true;
  }
  if (isTerminalReservationStatus(input.status)) {
    return true;
  }
  if ((input.status ?? "").trim() !== "confirmed") {
    return true;
  }
  if (isDriverTaskCompleted(input.driverTaskStage)) {
    return true;
  }
  if (!input.pickupAt) {
    return true;
  }
  return input.pickupAt.getTime() <= now.getTime();
}
