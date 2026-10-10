import { planMobileAtsReplay } from "@/lib/gps/mobile-ats";

export type AtsFeed = "physical" | "mobile" | "none";

/**
 * A live device on its own vehicle is the physical ATS source.
 * A missing switch row does not block it. An explicit off row does.
 */
export function physicalAtsEligible(input: {
  deviceActive: boolean;
  liveSource: boolean;
  assignedToVehicle: boolean;
  explicitSwitchOff: boolean;
}) {
  if (input.explicitSwitchOff) return false;
  return input.deviceActive && input.liveSource && input.assignedToVehicle;
}

export type MobileAtsBlock =
  | "physical_device"
  | "mobile_service_off"
  | "subscription_closed"
  | "fix_missing"
  | "fix_before_window"
  | "mismatch"
  | "trip_inactive";

/**
 * A live device on the vehicle stays on that device.
 * A vehicle without one uses the driver's stored phone fix when Mobil GPS
 * service and the current-month entitlement are open. The physical ATS
 * switch is not a gate here: that switch can only point at a device.
 */
export function selectAtsFeed(input: {
  physicalDeviceOnVehicle: boolean;
  mobileEnabled: boolean;
  subscriptionOpen: boolean;
  measuredAt: string | null;
  nowMs: number;
  tripStartMs: number;
  tripEndMs: number;
  vehicleMatches: boolean;
  driverMatches: boolean;
  companyMatches: boolean;
}): AtsFeed {
  if (input.physicalDeviceOnVehicle) return "physical";
  if (mobileAtsBlockReason(input) === null) return "mobile";
  return "none";
}

export function mobileAtsBlockReason(input: {
  physicalDeviceOnVehicle: boolean;
  mobileEnabled: boolean;
  subscriptionOpen: boolean;
  measuredAt: string | null;
  nowMs: number;
  tripStartMs: number;
  tripEndMs: number;
  vehicleMatches: boolean;
  driverMatches: boolean;
  companyMatches: boolean;
}): MobileAtsBlock | null {
  if (input.physicalDeviceOnVehicle) return "physical_device";
  if (!input.mobileEnabled) return "mobile_service_off";
  if (!input.subscriptionOpen) return "subscription_closed";
  const replay = planMobileAtsReplay({
    measuredAt: input.measuredAt,
    nowMs: input.nowMs,
    tripStartMs: input.tripStartMs,
    tripEndMs: input.tripEndMs,
    vehicleMatches: input.vehicleMatches,
    driverMatches: input.driverMatches,
    companyMatches: input.companyMatches,
  });
  if (replay.eligible) return null;
  if (replay.decision === "reject_before_window") return "fix_before_window";
  if (replay.decision === "reject_missing") return "fix_missing";
  if (replay.decision === "reject_mismatch") return "mismatch";
  return "trip_inactive";
}
