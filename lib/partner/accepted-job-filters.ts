import { parseIsoDate } from "@/lib/ops/process-filters";
import {
  parseReservationDatePreset,
  pickupAtBounds,
  reservationOperationWhereSql,
  type PickupAtBounds,
  type ReservationDatePreset,
} from "@/lib/ops/reservation-filters";

export const PARTNER_ACCEPTED_OPERATIONS = ["active", "completed", "no_show"] as const;
export type PartnerAcceptedOperation = (typeof PARTNER_ACCEPTED_OPERATIONS)[number];

export type PartnerAcceptedJobFilters = {
  date: ReservationDatePreset | "";
  from: string;
  to: string;
  operation: PartnerAcceptedOperation;
};

export const PARTNER_ACCEPTED_PENDING_NO_SHOW_EXISTS_SQL = `EXISTS (
         SELECT 1 FROM reservation_driver_no_show_reports no_show_report
         WHERE no_show_report.reservation_id = reservations.id
           AND no_show_report.review_status = 'pending'
       )`;

export function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePartnerAcceptedJobFilters(input: {
  date?: string;
  from?: string;
  to?: string;
  operation?: string;
}): PartnerAcceptedJobFilters {
  const date = parseReservationDatePreset(input.date ?? "");
  const from = parseIsoDate(input.from ?? "") ?? "";
  const to = parseIsoDate(input.to ?? "") ?? "";
  return {
    date,
    from: date === "range" ? from : "",
    to: date === "range" ? to : "",
    operation: (PARTNER_ACCEPTED_OPERATIONS as readonly string[]).includes(
      input.operation ?? "",
    )
      ? (input.operation as PartnerAcceptedOperation)
      : "active",
  };
}

export function partnerAcceptedJobQueryRecord(
  filters: PartnerAcceptedJobFilters,
): Record<string, string> {
  return {
    date: filters.date,
    from: filters.date === "range" ? filters.from : "",
    to: filters.date === "range" ? filters.to : "",
    operation: filters.operation === "active" ? "" : filters.operation,
  };
}

export function hasActivePartnerAcceptedJobFilters(filters: PartnerAcceptedJobFilters) {
  return Boolean(filters.date || filters.operation !== "active");
}

export function partnerAcceptedJobPickupBounds(
  filters: PartnerAcceptedJobFilters,
  nowUtcMs = Date.now(),
) {
  return pickupAtBounds(filters.date, filters.from, filters.to, nowUtcMs);
}

export function appendPickupAtBoundsSql(
  clauses: string[],
  values: unknown[],
  bounds: PickupAtBounds,
  column = "pickup_at",
) {
  if (bounds.kind === "range") {
    values.push(bounds.start, bounds.end);
    clauses.push(`${column} >= $${values.length - 1} AND ${column} < $${values.length}`);
    return;
  }
  if (bounds.kind === "after") {
    values.push(bounds.start);
    clauses.push(`${column} >= $${values.length}`);
    return;
  }
  values.push(bounds.end);
  clauses.push(`${column} < $${values.length}`);
}

export function partnerAcceptedJobOperationClause(operation: PartnerAcceptedOperation) {
  if (operation === "completed") {
    return reservationOperationWhereSql("completed")!;
  }
  if (operation === "no_show") {
    return `(status = 'no_show' OR ${PARTNER_ACCEPTED_PENDING_NO_SHOW_EXISTS_SQL})`;
  }
  return `${reservationOperationWhereSql("active")!}
       AND NOT ${PARTNER_ACCEPTED_PENDING_NO_SHOW_EXISTS_SQL}`;
}
