/**
 * Oldest real fix that may be used, measured backward from the trip start.
 * After the trip starts this is not a moving freshness limit: a fix inside
 * the window keeps its own GNSS time until the trip ends.
 */
export const MOBILE_ATS_MAX_FIX_AGE_MS = 60 * 60 * 1000;

export type MobileAtsReplay =
  | { send: false; eligible: true; decision: "use_last"; measuredAt: string }
  | { send: false; eligible: false; decision: "reject_before_window" | "reject_missing" | "reject_trip" | "reject_mismatch"; measuredAt: string | null };

/**
 * The sixty-minute check is against the trip start, not against each later send.
 * Once a real fix is inside [start − 60min, now], the same measurement may be
 * repeated until the trip ends. This planner never relabels konumZamani and
 * never authorizes a ministry call by itself (`send` stays false).
 */
export function planMobileAtsReplay(input: {
  measuredAt: string | null;
  nowMs: number;
  tripStartMs: number;
  tripEndMs: number;
  vehicleMatches: boolean;
  driverMatches: boolean;
  companyMatches: boolean;
}): MobileAtsReplay {
  const tripActive = input.nowMs >= input.tripStartMs && input.nowMs < input.tripEndMs;
  if (!tripActive) return { send: false, eligible: false, decision: "reject_trip", measuredAt: input.measuredAt };
  if (!input.vehicleMatches || !input.driverMatches || !input.companyMatches) {
    return { send: false, eligible: false, decision: "reject_mismatch", measuredAt: input.measuredAt };
  }
  if (!input.measuredAt) return { send: false, eligible: false, decision: "reject_missing", measuredAt: null };
  const measured = Date.parse(input.measuredAt);
  if (!Number.isFinite(measured) || measured > input.nowMs + 5 * 60 * 1000) {
    return { send: false, eligible: false, decision: "reject_missing", measuredAt: null };
  }
  if (measured < input.tripStartMs - MOBILE_ATS_MAX_FIX_AGE_MS) {
    return { send: false, eligible: false, decision: "reject_before_window", measuredAt: input.measuredAt };
  }
  return { send: false, eligible: true, decision: "use_last", measuredAt: input.measuredAt };
}

export type MobileAtsPlan = {
  send: false;
  reason:
    | "production_physical_source_only"
    | "subscription_closed"
    | "driver_inactive"
    | "vehicle_missing"
    | "company_missing"
    | "trip_missing"
    | "fix_missing"
    | "duplicate_physical_report"
    | "test_endpoint_unverified";
};

export function planMobileAts(input: {
  runtime: "production" | "development" | "test";
  testEndpointVerified: boolean;
  subscriptionEnabled: boolean;
  driverActive: boolean;
  vehicleId: string | null;
  plate: string | null;
  companyName: string | null;
  tripId: string | null;
  fixRecordedAt: string | null;
  physicalReportSent: boolean;
}): MobileAtsPlan {
  if (input.runtime === "production") return { send: false, reason: "production_physical_source_only" };
  if (!input.subscriptionEnabled) return { send: false, reason: "subscription_closed" };
  if (!input.driverActive) return { send: false, reason: "driver_inactive" };
  if (!input.vehicleId || !input.plate) return { send: false, reason: "vehicle_missing" };
  if (!input.companyName) return { send: false, reason: "company_missing" };
  if (!input.tripId) return { send: false, reason: "trip_missing" };
  if (!input.fixRecordedAt) return { send: false, reason: "fix_missing" };
  if (input.physicalReportSent) return { send: false, reason: "duplicate_physical_report" };
  if (!input.testEndpointVerified) return { send: false, reason: "test_endpoint_unverified" };
  return { send: false, reason: "test_endpoint_unverified" };
}
