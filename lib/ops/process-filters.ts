import { getIstanbulClock, istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";

export const PROCESS_DATE_PRESETS = [
  "today",
  "yesterday",
  "7d",
  "month",
  "past",
  "range",
] as const;

export type ProcessDatePreset = (typeof PROCESS_DATE_PRESETS)[number];

export const PROCESS_STATUSES = ["draft", "completed", "expired"] as const;
export const PROCESS_LOCALES = ["tr", "en", "ru"] as const;
export const PROCESS_CONVERSIONS = ["converted", "open"] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProcessListFilters = {
  query: string;
  status: string;
  locale: string;
  conversion: string;
  date: ProcessDatePreset | "";
  from: string;
  to: string;
};

export type CreatedAtBounds =
  | { kind: "range"; start: Date; end: Date }
  | { kind: "before"; end: Date };

export function parseProcessDatePreset(value: string): ProcessDatePreset | "" {
  return (PROCESS_DATE_PRESETS as readonly string[]).includes(value)
    ? (value as ProcessDatePreset)
    : "";
}

export function parseProcessStatus(value: string) {
  return (PROCESS_STATUSES as readonly string[]).includes(value) ? value : "";
}

export function parseProcessLocaleFilter(value: string) {
  return (PROCESS_LOCALES as readonly string[]).includes(value) ? value : "";
}

export function parseProcessConversion(value: string) {
  return (PROCESS_CONVERSIONS as readonly string[]).includes(value) ? value : "";
}

export function parseIsoDate(value: string): string | null {
  const match = value.trim().match(ISO_DATE);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function isUuid(value: string) {
  return UUID.test(value);
}

export function uniqueUuids(values: string[]) {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of values) {
    const id = value.trim().toLowerCase();
    if (!isUuid(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function addCalendarDays(isoDate: string, days: number): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return "";
  }
  const year = Number(parsed.slice(0, 4));
  const month = Number(parsed.slice(5, 7));
  const day = Number(parsed.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

export function monthStart(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return "";
  }
  return `${parsed.slice(0, 7)}-01`;
}

export function nextMonthStart(isoDate: string): string {
  const start = monthStart(isoDate);
  if (!start) {
    return "";
  }
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  const utc = new Date(Date.UTC(year, month, 1));
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

export function istanbulDayStart(isoDate: string): Date | null {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return null;
  }
  const utcMs = istanbulLocalToUtcMs(`${parsed}T00:00`);
  if (!Number.isFinite(utcMs)) {
    return null;
  }
  return new Date(utcMs);
}

export function istanbulToday(nowUtcMs = Date.now()): string {
  return getIstanbulClock(nowUtcMs).nowLocal.slice(0, 10);
}

export function createdAtBounds(
  preset: ProcessDatePreset | "",
  from: string,
  to: string,
  nowUtcMs = Date.now(),
): CreatedAtBounds | null {
  if (!preset) {
    return null;
  }
  const today = istanbulToday(nowUtcMs);
  if (preset === "today") {
    return dayRange(today, today);
  }
  if (preset === "yesterday") {
    const yesterday = addCalendarDays(today, -1);
    return dayRange(yesterday, yesterday);
  }
  if (preset === "7d") {
    return dayRange(addCalendarDays(today, -6), today);
  }
  if (preset === "month") {
    const start = istanbulDayStart(monthStart(today));
    const end = istanbulDayStart(nextMonthStart(today));
    if (!start || !end) {
      return null;
    }
    return { kind: "range", start, end };
  }
  if (preset === "past") {
    const yesterday = istanbulDayStart(addCalendarDays(today, -1));
    if (!yesterday) {
      return null;
    }
    return { kind: "before", end: yesterday };
  }
  if (preset === "range") {
    const startDate = parseIsoDate(from);
    const endDate = parseIsoDate(to);
    if (!startDate && !endDate) {
      return null;
    }
    let first = startDate ?? endDate!;
    let last = endDate ?? startDate!;
    if (first > last) {
      const swap = first;
      first = last;
      last = swap;
    }
    return dayRange(first, last);
  }
  return null;
}

export function processQueryRecord(filters: ProcessListFilters): Record<string, string> {
  return {
    q: filters.query,
    status: filters.status,
    locale: filters.locale,
    conversion: filters.conversion,
    date: filters.date,
    from: filters.date === "range" ? filters.from : "",
    to: filters.date === "range" ? filters.to : "",
  };
}

export function hasActiveProcessFilters(filters: ProcessListFilters) {
  return Boolean(
    filters.query ||
      filters.status ||
      filters.locale ||
      filters.conversion ||
      filters.date,
  );
}

export function parseProcessListFilters(input: {
  q?: string;
  status?: string;
  locale?: string;
  conversion?: string;
  date?: string;
  from?: string;
  to?: string;
}): ProcessListFilters {
  const date = parseProcessDatePreset(input.date ?? "");
  const from = parseIsoDate(input.from ?? "") ?? "";
  const to = parseIsoDate(input.to ?? "") ?? "";
  return {
    query: (input.q ?? "").trim(),
    status: parseProcessStatus(input.status ?? ""),
    locale: parseProcessLocaleFilter(input.locale ?? ""),
    conversion: parseProcessConversion(input.conversion ?? ""),
    date,
    from: date === "range" ? from : "",
    to: date === "range" ? to : "",
  };
}

function dayRange(fromIso: string, toIso: string): CreatedAtBounds | null {
  const start = istanbulDayStart(fromIso);
  const end = istanbulDayStart(addCalendarDays(toIso, 1));
  if (!start || !end) {
    return null;
  }
  return { kind: "range", start, end };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}
