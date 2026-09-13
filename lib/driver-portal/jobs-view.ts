import { bookingServiceDisplayLabel } from "@/lib/booking/tour-display";
import { timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import { driverTaskStageLabel } from "@/lib/ops/driver-task-copy";
import { opsCopy } from "@/lib/ops/copy";
import { isDriverTaskStage, type DriverTaskStage } from "@/lib/ops/driver-task-stages";

export type DriverPortalJobRow = {
  reservationId: string;
  pickupAt: string | null;
  pickupAtLabel: string;
  serviceLabel: string;
  pickupName: string;
  dropoffName: string | null;
  stage: DriverTaskStage;
  stageLabel: string;
  completed: boolean;
};

export function isRegisteredDriverPortalAssignment(input: {
  assignedDriverKind: string | null | undefined;
  assignedDriverId: string | null | undefined;
  sessionDriverId: string;
}) {
  return (
    input.assignedDriverKind === "registered" &&
    Boolean(input.assignedDriverId) &&
    input.assignedDriverId === input.sessionDriverId
  );
}

export function formatDriverPortalDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }
  const local = timestamptzToIstanbulLocal(value);
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return "—";
  }
  return `${match[3]}.${match[2]}.${match[1]} · ${match[4]}:${match[5]}`;
}

export function driverPortalPlaceName(tr: string | null | undefined, customer: string | null | undefined) {
  return tr?.trim() || customer?.trim() || "";
}

export function driverPortalDropoffName(input: {
  serviceType: string | null | undefined;
  dropoffName: string;
}) {
  const service = input.serviceType?.trim();
  if (service === "transfer" || input.dropoffName) {
    return input.dropoffName || null;
  }
  return null;
}

export function buildDriverPortalJobRow(input: {
  reservationId: string;
  pickupAt: Date | string | null;
  serviceType: string | null;
  tourCode: string | null;
  pickupNameTr: string | null;
  pickupNameCustomer: string | null;
  dropoffNameTr: string | null;
  dropoffNameCustomer: string | null;
  currentStage: string | null;
}): DriverPortalJobRow {
  const stage = isDriverTaskStage(input.currentStage) ? input.currentStage : "planned";
  const pickupName = driverPortalPlaceName(input.pickupNameTr, input.pickupNameCustomer);
  const dropoffName = driverPortalDropoffName({
    serviceType: input.serviceType,
    dropoffName: driverPortalPlaceName(input.dropoffNameTr, input.dropoffNameCustomer),
  });
  return {
    reservationId: input.reservationId,
    pickupAt: input.pickupAt ? new Date(input.pickupAt).toISOString() : null,
    pickupAtLabel: formatDriverPortalDateTime(input.pickupAt),
    serviceLabel: bookingServiceDisplayLabel(input.serviceType, input.tourCode, "tr"),
    pickupName,
    dropoffName,
    stage,
    stageLabel: driverTaskStageLabel(stage, opsCopy.tr),
    completed: stage === "completed",
  };
}

export function partitionDriverPortalJobs(jobs: readonly DriverPortalJobRow[]) {
  return {
    upcoming: jobs.filter((job) => !job.completed),
    completed: [...jobs.filter((job) => job.completed)].reverse(),
  };
}
