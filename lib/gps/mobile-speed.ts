import { gpsDistanceMeters } from "@/lib/gps/motion";
import { GPS_MAX_SPEED_MPS } from "@/lib/gps/contract";

/** Estimates above this are rejected. Measured browser speeds may use the device cap. */
export const MOBILE_ESTIMATE_MAX_MPS = 55;
export const MOBILE_SPEED_MIN_GAP_MS = 1_000;
export const MOBILE_SPEED_MAX_GAP_MS = 30_000;
export const MOBILE_STORE_MOVING_MS = 3_000;
export const MOBILE_STORE_STILL_MS = 30_000;
export const MOBILE_STATIONARY_M = 12;
export const MOBILE_ESTIMATE_MAX_ACCURACY_M = 40;

export type MobileSpeedSource = "measured" | "estimated";

export type MobileSpeedFix = {
  at: number;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
};

export function mobileMeasuredSpeed(speedMps: number | null | undefined) {
  if (speedMps == null || !Number.isFinite(speedMps) || speedMps < 0 || speedMps > GPS_MAX_SPEED_MPS) return null;
  return speedMps;
}

export function resolveMobileSpeed(input: {
  reportedMps: number | null;
  previous: MobileSpeedFix | null;
  current: MobileSpeedFix;
}): { speedMps: number | null; source: MobileSpeedSource | null } {
  const measured = mobileMeasuredSpeed(input.reportedMps);
  if (measured != null) return { speedMps: measured, source: "measured" };
  if (!input.previous) return { speedMps: null, source: null };
  const dt = input.current.at - input.previous.at;
  if (dt < MOBILE_SPEED_MIN_GAP_MS || dt > MOBILE_SPEED_MAX_GAP_MS) return { speedMps: null, source: null };
  const noise = estimateNoiseMeters(input.previous.accuracyM, input.current.accuracyM);
  if (noise == null) return { speedMps: null, source: null };
  const meters = gpsDistanceMeters(
    input.previous.latitude,
    input.previous.longitude,
    input.current.latitude,
    input.current.longitude,
  );
  if (meters <= noise) return { speedMps: 0, source: "estimated" };
  const speed = meters / (dt / 1000);
  if (!Number.isFinite(speed) || speed > MOBILE_ESTIMATE_MAX_MPS) return { speedMps: null, source: null };
  return { speedMps: speed, source: "estimated" };
}

/** A repeated watch callback is liveness, not a new stored measurement. */
export function shouldStoreMobilePoint(input: {
  previous: MobileSpeedFix | null;
  current: MobileSpeedFix;
  reportedMps: number | null;
}) {
  if (!input.previous) return true;
  const dt = input.current.at - input.previous.at;
  if (dt < 500) return false;
  const meters = gpsDistanceMeters(
    input.previous.latitude,
    input.previous.longitude,
    input.current.latitude,
    input.current.longitude,
  );
  const speed = dt > 0 ? meters / (dt / 1000) : Number.POSITIVE_INFINITY;
  const measured = mobileMeasuredSpeed(input.reportedMps);
  if (speed > MOBILE_ESTIMATE_MAX_MPS && measured == null) return false;
  const noise = estimateNoiseMeters(input.previous.accuracyM, input.current.accuracyM) ?? MOBILE_STATIONARY_M;
  if (meters <= noise) return dt >= MOBILE_STORE_STILL_MS;
  return dt >= MOBILE_STORE_MOVING_MS;
}

export function mobileDisplaySpeedMps(input: {
  motion: "moving" | "stopped" | "still" | "unknown";
  speedMps: number | null;
}) {
  if (input.motion === "unknown") return null;
  if (input.motion === "stopped" || input.motion === "still") return 0;
  return mobileMeasuredSpeed(input.speedMps);
}

export function annotateMobileSpeeds<T extends {
  recordedAt: string;
  latitude: number;
  longitude: number;
  speedMps: number | null;
  accuracyM?: number | null;
  speedSource?: MobileSpeedSource | null;
}>(points: readonly T[]) {
  let previous: MobileSpeedFix | null = null;
  return points.map((point) => {
    const current: MobileSpeedFix = {
      at: Date.parse(point.recordedAt),
      latitude: point.latitude,
      longitude: point.longitude,
      accuracyM: point.accuracyM ?? null,
    };
    const known = point.speedMps != null && Number.isFinite(point.speedMps)
      ? { speedMps: point.speedMps, source: point.speedSource ?? "measured" as const }
      : resolveMobileSpeed({ reportedMps: null, previous, current });
    if (Number.isFinite(current.at)) previous = current;
    return { ...point, speedMps: known.speedMps, speedSource: known.source };
  });
}

export function gpsSpeedKmSa(mps: number | null) {
  if (mps == null || !Number.isFinite(mps)) return "—";
  return `${Math.round(mps * 3.6)} km/sa`;
}

function estimateNoiseMeters(previous: number | null, current: number | null) {
  const values = [previous, current].filter((value): value is number => (
    value != null && Number.isFinite(value) && value >= 0 && value <= MOBILE_ESTIMATE_MAX_ACCURACY_M
  ));
  if (values.length < 2) return null;
  return Math.max(MOBILE_STATIONARY_M, ...values);
}
