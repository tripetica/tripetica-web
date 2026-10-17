import { normalizeEmail } from "@/lib/uetds/service-subscriptions";

export const MOBILE_GPS_FRESH_MS = 120_000;

export type MobileShareIdentity = {
  partnerId: string;
  driverId: string;
  driverName: string;
  vehicleId: string | null;
  plate: string | null;
  companyName: string | null;
  active: boolean;
  mobileEnabled: boolean;
};

export function mobileShareAllowed(input: {
  matches: number;
  driverActive: boolean;
  mobileEnabled: boolean;
  isOwner: boolean;
  subscriptionOpen: boolean;
}) {
  return input.matches === 1 && input.driverActive && input.mobileEnabled && input.isOwner && input.subscriptionOpen;
}

export function emailsMatch(left: string | null | undefined, right: string | null | undefined) {
  const a = normalizeEmail(left);
  const b = normalizeEmail(right);
  return a.length > 0 && a === b;
}

export function mobileFixFresh(recordedAt: string | null, now = Date.now()) {
  if (!recordedAt) return false;
  const at = Date.parse(recordedAt);
  return Number.isFinite(at) && now - at <= MOBILE_GPS_FRESH_MS && at <= now + 5 * 60_000;
}

export type MobileShareStartDecision = "resume" | "bind-token" | "blocked" | "replace" | "create";

/** A different browser still owns the session when the server has accepted it recently. */
export function mobileShareForeignLive(input: {
  lastStreamAt: number | null;
  startedAt: number | null;
  now: number;
}) {
  const heard = input.lastStreamAt;
  if (heard != null && Number.isFinite(heard) && input.now - heard <= MOBILE_GPS_FRESH_MS && heard <= input.now + 5 * 60_000) {
    return true;
  }
  if (heard == null && input.startedAt != null && Number.isFinite(input.startedAt)) {
    const age = input.now - input.startedAt;
    return age >= 0 && age <= MOBILE_GPS_FRESH_MS;
  }
  return false;
}

export function mobileShareStartDecision(input: {
  hasSession: boolean;
  sharing: boolean;
  tokenMatches: boolean;
  tokenBound: boolean;
  lastStreamAt: number | null;
  startedAt: number | null;
  now: number;
}): MobileShareStartDecision {
  if (!input.hasSession) return "create";
  if (input.sharing && input.tokenMatches) return "resume";
  if (input.sharing && !input.tokenBound) return "bind-token";
  if (input.sharing && mobileShareForeignLive(input)) return "blocked";
  return "replace";
}

export function acceptMobilePoint(input: {
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracyM: number | null;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const at = Date.parse(input.recordedAt);
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) return false;
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) return false;
  if (!Number.isFinite(at) || at > now + 5 * 60_000 || now - at > 24 * 60 * 60_000) return false;
  if (input.accuracyM != null && (!Number.isFinite(input.accuracyM) || input.accuracyM < 0)) return false;
  return true;
}
