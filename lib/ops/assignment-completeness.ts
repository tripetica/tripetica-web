import {
  parseNonTrpDriverSnapshot,
  parseNonTrpVehicleSnapshot,
} from "@/lib/partner/job-assignment-view";

export type AssignmentKind = "registered" | "non_trp";

export type OperationAssignmentState = {
  acceptedPartnerId: string | null;
  assignedDriverKind: string | null;
  assignedDriverId: string | null;
  assignedDriverSnapshot: unknown;
  assignedVehicleKind: string | null;
  assignedVehicleId: string | null;
  assignedVehicleSnapshot: unknown;
};

export type MissingAssignmentPart = "partner" | "driver" | "vehicle";

export function isRegisteredDriverAssigned(state: OperationAssignmentState) {
  return (
    state.assignedDriverKind === "registered" && Boolean(state.assignedDriverId)
  );
}

export function isNonTrpDriverAssigned(state: OperationAssignmentState) {
  return (
    state.assignedDriverKind === "non_trp" &&
    !state.assignedDriverId &&
    parseNonTrpDriverSnapshot(state.assignedDriverSnapshot) != null
  );
}

export function isRegisteredVehicleAssigned(state: OperationAssignmentState) {
  return (
    state.assignedVehicleKind === "registered" &&
    Boolean(state.assignedVehicleId)
  );
}

export function isNonTrpVehicleAssigned(state: OperationAssignmentState) {
  return (
    state.assignedVehicleKind === "non_trp" &&
    !state.assignedVehicleId &&
    parseNonTrpVehicleSnapshot(state.assignedVehicleSnapshot) != null
  );
}

export function isDriverAssigned(state: OperationAssignmentState) {
  return isRegisteredDriverAssigned(state) || isNonTrpDriverAssigned(state);
}

export function isVehicleAssigned(state: OperationAssignmentState) {
  return isRegisteredVehicleAssigned(state) || isNonTrpVehicleAssigned(state);
}

export function isPartnerAssigned(state: OperationAssignmentState) {
  return Boolean(state.acceptedPartnerId);
}

/** Partner + driver + vehicle, registered or NON-TRP. Matches DB shape constraints. */
export function isOperationAssignmentComplete(state: OperationAssignmentState) {
  return (
    isPartnerAssigned(state) && isDriverAssigned(state) && isVehicleAssigned(state)
  );
}

export function missingAssignmentParts(
  state: OperationAssignmentState,
): MissingAssignmentPart[] {
  const missing: MissingAssignmentPart[] = [];
  if (!isPartnerAssigned(state)) {
    missing.push("partner");
  }
  if (!isDriverAssigned(state)) {
    missing.push("driver");
  }
  if (!isVehicleAssigned(state)) {
    missing.push("vehicle");
  }
  return missing;
}
