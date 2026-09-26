import "server-only";

import { assignOpsReservationDriver, assignOpsReservationVehicle } from "@/lib/ops/reservation-assignment";
import { assignPartnerJobDriver, assignPartnerJobVehicle } from "@/lib/partner/job-assignment";
import { type UetdsFleetScope } from "@/lib/uetds/fleet-options";

export type UetdsReservationAssignmentSyncResult = {
  attempted: boolean;
  driverOk: boolean | null;
  vehicleOk: boolean | null;
};

export async function syncReservationAssignmentFromUetdsEdit(input: {
  actorType: UetdsFleetScope;
  actorUserId: string;
  partnerId?: string | null;
  reservationId: string | null;
  source: string;
  driverId?: string | null;
  vehicleId?: string | null;
}): Promise<UetdsReservationAssignmentSyncResult> {
  if (input.source !== "reservation" || !input.reservationId) {
    return { attempted: false, driverOk: null, vehicleOk: null };
  }
  const result: UetdsReservationAssignmentSyncResult = {
    attempted: true,
    driverOk: input.driverId ? false : null,
    vehicleOk: input.vehicleId ? false : null,
  };
  if (input.actorType === "ops") {
    if (input.driverId) {
      const assigned = await assignOpsReservationDriver({
        reservationId: input.reservationId,
        selection: input.driverId,
      });
      result.driverOk = assigned.ok;
    }
    if (input.vehicleId) {
      const assigned = await assignOpsReservationVehicle({
        reservationId: input.reservationId,
        selection: input.vehicleId,
      });
      result.vehicleOk = assigned.ok;
    }
    return result;
  }
  if (!input.partnerId) {
    return result;
  }
  if (input.driverId) {
    const assigned = await assignPartnerJobDriver({
      partnerId: input.partnerId,
      userId: input.actorUserId,
      isPrimaryPartner: true,
      reservationId: input.reservationId,
      selection: input.driverId,
      fullName: "",
      existingFirst: "",
      existingLast: "",
      phoneCountryCode: "",
      phoneNational: "",
      languageCodes: [],
      notes: "",
    });
    result.driverOk = assigned.ok;
  }
  if (input.vehicleId) {
    const assigned = await assignPartnerJobVehicle({
      partnerId: input.partnerId,
      userId: input.actorUserId,
      isPrimaryPartner: true,
      reservationId: input.reservationId,
      selection: input.vehicleId,
      plate: "",
      brandModel: "",
      features: "",
    });
    result.vehicleOk = assigned.ok;
  }
  return result;
}
