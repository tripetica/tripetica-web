import { airportPresetByCode, locationFromAirportPreset } from "@/lib/booking/catalog";
import { cloneLocation } from "@/lib/booking/draft-view";
import {
  emptyLocation,
  isLocationFilled,
  type AirportCode,
  type LocationValue,
} from "@/lib/booking/types";

export const LAYOVER_AIRPORT_CODES = ["IST", "SAW"] as const satisfies readonly AirportCode[];

export type LayoverAirportCode = (typeof LAYOVER_AIRPORT_CODES)[number];

export function isLayoverAirportCode(
  value: string | null | undefined,
): value is LayoverAirportCode {
  const code = value?.trim().toUpperCase();
  return code === "IST" || code === "SAW";
}

export function layoverAirportCodeFromLocation(
  location: LocationValue | null | undefined,
): LayoverAirportCode | null {
  if (!location || !isLocationFilled(location)) {
    return null;
  }
  if (!isLayoverAirportCode(location.airportCode)) {
    return null;
  }
  return location.airportCode.trim().toUpperCase() as LayoverAirportCode;
}

export function layoverAirportCodeFromDraft(
  airportCode: string | null | undefined,
  locationType: string | null | undefined,
): LayoverAirportCode | null {
  if (locationType !== "airport" || !isLayoverAirportCode(airportCode)) {
    return null;
  }
  return airportCode.trim().toUpperCase() as LayoverAirportCode;
}

/** Matrix base price in EUR from canonical IST/SAW pair. */
export function layoverBaseEur(
  pickupCode: LayoverAirportCode | null | undefined,
  dropoffCode: LayoverAirportCode | null | undefined,
): number {
  if (!pickupCode || !dropoffCode) {
    return 150;
  }
  if (pickupCode === "IST" && dropoffCode === "IST") {
    return 140;
  }
  if (pickupCode === "SAW" && dropoffCode === "SAW") {
    return 160;
  }
  return 150;
}

export function locationForLayoverAirport(
  code: LayoverAirportCode,
  label: string,
): LocationValue {
  return locationFromAirportPreset(airportPresetByCode(code), label);
}

export function normalizeLayoverTourLocations(
  pickup: LocationValue,
  dropoff: LocationValue | null,
  airportLabels: Record<AirportCode, string>,
): { pickup: LocationValue; dropoff: LocationValue } {
  const pickupCode = layoverAirportCodeFromLocation(pickup);
  if (!pickupCode) {
    return { pickup: emptyLocation(), dropoff: emptyLocation() };
  }
  const nextPickup = locationForLayoverAirport(pickupCode, airportLabels[pickupCode]);
  const dropoffCode = layoverAirportCodeFromLocation(dropoff);
  const nextDropoff = dropoffCode
    ? locationForLayoverAirport(dropoffCode, airportLabels[dropoffCode])
    : cloneLocation(nextPickup);
  return { pickup: nextPickup, dropoff: nextDropoff };
}
