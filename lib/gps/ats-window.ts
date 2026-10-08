import { GPS_ONLINE_MS_DEFAULT } from "@/lib/gps/presence";
import { uetdsTripTimestamp } from "@/lib/uetds/list-policy";

/** Official ATS cadence for this phase. Trip length is never derived from this. */
export const ATS_PERIOD_MS = 120_000;

export const ATS_ACTIVE_NOTIFICATION_STATUSES = [
  "submitted",
  "updated",
  "partial",
  "partial_update",
  "update_error",
  "updating",
] as const;

export type AtsTripClock = {
  id: string;
  status: string;
  vehicleId: string | null;
  companyId: string | null;
  plate: string | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

export function atsPeriodSlot(nowMs: number) {
  return Math.floor(nowMs / ATS_PERIOD_MS);
}

function canonicalPlate(plate: string) {
  return plate.replace(/\s+/g, "").toUpperCase();
}

export function selectActiveAtsTrips(input: {
  trips: readonly AtsTripClock[];
  vehicleId: string;
  companyId: string;
  plate: string;
  nowMs: number;
}): { ok: true; notificationIds: string[] } | { ok: false; reason: "no_trip" | "plate" } {
  const plate = canonicalPlate(input.plate);
  const active: string[] = [];
  let plateMismatch = false;
  for (const trip of input.trips) {
    if (!(ATS_ACTIVE_NOTIFICATION_STATUSES as readonly string[]).includes(trip.status)) {
      continue;
    }
    if (trip.vehicleId !== input.vehicleId || trip.companyId !== input.companyId) {
      continue;
    }
    const start = uetdsTripTimestamp(trip.startDate, trip.startTime);
    const end = uetdsTripTimestamp(trip.endDate, trip.endTime);
    if (start == null || end == null || end < start) {
      continue;
    }
    if (input.nowMs < start || input.nowMs >= end) {
      continue;
    }
    const tripPlate = trip.plate ? canonicalPlate(trip.plate) : "";
    if (!tripPlate || tripPlate !== plate) {
      plateMismatch = true;
      continue;
    }
    active.push(trip.id);
  }
  if (active.length > 0) {
    return { ok: true, notificationIds: active };
  }
  return { ok: false, reason: plateMismatch ? "plate" : "no_trip" };
}

export function atsPositionIsCurrent(input: {
  recordedAt: string | null;
  statusGnssFix: boolean | null;
  heartbeatAt: string | null;
  nowMs: number;
  onlineMs?: number;
}): { ok: true } | { ok: false; reason: "offline" | "gnss_fix" | "stale_position" } {
  const onlineMs = input.onlineMs ?? GPS_ONLINE_MS_DEFAULT;
  const heartbeat = input.heartbeatAt ? Date.parse(input.heartbeatAt) : Number.NaN;
  if (!Number.isFinite(heartbeat) || input.nowMs - heartbeat > onlineMs) {
    return { ok: false, reason: "offline" };
  }
  if (input.statusGnssFix === false) {
    return { ok: false, reason: "gnss_fix" };
  }
  const recorded = input.recordedAt ? Date.parse(input.recordedAt) : Number.NaN;
  if (!Number.isFinite(recorded) || recorded > input.nowMs + 5 * 60 * 1000 || input.nowMs - recorded > ATS_PERIOD_MS) {
    return { ok: false, reason: "stale_position" };
  }
  return { ok: true };
}

export function atsHasStoredPosition(recordedAt: string | null, nowMs: number) {
  const recorded = recordedAt ? Date.parse(recordedAt) : Number.NaN;
  return Number.isFinite(recorded) && recorded <= nowMs + 5 * 60 * 1000;
}

export function planAtsCycle(input: {
  nowMs: number;
  enabled: boolean;
  trips: readonly AtsTripClock[];
  vehicleId: string;
  companyId: string;
  plate: string;
  recordedAt: string | null;
  statusGnssFix: boolean | null;
  heartbeatAt: string | null;
  slotUsed: boolean;
}): { ok: true; notificationIds: string[]; slot: number; gnssTime: string; stored: boolean; positionNote: "offline" | "gnss_fix" | "stale_position" | null } | { ok: false; reason: "disabled" | "no_trip" | "plate" | "no_position" | "duplicate_slot" } {
  if (!input.enabled) {
    return { ok: false, reason: "disabled" };
  }
  const trips = selectActiveAtsTrips(input);
  if (!trips.ok) {
    return trips;
  }
  if (!atsHasStoredPosition(input.recordedAt, input.nowMs)) {
    return { ok: false, reason: "no_position" };
  }
  if (input.slotUsed) {
    return { ok: false, reason: "duplicate_slot" };
  }
  const freshness = atsPositionIsCurrent(input);
  return {
    ok: true,
    notificationIds: trips.notificationIds,
    slot: atsPeriodSlot(input.nowMs),
    gnssTime: input.recordedAt ?? "",
    stored: !freshness.ok,
    positionNote: freshness.ok ? null : freshness.reason,
  };
}
