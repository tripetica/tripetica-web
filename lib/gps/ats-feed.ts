import { planMobileAtsReplay } from "@/lib/gps/mobile-ats";
import { ministryAtsFeed, type AtsMinistrySource } from "@/lib/gps/ats-source";

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
  | "mobile_service_off"
  | "subscription_closed"
  | "fix_missing"
  | "fix_before_window"
  | "mismatch"
  | "trip_inactive";

/**
 * The vehicle's ministry source picks one feed. A live device does not
 * override Mobil GPS, and a missing physical fix does not fall back to it.
 */
export function selectAtsFeed(input: {
  source: AtsMinistrySource;
  gpsAtsEnabled: boolean;
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
  const feed = ministryAtsFeed(input);
  if (feed !== "mobile") return feed;
  if (mobileAtsBlockReason(input) === null) return "mobile";
  return "none";
}

export function mobileAtsBlockReason(input: {
  source?: AtsMinistrySource;
  gpsAtsEnabled?: boolean;
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
