import { parseIsoDate } from "@/lib/ops/process-filters";
import {
  parseReservationDatePreset,
  parseReservationOperation,
  pickupAtBounds,
  type PickupAtBounds,
  type ReservationDatePreset,
  type ReservationOperationFilter,
} from "@/lib/ops/reservation-filters";

export type PartnerAcceptedJobFilters = {
  date: ReservationDatePreset | "";
  from: string;
  to: string;
  operation: ReservationOperationFilter | "";
};

export const PARTNER_ACCEPTED_COMPLETED_EXISTS_SQL = `EXISTS (
         SELECT 1 FROM reservation_driver_tasks driver_task
         WHERE driver_task.reservation_id = reservations.id
           AND driver_task.current_stage = 'completed'
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
    operation: parseReservationOperation(input.operation ?? ""),
  };
}

export function partnerAcceptedJobQueryRecord(
  filters: PartnerAcceptedJobFilters,
): Record<string, string> {
  return {
    date: filters.date,
    from: filters.date === "range" ? filters.from : "",
    to: filters.date === "range" ? filters.to : "",
    operation: filters.operation ?? "",
  };
}

export function hasActivePartnerAcceptedJobFilters(filters: PartnerAcceptedJobFilters) {
  return Boolean(filters.date || filters.operation);
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

export function partnerAcceptedJobCompletedClause(
  operation: ReservationOperationFilter | "",
) {
  return operation === "completed"
    ? PARTNER_ACCEPTED_COMPLETED_EXISTS_SQL
    : `NOT ${PARTNER_ACCEPTED_COMPLETED_EXISTS_SQL}`;
}
