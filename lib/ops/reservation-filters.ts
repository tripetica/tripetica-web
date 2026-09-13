import {
  addCalendarDays,
  istanbulDayStart,
  istanbulToday,
  monthStart,
  nextMonthStart,
  parseIsoDate,
} from "@/lib/ops/process-filters";

export const RESERVATION_DATE_PRESETS = [
  "today",
  "yesterday",
  "tomorrow",
  "7d",
  "month",
  "next_month",
  "past_month",
  "upcoming",
  "past",
  "range",
] as const;

export type ReservationDatePreset = (typeof RESERVATION_DATE_PRESETS)[number];

export const RESERVATION_SORT_FIELDS = ["pickup_at", "created_at"] as const;
export type ReservationSortField = (typeof RESERVATION_SORT_FIELDS)[number];
export const RESERVATION_SORT_DIRS = ["asc", "desc"] as const;
export type ReservationSortDir = (typeof RESERVATION_SORT_DIRS)[number];

export const RESERVATION_STATUSES = ["confirmed", "cancelled", "payment_pending"] as const;
export const RESERVATION_PAYMENT_METHODS = ["cash", "sbp"] as const;
export const RESERVATION_OPERATION_FILTERS = ["completed"] as const;
export type ReservationOperationFilter = (typeof RESERVATION_OPERATION_FILTERS)[number];

const OPERATION_TOLERANCE_MS = 6 * 60 * 60 * 1000;

export type ReservationListFilters = {
  query: string;
  status: string;
  payment: string;
  date: ReservationDatePreset | "";
  from: string;
  to: string;
  sort: ReservationSortField | "";
  dir: ReservationSortDir | "";
  operation?: ReservationOperationFilter | "";
};

export type PickupAtBounds =
  | { kind: "range"; start: Date; end: Date }
  | { kind: "after"; start: Date }
  | { kind: "before"; end: Date };

function operationCutoff(nowUtcMs = Date.now()): Date {
  return new Date(nowUtcMs - OPERATION_TOLERANCE_MS);
}

function dayRange(fromIso: string, toIso: string): PickupAtBounds | null {
  const start = istanbulDayStart(fromIso);
  const end = istanbulDayStart(addCalendarDays(toIso, 1));
  if (!start || !end) {
    return null;
  }
  return { kind: "range", start, end };
}

export function parseReservationDatePreset(value: string): ReservationDatePreset | "" {
  return (RESERVATION_DATE_PRESETS as readonly string[]).includes(value)
    ? (value as ReservationDatePreset)
    : "";
}

export function parseReservationStatus(value: string) {
  return (RESERVATION_STATUSES as readonly string[]).includes(value) ? value : "";
}

export function parseReservationPayment(value: string) {
  return (RESERVATION_PAYMENT_METHODS as readonly string[]).includes(value) ? value : "";
}

export function parseReservationOperation(value: string) {
  return (RESERVATION_OPERATION_FILTERS as readonly string[]).includes(value)
    ? (value as ReservationOperationFilter)
    : "";
}

export function pickupAtBounds(
  preset: ReservationDatePreset | "",
  from: string,
  to: string,
  nowUtcMs = Date.now(),
): PickupAtBounds | null {
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
  if (preset === "tomorrow") {
    const tomorrow = addCalendarDays(today, 1);
    return dayRange(tomorrow, tomorrow);
  }
  if (preset === "7d") {
    const start = operationCutoff(nowUtcMs);
    const end = istanbulDayStart(addCalendarDays(today, 7));
    if (!end) {
      return null;
    }
    return { kind: "range", start, end };
  }
  if (preset === "month") {
    const start = istanbulDayStart(monthStart(today));
    const end = istanbulDayStart(nextMonthStart(today));
    if (!start || !end) {
      return null;
    }
    return { kind: "range", start, end };
  }
  if (preset === "next_month") {
    const nextStart = nextMonthStart(today);
    const afterNext = nextMonthStart(nextStart);
    const start = istanbulDayStart(nextStart);
    const end = istanbulDayStart(afterNext);
    if (!start || !end) {
      return null;
    }
    return { kind: "range", start, end };
  }
  if (preset === "past_month") {
    const thisMonthStart = monthStart(today);
    const prevMonthStart = monthStart(addCalendarDays(thisMonthStart, -1));
    const start = istanbulDayStart(prevMonthStart);
    const end = istanbulDayStart(thisMonthStart);
    if (!start || !end) {
      return null;
    }
    return { kind: "range", start, end };
  }
  if (preset === "upcoming") {
    return { kind: "after", start: operationCutoff(nowUtcMs) };
  }
  if (preset === "past") {
    return { kind: "before", end: operationCutoff(nowUtcMs) };
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

export function parseReservationSortField(value: string): ReservationSortField | "" {
  return (RESERVATION_SORT_FIELDS as readonly string[]).includes(value)
    ? (value as ReservationSortField)
    : "";
}

export function parseReservationSortDir(value: string): ReservationSortDir | "" {
  return (RESERVATION_SORT_DIRS as readonly string[]).includes(value)
    ? (value as ReservationSortDir)
    : "";
}

export function nextReservationSortDir(
  currentSort: ReservationSortField | "",
  currentDir: ReservationSortDir | "",
  field: ReservationSortField,
): ReservationSortDir {
  if (currentSort === field && currentDir === "asc") {
    return "desc";
  }
  if (currentSort === field && currentDir === "desc") {
    return "asc";
  }
  return "asc";
}

export function reservationOrderBy(
  filters: ReservationListFilters,
  alias = "",
): string {
  const col = (name: "pickup_at" | "created_at" | "id") =>
    alias ? `${alias}.${name}` : name;
  const dir = filters.dir === "desc" ? "DESC" : "ASC";
  if (filters.sort === "pickup_at") {
    return `${col("pickup_at")} ${dir} NULLS LAST, ${col("created_at")} ${dir}, ${col("id")} ${dir}`;
  }
  if (filters.sort === "created_at") {
    return `${col("created_at")} ${dir}, ${col("id")} ${dir}`;
  }
  if (filters.date === "upcoming") {
    return `${col("pickup_at")} ASC NULLS LAST, ${col("created_at")} ASC, ${col("id")} ASC`;
  }
  return `${col("created_at")} DESC, ${col("id")} DESC`;
}

export function reservationQueryRecord(
  filters: ReservationListFilters,
): Record<string, string> {
  return {
    q: filters.query,
    status: filters.status,
    payment: filters.payment,
    date: filters.date,
    from: filters.date === "range" ? filters.from : "",
    to: filters.date === "range" ? filters.to : "",
    sort: filters.sort,
    dir: filters.sort ? filters.dir || "asc" : "",
    operation: filters.operation ?? "",
  };
}

export function hasActiveReservationFilters(filters: ReservationListFilters) {
  return Boolean(
    filters.query ||
      filters.status ||
      filters.payment ||
      filters.date ||
      filters.operation,
  );
}

export function parseReservationListFilters(input: {
  q?: string;
  status?: string;
  payment?: string;
  date?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  operation?: string;
}): ReservationListFilters {
  const date = parseReservationDatePreset(input.date ?? "");
  const from = parseIsoDate(input.from ?? "") ?? "";
  const to = parseIsoDate(input.to ?? "") ?? "";
  const sort = parseReservationSortField(input.sort ?? "");
  const dir = sort
    ? parseReservationSortDir(input.dir ?? "") || "asc"
    : "";
  return {
    query: (input.q ?? "").trim(),
    status: parseReservationStatus(input.status ?? ""),
    payment: parseReservationPayment(input.payment ?? ""),
    date,
    from: date === "range" ? from : "",
    to: date === "range" ? to : "",
    sort,
    dir,
    operation: parseReservationOperation(input.operation ?? ""),
  };
}
