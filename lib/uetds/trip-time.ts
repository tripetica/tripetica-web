import {
  formatUtcToIstanbulLocal,
  istanbulLocalToUtcMs,
  isIstanbulLocalOnOrAfter,
} from "@/lib/booking/istanbul-time";
import { uetdsLocationIsAirport } from "@/lib/uetds/official-locations";

/** Form default and AI minimum start: analysis clock + 65 minutes. */
export const UETDS_DEFAULT_START_LEAD_MS = 65 * 60 * 1000;
/** Final submit: keep start only when it is already at least now + 62 minutes. */
export const UETDS_SUBMIT_MIN_REMAINING_MS = 62 * 60 * 1000;
/** Final submit bump target when start is too soon: now + 62 minutes (same as the minimum). */
export const UETDS_SUBMIT_ADJUST_LEAD_MS = 62 * 60 * 1000;
/** Airport pickup automatic end: start + 3 hours. */
export const UETDS_DEFAULT_END_OFFSET_MS = 3 * 60 * 60 * 1000;
/** Other pickup automatic end: start + 2 hours. */
export const UETDS_OTHER_END_OFFSET_MS = 2 * 60 * 60 * 1000;
/** Airport pickup earliest accepted end: start + 60 minutes. No maximum. */
export const UETDS_AIRPORT_MIN_END_MS = 60 * 60 * 1000;
/** Other pickup earliest accepted end: start + 30 minutes. No maximum. */
export const UETDS_OTHER_MIN_END_MS = 30 * 60 * 1000;
/** @deprecated Use UETDS_DEFAULT_START_LEAD_MS. */
export const UETDS_MIN_START_LEAD_MS = UETDS_DEFAULT_START_LEAD_MS;

export type UetdsDateTimeParts = {
  date: string;
  time: string;
  local: string;
};

export function joinUetdsDateTime(date: string, time: string) {
  return `${date.trim()}T${time.trim()}`;
}

export function splitUetdsLocal(local: string): UetdsDateTimeParts {
  return {
    date: local.slice(0, 10),
    time: local.slice(11, 16),
    local,
  };
}

function ceilToIstanbulMinute(utcMs: number) {
  const local = formatUtcToIstanbulLocal(utcMs);
  const flooredUtc = istanbulLocalToUtcMs(local);
  if (!Number.isFinite(flooredUtc) || flooredUtc >= utcMs) {
    return splitUetdsLocal(local);
  }
  return splitUetdsLocal(formatUtcToIstanbulLocal(flooredUtc + 60 * 1000));
}

export function uetdsMinimumStart(nowUtcMs = Date.now()): UetdsDateTimeParts {
  return ceilToIstanbulMinute(nowUtcMs + UETDS_DEFAULT_START_LEAD_MS);
}

export function uetdsSubmitAdjustedStart(nowUtcMs = Date.now()): UetdsDateTimeParts {
  return ceilToIstanbulMinute(nowUtcMs + UETDS_SUBMIT_ADJUST_LEAD_MS);
}

export function uetdsStartRemainingMs(date: string, time: string, nowUtcMs: number) {
  const startUtc = istanbulLocalToUtcMs(joinUetdsDateTime(date, time));
  if (!Number.isFinite(startUtc)) {
    return Number.NaN;
  }
  return startUtc - nowUtcMs;
}

export function addUetdsDuration(
  date: string,
  time: string,
  offsetMs: number,
): UetdsDateTimeParts {
  const startUtc = istanbulLocalToUtcMs(joinUetdsDateTime(date, time));
  if (!Number.isFinite(startUtc)) {
    return { date: "", time: "", local: "" };
  }
  return splitUetdsLocal(formatUtcToIstanbulLocal(startUtc + offsetMs));
}

export function isUetdsAirportPickup(location: {
  locationType?: string | null;
  districtOrAirportCode?: string | null;
  districtOrAirportName?: string | null;
  placeName?: string | null;
  formattedAddress?: string | null;
} | null | undefined) {
  return uetdsLocationIsAirport(location);
}

export function uetdsAutomaticEndOffsetMs(airportPickup: boolean) {
  return airportPickup ? UETDS_DEFAULT_END_OFFSET_MS : UETDS_OTHER_END_OFFSET_MS;
}

export function uetdsMinimumEndOffsetMs(airportPickup: boolean) {
  return airportPickup ? UETDS_AIRPORT_MIN_END_MS : UETDS_OTHER_MIN_END_MS;
}

export function defaultUetdsEndFromStart(date: string, time: string, airportPickup = false) {
  return addUetdsDuration(date, time, uetdsAutomaticEndOffsetMs(airportPickup));
}

export function minimumUetdsEndFromStart(date: string, time: string, airportPickup = false) {
  return addUetdsDuration(date, time, uetdsMinimumEndOffsetMs(airportPickup));
}

function hasCompleteUetdsDateTime(date: string, time: string) {
  const utc = istanbulLocalToUtcMs(joinUetdsDateTime(date, time));
  return Boolean(date.trim() && time.trim() && Number.isFinite(utc));
}

/** Keep a later end. Raise only to the pickup minimum, never to a maximum. */
export function ensureUetdsMinimumEnd(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  airportPickup = false,
) {
  const minimum = minimumUetdsEndFromStart(startDate, startTime, airportPickup);
  if (!minimum.date || !minimum.time) {
    return { endDate, endTime, adjusted: false };
  }
  const endUtc = istanbulLocalToUtcMs(joinUetdsDateTime(endDate, endTime));
  const minimumUtc = istanbulLocalToUtcMs(joinUetdsDateTime(minimum.date, minimum.time));
  if (!Number.isFinite(endUtc) || endUtc < minimumUtc) {
    return { endDate: minimum.date, endTime: minimum.time, adjusted: true };
  }
  return { endDate: endDate.trim(), endTime: endTime.trim(), adjusted: false };
}

export function applyUetdsStartToEnd(input: {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  endManual: boolean;
  /**
   * New-notification pickup rule. Omit it for the edit form, which keeps its
   * existing +3 hour fallback when an end is missing or not after the start.
   */
  airportPickup?: boolean;
}) {
  const startUtc = istanbulLocalToUtcMs(joinUetdsDateTime(input.startDate, input.startTime));
  const endUtc = istanbulLocalToUtcMs(joinUetdsDateTime(input.endDate, input.endTime));
  if (!Number.isFinite(startUtc)) {
    return { endDate: input.endDate, endTime: input.endTime, raisedToMinimum: false };
  }
  if (input.airportPickup === undefined) {
    if (!input.endManual || !Number.isFinite(endUtc) || endUtc <= startUtc) {
      const next = addUetdsDuration(input.startDate, input.startTime, UETDS_DEFAULT_END_OFFSET_MS);
      return { endDate: next.date, endTime: next.time, raisedToMinimum: false };
    }
    return { endDate: input.endDate, endTime: input.endTime, raisedToMinimum: false };
  }
  if (!input.endManual || !Number.isFinite(endUtc)) {
    const next = defaultUetdsEndFromStart(input.startDate, input.startTime, input.airportPickup);
    return { endDate: next.date, endTime: next.time, raisedToMinimum: false };
  }
  const minimum = ensureUetdsMinimumEnd(
    input.startDate,
    input.startTime,
    input.endDate,
    input.endTime,
    input.airportPickup,
  );
  return {
    endDate: minimum.endDate,
    endTime: minimum.endTime,
    raisedToMinimum: minimum.adjusted,
  };
}

export function isUetdsStartOnOrAfterMinimum(
  date: string,
  time: string,
  minimumLocal: string,
) {
  return isIstanbulLocalOnOrAfter(joinUetdsDateTime(date, time), minimumLocal);
}

export function isUetdsEndAfterStart(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
) {
  const startUtc = istanbulLocalToUtcMs(joinUetdsDateTime(startDate, startTime));
  const endUtc = istanbulLocalToUtcMs(joinUetdsDateTime(endDate, endTime));
  return Number.isFinite(startUtc) && Number.isFinite(endUtc) && endUtc > startUtc;
}

export function uetdsTripTimeIssues(
  input: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
  },
) {
  const issues: string[] = [];
  if (
    input.startDate.trim() &&
    input.startTime.trim() &&
    input.endDate.trim() &&
    input.endTime.trim() &&
    !isUetdsEndAfterStart(input.startDate, input.startTime, input.endDate, input.endTime)
  ) {
    issues.push("endBeforeStart");
  }
  return issues;
}

export type UetdsTripTimeAdjustment = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  startAdjusted: boolean;
  endAdjusted: boolean;
};

/**
 * Authoritative create-submit guard (server clock):
 * - if start < now + 62m → start = now + 62m
 * - an automatic end is recomputed from that final start (+3h airport, +2h otherwise)
 * - a manual end is kept when it meets the pickup minimum; a shorter one is raised only to that minimum
 */
export function adjustUetdsTripTimesForSubmit(
  input: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    endManual: boolean;
    airportPickup?: boolean;
  },
  nowUtcMs = Date.now(),
): UetdsTripTimeAdjustment {
  const remaining = uetdsStartRemainingMs(input.startDate, input.startTime, nowUtcMs);
  let startDate = input.startDate;
  let startTime = input.startTime;
  let startAdjusted = false;
  if (!Number.isFinite(remaining) || remaining < UETDS_SUBMIT_MIN_REMAINING_MS) {
    const start = uetdsSubmitAdjustedStart(nowUtcMs);
    startDate = start.date;
    startTime = start.time;
    startAdjusted = true;
  }
  const airportPickup = input.airportPickup === true;
  const end = input.endManual && hasCompleteUetdsDateTime(input.endDate, input.endTime)
    ? ensureUetdsMinimumEnd(startDate, startTime, input.endDate, input.endTime, airportPickup)
    : (() => {
        const next = defaultUetdsEndFromStart(startDate, startTime, airportPickup);
        return {
          endDate: next.date,
          endTime: next.time,
          adjusted: next.date !== input.endDate || next.time !== input.endTime,
        };
      })();
  return {
    startDate,
    startTime,
    endDate: end.endDate,
    endTime: end.endTime,
    startAdjusted,
    endAdjusted: end.adjusted,
  };
}

/**
 * Deterministic AI/prefill trip times (not model guessing):
 * - missing/too-early start → extraction_now + 65m
 * - missing end → start + 3h at an airport, otherwise start + 2h
 * - an explicit end is kept when it meets the pickup minimum; a shorter one is raised only to that minimum
 */
export function applyUetdsAiExtractionTripTimes(
  input: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
  },
  nowUtcMs = Date.now(),
  airportPickup = false,
): {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  startFromFallback: boolean;
  endAdjusted: boolean;
  endManual: boolean;
} {
  let startDate = input.startDate.trim();
  let startTime = input.startTime.trim();
  let startFromFallback = false;
  if (
    !hasCompleteUetdsDateTime(startDate, startTime) ||
    uetdsStartRemainingMs(startDate, startTime, nowUtcMs) < UETDS_DEFAULT_START_LEAD_MS
  ) {
    const start = uetdsMinimumStart(nowUtcMs);
    startDate = start.date;
    startTime = start.time;
    startFromFallback = true;
  }
  if (!hasCompleteUetdsDateTime(input.endDate, input.endTime)) {
    const end = defaultUetdsEndFromStart(startDate, startTime, airportPickup);
    return {
      startDate,
      startTime,
      endDate: end.date,
      endTime: end.time,
      startFromFallback,
      endAdjusted: true,
      endManual: false,
    };
  }
  const end = ensureUetdsMinimumEnd(startDate, startTime, input.endDate, input.endTime, airportPickup);
  return {
    startDate,
    startTime,
    endDate: end.endDate,
    endTime: end.endTime,
    startFromFallback,
    endAdjusted: end.adjusted,
    endManual: true,
  };
}

export function applyManualUetdsTripDefaults(nowUtcMs = Date.now()) {
  const start = uetdsMinimumStart(nowUtcMs);
  const end = defaultUetdsEndFromStart(start.date, start.time, false);
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    endManual: false,
  };
}
