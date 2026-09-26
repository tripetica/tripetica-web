import {
  formatUtcToIstanbulLocal,
  istanbulLocalToUtcMs,
  isIstanbulLocalOnOrAfter,
} from "@/lib/booking/istanbul-time";

/** Form default and AI minimum start: analysis clock + 65 minutes. */
export const UETDS_DEFAULT_START_LEAD_MS = 65 * 60 * 1000;
/** Final submit: keep start only when it is already at least now + 62 minutes. */
export const UETDS_SUBMIT_MIN_REMAINING_MS = 62 * 60 * 1000;
/** Final submit bump target when start is too soon: now + 62 minutes (same as the minimum). */
export const UETDS_SUBMIT_ADJUST_LEAD_MS = 62 * 60 * 1000;
export const UETDS_DEFAULT_END_OFFSET_MS = 3 * 60 * 60 * 1000;
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

export function defaultUetdsEndFromStart(date: string, time: string) {
  return addUetdsDuration(date, time, UETDS_DEFAULT_END_OFFSET_MS);
}

function hasCompleteUetdsDateTime(date: string, time: string) {
  const utc = istanbulLocalToUtcMs(joinUetdsDateTime(date, time));
  return Boolean(date.trim() && time.trim() && Number.isFinite(utc));
}

/** Enforce end >= start + 3 hours (keep a later explicit end). */
export function ensureUetdsMinimumEnd(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
) {
  const minimum = defaultUetdsEndFromStart(startDate, startTime);
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
}) {
  const startUtc = istanbulLocalToUtcMs(joinUetdsDateTime(input.startDate, input.startTime));
  const endUtc = istanbulLocalToUtcMs(joinUetdsDateTime(input.endDate, input.endTime));
  if (!Number.isFinite(startUtc)) {
    return { endDate: input.endDate, endTime: input.endTime };
  }
  if (!input.endManual || !Number.isFinite(endUtc) || endUtc <= startUtc) {
    const next = defaultUetdsEndFromStart(input.startDate, input.startTime);
    return { endDate: next.date, endTime: next.time };
  }
  return { endDate: input.endDate, endTime: input.endTime };
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
 * - then end = max(end, final_start + 3h)
 */
export function adjustUetdsTripTimesForSubmit(
  input: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    endManual: boolean;
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
  const end = ensureUetdsMinimumEnd(startDate, startTime, input.endDate, input.endTime);
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
 * - end = max(source_end, start + 3h), or start + 3h when source end is missing
 */
export function applyUetdsAiExtractionTripTimes(
  input: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
  },
  nowUtcMs = Date.now(),
): {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  startFromFallback: boolean;
  endAdjusted: boolean;
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
    const end = defaultUetdsEndFromStart(startDate, startTime);
    return {
      startDate,
      startTime,
      endDate: end.date,
      endTime: end.time,
      startFromFallback,
      endAdjusted: true,
    };
  }
  const end = ensureUetdsMinimumEnd(startDate, startTime, input.endDate, input.endTime);
  return {
    startDate,
    startTime,
    endDate: end.endDate,
    endTime: end.endTime,
    startFromFallback,
    endAdjusted: end.adjusted,
  };
}

export function applyManualUetdsTripDefaults(nowUtcMs = Date.now()) {
  const start = uetdsMinimumStart(nowUtcMs);
  const end = defaultUetdsEndFromStart(start.date, start.time);
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    endManual: false,
  };
}
