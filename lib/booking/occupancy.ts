import { pickupIsAirport } from "@/lib/booking/meet-and-greet";

/**
 * Occupancy CHECK in reservation_searches: counts must be NULL or >= 0.
 * Product maxima below are UI/API limits for the booking panel.
 */
export const PASSENGER_COUNT_UNSET = 0;
export const PASSENGER_COUNT_MIN = 1;
export const PASSENGER_COUNT_MAX = 45;
export const BOOKING_SELECT_BLOCKED_EVENT = "tripetica:booking-select-blocked";
export const LUGGAGE_COUNT_MIN = 0;
export const LUGGAGE_COUNT_MAX = 45;
export const BABY_SEAT_COUNT_MIN = 0;
export const BABY_SEAT_COUNT_MAX = 5;

export function normalizeOccupancyCount(
  value: number | null,
  min: number,
  max: number,
) {
  if (value === null) {
    return null;
  }
  return Math.min(max, Math.max(min, value));
}

export function displayPassengerCount(value: number | null) {
  if (value === null) {
    return PASSENGER_COUNT_UNSET;
  }
  return (
    normalizeOccupancyCount(value, PASSENGER_COUNT_UNSET, PASSENGER_COUNT_MAX) ??
    PASSENGER_COUNT_UNSET
  );
}

export function hasAppliedPassengerCount(count: number | null) {
  return count !== null && count >= PASSENGER_COUNT_MIN;
}

/** Highest sequence_no to keep when trimming draft passengers. Null means do not delete. */
export function maxKeptDraftPassengerSequence(appliedPassengerCount: number | null) {
  if (
    appliedPassengerCount === null ||
    !Number.isInteger(appliedPassengerCount) ||
    appliedPassengerCount < PASSENGER_COUNT_MIN
  ) {
    return null;
  }
  return appliedPassengerCount;
}

export function displayLuggageCount(value: number | null) {
  return normalizeOccupancyCount(value, LUGGAGE_COUNT_MIN, LUGGAGE_COUNT_MAX)
    ?? LUGGAGE_COUNT_MIN;
}

export function displayBabySeatCount(value: number | null) {
  return normalizeOccupancyCount(value, BABY_SEAT_COUNT_MIN, BABY_SEAT_COUNT_MAX)
    ?? BABY_SEAT_COUNT_MIN;
}

export function occupancyCountsAreSet(
  passengerCount: number | null,
  luggageCount: number | null,
  babySeatCount: number | null,
) {
  return (
    passengerCount !== null ||
    luggageCount !== null ||
    babySeatCount !== null
  );
}

export function occupancyNeedsNormalize(
  passengerCount: number | null,
  luggageCount: number | null,
  babySeatCount: number | null,
) {
  return (
    normalizeOccupancyCount(passengerCount, PASSENGER_COUNT_UNSET, PASSENGER_COUNT_MAX)
      !== passengerCount
    || normalizeOccupancyCount(luggageCount, LUGGAGE_COUNT_MIN, LUGGAGE_COUNT_MAX)
      !== luggageCount
    || normalizeOccupancyCount(babySeatCount, BABY_SEAT_COUNT_MIN, BABY_SEAT_COUNT_MAX)
      !== babySeatCount
  );
}

export function isAirportPickup(location: {
  type?: string | null;
  airportCode?: string | null;
  placeId?: string | null;
  placeTypes?: string[] | null;
  locationType?: string | null;
}) {
  return pickupIsAirport(location);
}

export function normalizeFlightCode(value: string) {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

export function shouldShowFlightCode(
  pickup: {
    type?: string | null;
    airportCode?: string | null;
    placeId?: string | null;
    placeTypes?: string[] | null;
    locationType?: string | null;
  },
  flightCode: string | null | undefined,
) {
  if (!isAirportPickup(pickup)) {
    return false;
  }
  return normalizeFlightCode(flightCode ?? "").length > 0;
}

export function occupancyRange(min: number, max: number) {
  const values: number[] = [];
  for (let value = min; value <= max; value += 1) {
    values.push(value);
  }
  return values;
}
