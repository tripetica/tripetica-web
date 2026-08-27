import { airportPresets } from "@/lib/booking/catalog";
import { type AirportCode } from "@/lib/booking/types";

export type MeetAndGreetMode = "hidden" | "optional" | "required";

export type PickupAirportInput = {
  type?: string | null;
  locationType?: string | null;
  airportCode?: string | null;
  placeId?: string | null;
  placeTypes?: string[] | null;
};

const PRESET_BY_PLACE_ID = new Map(
  airportPresets.map((preset) => [preset.placeId, preset.id]),
);

function normalizePlaceId(placeId: string | null | undefined) {
  return placeId?.replace(/^places\//, "").trim() ?? "";
}

export function pickupAirportCode(
  location: PickupAirportInput,
): AirportCode | null {
  const code = location.airportCode?.trim().toUpperCase() ?? "";
  if (code === "IST" || code === "SAW" || code === "AYT") {
    return code;
  }
  return PRESET_BY_PLACE_ID.get(normalizePlaceId(location.placeId)) ?? null;
}

export function pickupIsAirport(location: PickupAirportInput) {
  if (pickupAirportCode(location)) {
    return true;
  }
  if (location.type === "airport" || location.locationType === "airport") {
    return true;
  }
  return Boolean(location.placeTypes?.includes("airport"));
}

export function meetAndGreetMode(pickup: PickupAirportInput): MeetAndGreetMode {
  if (!pickupIsAirport(pickup)) {
    return "hidden";
  }
  if (pickupAirportCode(pickup) === "AYT") {
    return "required";
  }
  return "optional";
}

export function normalizeMeetAndGreet(
  pickup: PickupAirportInput,
  requested: boolean | null | undefined,
) {
  const mode = meetAndGreetMode(pickup);
  if (mode === "hidden") {
    return false;
  }
  if (mode === "required") {
    return true;
  }
  return requested === true;
}
