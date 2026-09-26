import { isAirportPickup, normalizeFlightCode } from "@/lib/booking/occupancy";
import {
  formatUtcToIstanbulLocal,
  istanbulLocalToUtcMs,
  timestamptzToIstanbulLocal,
} from "@/lib/booking/istanbul-time";

export const FLIGHT_TRACKING_SOURCE = "dhmi" as const;

export type FlightTrackingTone = "green" | "orange" | "red" | "gray";

export type FlightTrackingSnapshot = {
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  statusText: string | null;
  statusId: number | null;
  source: typeof FLIGHT_TRACKING_SOURCE | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type DhmiFlightCandidate = {
  number: string;
  date: string;
  planned: string;
  estimated: string;
  exactTime?: string | null;
  status: string;
  statusId?: number | null;
  scheduledDateTime?: string | null;
  estimatedDateTime?: string | null;
};

export type FlightStatusBadge = {
  label: string;
  tone: FlightTrackingTone;
};

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const POLL_EARLY_MS = 60 * 60 * 1000;
const POLL_FAR_MS = 30 * 60 * 1000;
const POLL_NEAR_MS = 10 * 60 * 1000;
const MATCH_WINDOW_MS = 18 * 60 * 60 * 1000;

export function dhmiAirportPathId(airportId: number): string {
  const id = Math.trunc(airportId);
  if (!Number.isFinite(id) || id <= 0) {
    return "";
  }
  const raw = String(id);
  return raw.length === 1 ? raw.padStart(2, "0") : raw;
}

export function flightNumberKey(value: string | null | undefined): string {
  const compact = normalizeFlightCode(value ?? "");
  const match = compact.match(/^([A-Z]{1,3})0*([0-9]+)$/);
  if (!match) {
    return compact;
  }
  return `${match[1]}${match[2]}`;
}

export function trackingPickupIsAirport(input: {
  airportCode?: string | null;
  locationType?: string | null;
  placeId?: string | null;
}): boolean {
  return isAirportPickup({
    airportCode: input.airportCode,
    locationType: input.locationType,
    placeId: input.placeId,
  });
}

export function shouldTrackAirportPickupFlight(input: {
  airportCode?: string | null;
  locationType?: string | null;
  placeId?: string | null;
  flightCode?: string | null;
  status?: string | null;
  deleted?: boolean;
  driverTaskStage?: string | null;
}): boolean {
  if (input.deleted) {
    return false;
  }
  const status = (input.status ?? "").trim();
  if (status && status !== "confirmed") {
    return false;
  }
  if (input.driverTaskStage === "completed") {
    return false;
  }
  if (!trackingPickupIsAirport(input)) {
    return false;
  }
  return flightNumberKey(input.flightCode).length > 0;
}

export function parseDhmiClock(value: string | null | undefined): {
  hour: number;
  minute: number;
} | null {
  const raw = (value ?? "").trim();
  const colon = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (colon) {
    const hour = Number(colon[1]);
    const minute = Number(colon[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
    return null;
  }
  const compact = raw.match(/^(\d{3,4})$/);
  if (!compact) {
    return null;
  }
  const padded = compact[1].padStart(4, "0");
  const hour = Number(padded.slice(0, 2));
  const minute = Number(padded.slice(2, 4));
  if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
    return { hour, minute };
  }
  return null;
}

export function parseDhmiDateParts(value: string | null | undefined): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = (value ?? "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (
    year < 2000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function istanbulLocalFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
}

function addIstanbulDays(year: number, month: number, day: number, delta: number) {
  const utc = Date.UTC(year, month - 1, day + delta);
  const stamp = new Date(utc);
  return {
    year: stamp.getUTCFullYear(),
    month: stamp.getUTCMonth() + 1,
    day: stamp.getUTCDate(),
  };
}

export function istanbulMsFromDhmiDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
): number | null {
  const combined = `${date ?? ""} ${time ?? ""}`.trim();
  const full = combined.match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/,
  );
  if (full && full[4] != null) {
    const local = istanbulLocalFromParts(
      Number(full[3]),
      Number(full[2]),
      Number(full[1]),
      Number(full[4]),
      Number(full[5]),
    );
    const ms = istanbulLocalToUtcMs(local);
    return Number.isFinite(ms) ? ms : null;
  }
  const parts = parseDhmiDateParts(date);
  const clock = parseDhmiClock(time);
  if (!parts || !clock) {
    return null;
  }
  const ms = istanbulLocalToUtcMs(
    istanbulLocalFromParts(parts.year, parts.month, parts.day, clock.hour, clock.minute),
  );
  return Number.isFinite(ms) ? ms : null;
}

export function attachExactTimeNear(
  exactTime: string | null | undefined,
  aroundMs: number | null,
): number | null {
  const clock = parseDhmiClock(exactTime);
  if (!clock || aroundMs == null || !Number.isFinite(aroundMs)) {
    return null;
  }
  const local = formatUtcToIstanbulLocal(aroundMs);
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidates = [0, -1, 1].map((delta) => {
    const shifted = addIstanbulDays(year, month, day, delta);
    return istanbulLocalToUtcMs(
      istanbulLocalFromParts(
        shifted.year,
        shifted.month,
        shifted.day,
        clock.hour,
        clock.minute,
      ),
    );
  });
  let best: number | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate)) {
      continue;
    }
    const delta = Math.abs(candidate - aroundMs);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  if (best == null || bestDelta > MATCH_WINDOW_MS) {
    return null;
  }
  return best;
}

export function isDhmiLandedStatus(
  status: string | null | undefined,
  statusId?: number | null,
): boolean {
  if (statusId === 17) {
    return true;
  }
  const raw = (status ?? "").toLocaleUpperCase("tr-TR");
  return raw.includes("İNDİ") || raw.includes("INDI") || raw.includes("LANDED");
}

export function delayMinutes(
  scheduledMs: number | null,
  compareMs: number | null,
): number | null {
  if (scheduledMs == null || compareMs == null) {
    return null;
  }
  return Math.round((compareMs - scheduledMs) / 60000);
}

export function flightTrackingTone(input: {
  scheduledMs: number | null;
  estimatedMs: number | null;
  actualMs: number | null;
  landed: boolean;
}): FlightTrackingTone {
  if (input.actualMs != null || input.landed) {
    return "green";
  }
  const compare = input.estimatedMs ?? input.scheduledMs;
  if (compare == null || input.scheduledMs == null) {
    return "gray";
  }
  const delay = delayMinutes(input.scheduledMs, compare);
  if (delay == null) {
    return "gray";
  }
  if (delay >= 60) {
    return "red";
  }
  if (delay >= 15) {
    return "orange";
  }
  return "green";
}

export function formatIstanbulClock(value: string | number | Date | null | undefined): string | null {
  if (value == null || value === "") {
    return null;
  }
  const local =
    typeof value === "number"
      ? formatUtcToIstanbulLocal(value)
      : timestamptzToIstanbulLocal(value);
  const clock = local.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(clock) ? clock : null;
}

export function flightStatusBadge(input: {
  trackable: boolean;
  snapshot: FlightTrackingSnapshot | null;
}): FlightStatusBadge | null {
  if (!input.trackable) {
    return { label: "—", tone: "gray" };
  }
  const snapshot = input.snapshot;
  const scheduledMs = snapshot?.scheduledArrival
    ? Date.parse(snapshot.scheduledArrival)
    : null;
  const estimatedMs = snapshot?.estimatedArrival
    ? Date.parse(snapshot.estimatedArrival)
    : null;
  const actualMs = snapshot?.actualArrival ? Date.parse(snapshot.actualArrival) : null;
  const landed = isDhmiLandedStatus(snapshot?.statusText, snapshot?.statusId);
  const tone = flightTrackingTone({
    scheduledMs: Number.isFinite(scheduledMs) ? scheduledMs : null,
    estimatedMs: Number.isFinite(estimatedMs) ? estimatedMs : null,
    actualMs: Number.isFinite(actualMs) ? actualMs : null,
    landed,
  });
  const actualClock = formatIstanbulClock(snapshot?.actualArrival ?? null);
  if (actualClock) {
    return { label: `İndi ${actualClock}`, tone: "green" };
  }
  if (landed) {
    return { label: "İndi", tone: "green" };
  }
  const estimatedClock = formatIstanbulClock(snapshot?.estimatedArrival ?? snapshot?.scheduledArrival ?? null);
  if (estimatedClock) {
    return { label: `Tahmini ${estimatedClock}`, tone };
  }
  if (snapshot?.lastError) {
    return { label: "Uçuş verisi alınamadı", tone: "gray" };
  }
  return { label: "Veri bekleniyor", tone: "gray" };
}

export function flightPollIntervalMs(input: {
  nowMs: number;
  scheduledMs: number | null;
  estimatedMs?: number | null;
  actualMs: number | null;
  cancelled?: boolean;
  completed?: boolean;
}): number | null {
  if (input.cancelled || input.completed || input.actualMs != null) {
    return null;
  }
  // Cadence is anchored to reservation pickup_at / planned time only.
  // Estimated arrival is stored and shown in UI but never relaxes polling.
  const planned = input.scheduledMs;
  if (planned == null) {
    return null;
  }
  const remaining = planned - input.nowMs;
  if (remaining > FOUR_HOURS_MS) {
    return null;
  }
  if (remaining > TWO_HOURS_MS) {
    return POLL_EARLY_MS;
  }
  if (remaining > ONE_HOUR_MS) {
    return POLL_FAR_MS;
  }
  return POLL_NEAR_MS;
}

export function shouldPollFlight(input: {
  nowMs: number;
  scheduledMs: number | null;
  estimatedMs: number | null;
  actualMs: number | null;
  lastCheckedMs: number | null;
  cancelled?: boolean;
  completed?: boolean;
}): boolean {
  const interval = flightPollIntervalMs(input);
  if (interval == null) {
    return false;
  }
  if (input.lastCheckedMs == null) {
    return true;
  }
  return input.nowMs - input.lastCheckedMs >= interval;
}

export function candidateScheduledMs(
  flight: DhmiFlightCandidate,
): number | null {
  return (
    istanbulMsFromDhmiDateTime(flight.scheduledDateTime, null) ??
    istanbulMsFromDhmiDateTime(flight.date, flight.planned)
  );
}

export function candidateEstimatedMs(
  flight: DhmiFlightCandidate,
): number | null {
  return (
    istanbulMsFromDhmiDateTime(flight.estimatedDateTime, null) ??
    istanbulMsFromDhmiDateTime(flight.date, flight.estimated)
  );
}

export function matchDhmiFlight(
  flights: DhmiFlightCandidate[],
  flightCode: string,
  reservationPickupMs: number,
): DhmiFlightCandidate | null {
  const wanted = flightNumberKey(flightCode);
  if (!wanted || !Number.isFinite(reservationPickupMs)) {
    return null;
  }
  let best: DhmiFlightCandidate | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const flight of flights) {
    if (flightNumberKey(flight.number) !== wanted) {
      continue;
    }
    const scheduledMs = candidateScheduledMs(flight);
    if (scheduledMs == null) {
      continue;
    }
    const delta = Math.abs(scheduledMs - reservationPickupMs);
    if (delta > MATCH_WINDOW_MS) {
      continue;
    }
    if (delta < bestDelta) {
      best = flight;
      bestDelta = delta;
    }
  }
  return best;
}

export function isDhmiCancelledStatus(status: string | null | undefined): boolean {
  const raw = (status ?? "").toLocaleUpperCase("tr-TR");
  return raw.includes("İPTAL") || raw.includes("IPTAL") || raw.includes("CANCEL");
}

export function resolvedActualArrivalMs(flight: DhmiFlightCandidate): number | null {
  const exact = (flight.exactTime ?? "").trim();
  if (!exact || isDhmiCancelledStatus(flight.status)) {
    return null;
  }
  const around =
    candidateEstimatedMs(flight) ??
    candidateScheduledMs(flight);
  return attachExactTimeNear(exact, around);
}

export function snapshotIso(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

export const FALLBACK_DHMI_AIRPORT_IDS: Record<string, number> = {
  IST: 57,
  SAW: 999,
  AYT: 4,
};
