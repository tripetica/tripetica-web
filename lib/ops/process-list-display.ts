import { shouldShowDistance } from "@/lib/booking/reservation-output-visibility";
import { opsVehicleLabelFor } from "@/lib/ops/record-detail";

export function preferredProcessCount(
  applied: number | null | undefined,
  selected: number | null | undefined,
): number | null {
  if (applied != null && Number.isFinite(applied)) {
    return applied;
  }
  if (selected != null && Number.isFinite(selected)) {
    return selected;
  }
  return null;
}

export function preferredProcessFlag(
  applied: boolean | null | undefined,
  selected: boolean | null | undefined,
): boolean | null {
  if (applied === true || applied === false) {
    return applied;
  }
  if (selected === true || selected === false) {
    return selected;
  }
  return null;
}

export function formatOpsExactCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return String(value);
}

export function formatPassengerLuggageBaby(
  passengerCount: number | null | undefined,
  luggageCount: number | null | undefined,
  babySeatCount: number | null | undefined,
): string {
  return [
    formatOpsExactCount(passengerCount),
    formatOpsExactCount(luggageCount),
    formatOpsExactCount(babySeatCount),
  ].join(" / ");
}

/** True only when a real vehicle selection was persisted — never inferred from price. */
export function processListHasSelectedVehicle(input: {
  appliedVehicleCode?: string | null;
  selectedVehicleCode?: string | null;
  appliedVehicleLabelTr?: string | null;
  selectedVehicleLabelTr?: string | null;
}): boolean {
  return Boolean(
    input.appliedVehicleCode?.trim() ||
      input.selectedVehicleCode?.trim() ||
      input.appliedVehicleLabelTr?.trim() ||
      input.selectedVehicleLabelTr?.trim(),
  );
}

export function processListVehicleClassLabel(input: {
  appliedVehicleCode: string | null | undefined;
  selectedVehicleCode: string | null | undefined;
  appliedVehicleLabelTr: string | null | undefined;
  selectedVehicleLabelTr: string | null | undefined;
}): string | null {
  const fromCode =
    opsVehicleLabelFor(input.appliedVehicleCode, "tr") ??
    opsVehicleLabelFor(input.selectedVehicleCode, "tr");
  if (fromCode) {
    return fromCode;
  }
  const stored =
    input.appliedVehicleLabelTr?.trim() ||
    input.selectedVehicleLabelTr?.trim() ||
    "";
  return stored || null;
}

export function processListFlightCode(
  applied: string | null | undefined,
  selected: string | null | undefined,
): string | null {
  const value = applied?.trim() || selected?.trim() || "";
  return value || null;
}

function finiteDistanceKm(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Stored pickup→dropoff km for transfer only. Hourly/tour rows stay empty — never invent a route. */
export function processListDistanceKm(
  serviceType: string | null | undefined,
  applied: string | number | null | undefined,
  selected: string | number | null | undefined,
): number | null {
  if (!shouldShowDistance(serviceType)) {
    return null;
  }
  return finiteDistanceKm(applied) ?? finiteDistanceKm(selected);
}
