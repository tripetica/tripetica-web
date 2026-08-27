import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { toPersistedLocation } from "@/lib/booking/location-persist";
import { isLocationFilled, type LocationValue } from "@/lib/booking/types";
import { isLocale, type Locale } from "@/lib/i18n/config";

export type TransferSearchInputError = {
  status: 400;
  message: string;
};

export type ParsedTransferSearchInput = {
  locale: Locale;
  pickup: LocationValue;
  dropoff: LocationValue;
  pickupAt: Date;
  distanceKm: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNullableNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length > 0 ? items : null;
}

function parseLocation(value: unknown): LocationValue | null {
  if (!isRecord(value)) {
    return null;
  }
  const source =
    value.source === "preset" ||
    value.source === "google" ||
    value.source === "query"
      ? value.source
      : "query";
  const type = value.type === "airport" || value.type === "place" ? value.type : null;
  return {
    source,
    name: asString(value.name),
    formattedAddress: asNullableString(value.formattedAddress),
    placeId: asNullableString(value.placeId),
    lat: asNullableNumber(value.lat),
    lng: asNullableNumber(value.lng),
    city: asNullableString(value.city),
    district: asNullableString(value.district),
    region: asNullableString(value.region),
    country: asNullableString(value.country),
    countryCode: asNullableString(value.countryCode),
    airportCode: asNullableString(value.airportCode),
    type,
    placeTypes: asStringArray(value.placeTypes),
  };
}

function validCoordinate(lat: number | null, lng: number | null) {
  if (lat !== null && (lat < -90 || lat > 90)) {
    return false;
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    return false;
  }
  return true;
}

export function parseTransferSearchBody(
  body: unknown,
): ParsedTransferSearchInput | TransferSearchInputError {
  if (!isRecord(body)) {
    return { status: 400, message: "Invalid request body" };
  }

  const locale = typeof body.locale === "string" ? body.locale : "";
  if (!isLocale(locale)) {
    return { status: 400, message: "Invalid locale" };
  }

  const pickup = parseLocation(body.pickup);
  const dropoff = parseLocation(body.dropoff);
  if (!pickup || !dropoff || !isLocationFilled(pickup) || !isLocationFilled(dropoff)) {
    return { status: 400, message: "Pickup and dropoff are required" };
  }
  if (!validCoordinate(pickup.lat, pickup.lng) || !validCoordinate(dropoff.lat, dropoff.lng)) {
    return { status: 400, message: "Invalid coordinates" };
  }

  const localDateTime = asString(body.localDateTime).trim();
  const utcMs = istanbulLocalToUtcMs(localDateTime);
  if (!localDateTime || Number.isNaN(utcMs)) {
    return { status: 400, message: "Date and time are required" };
  }

  const distanceKm = asNullableNumber(body.distanceKm);
  if (distanceKm !== null && distanceKm < 0) {
    return { status: 400, message: "Invalid distance" };
  }

  return {
    locale,
    pickup,
    dropoff,
    pickupAt: new Date(utcMs),
    distanceKm,
  };
}

export async function toTransferSearchFields(input: ParsedTransferSearchInput) {
  return {
    locale: input.locale,
    pickup: await toPersistedLocation(input.pickup, input.locale),
    dropoff: await toPersistedLocation(input.dropoff, input.locale),
    pickupAt: input.pickupAt,
    distanceKm: input.distanceKm,
  };
}
