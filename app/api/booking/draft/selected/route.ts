import { NextRequest, NextResponse } from "next/server";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { tourOptions } from "@/lib/booking/catalog";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { bosphorusLocalDateTimeFromDate } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import {
  toPersistedLocation,
  UntrustedLocationError,
} from "@/lib/booking/location-persist";
import {
  BABY_SEAT_COUNT_MAX,
  BABY_SEAT_COUNT_MIN,
  LUGGAGE_COUNT_MAX,
  LUGGAGE_COUNT_MIN,
  PASSENGER_COUNT_MAX,
  PASSENGER_COUNT_UNSET,
  normalizeFlightCode,
} from "@/lib/booking/occupancy";
import { updateSelectedTrip } from "@/lib/booking/reservation-search";
import {
  BURSA_ROUTE_BRIDGE,
  BURSA_ROUTE_BRIDGE_ULUDAG,
  BURSA_ROUTE_FERRY,
  BURSA_ROUTE_FERRY_ULUDAG,
  type BursaRouteOption,
} from "@/lib/booking/pricing/bursa-pricing";
import { BOSPHORUS_PAX_MAX } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { draftToView } from "@/lib/booking/transfer-draft-hydration";
import { isDisplayCurrency } from "@/lib/booking/pricing/format-eur";
import { isLocationFilled, type LocationValue } from "@/lib/booking/types";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCount(
  value: unknown,
  min: number,
  max: number,
): number | null | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return "invalid";
  }
  return value;
}

function parseOptionalBoolean(value: unknown): boolean | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    return "invalid";
  }
  return value;
}

function parseOptionalFlightCode(value: unknown): string | null | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    return "invalid";
  }
  const normalized = normalizeFlightCode(value);
  return normalized.length > 0 ? normalized : null;
}

const BOOKABLE_VEHICLE_TOUR_CODES: ReadonlySet<string> = new Set(
  tourOptions
    .filter(
      (tour) =>
        tour.behaviorType === "vehicleBooking" ||
        tour.behaviorType === "perPersonBooking",
    )
    .map((tour) => tour.id),
);

function parseOptionalTourCode(value: unknown): string | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== "string" ||
    !BOOKABLE_VEHICLE_TOUR_CODES.has(value.trim())
  ) {
    return "invalid";
  }
  return value.trim();
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
  const lat = typeof value.lat === "number" && Number.isFinite(value.lat) ? value.lat : null;
  const lng = typeof value.lng === "number" && Number.isFinite(value.lng) ? value.lng : null;
  return {
    source,
    name: typeof value.name === "string" ? value.name : "",
    formattedAddress:
      typeof value.formattedAddress === "string" ? value.formattedAddress : null,
    placeId: typeof value.placeId === "string" ? value.placeId : null,
    lat,
    lng,
    city: typeof value.city === "string" ? value.city : null,
    district: typeof value.district === "string" ? value.district : null,
    region: typeof value.region === "string" ? value.region : null,
    country: typeof value.country === "string" ? value.country : null,
    countryCode: typeof value.countryCode === "string" ? value.countryCode : null,
    airportCode: typeof value.airportCode === "string" ? value.airportCode : null,
    type,
    placeTypes: Array.isArray(value.placeTypes)
      ? value.placeTypes.filter((item): item is string => typeof item === "string")
      : null,
  };
}

function parseBursaRoute(
  value: unknown,
): BursaRouteOption | null | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (
    value === BURSA_ROUTE_FERRY ||
    value === BURSA_ROUTE_BRIDGE ||
    value === BURSA_ROUTE_FERRY_ULUDAG ||
    value === BURSA_ROUTE_BRIDGE_ULUDAG
  ) {
    return value;
  }
  return "invalid";
}

export async function POST(request: NextRequest) {
  const browserSessionId = readBrowserSessionId(request);
  if (!browserSessionId) {
    return NextResponse.json({ error: "No active search" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const locale = typeof body.locale === "string" && isLocale(body.locale) ? body.locale : null;
  if (!locale) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const pickupInput = body.pickup === undefined ? undefined : parseLocation(body.pickup);
  const dropoffInput = body.dropoff === undefined ? undefined : parseLocation(body.dropoff);
  if (body.pickup !== undefined && (!pickupInput || !isLocationFilled(pickupInput))) {
    return NextResponse.json({ error: "Invalid pickup" }, { status: 400 });
  }
  if (body.dropoff !== undefined && (!dropoffInput || !isLocationFilled(dropoffInput))) {
    return NextResponse.json({ error: "Invalid dropoff" }, { status: 400 });
  }

  let pickupAt: Date | undefined;
  if (body.localDateTime !== undefined) {
    let localDateTime =
      typeof body.localDateTime === "string" ? body.localDateTime.trim() : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(localDateTime)) {
      localDateTime = bosphorusLocalDateTimeFromDate(localDateTime);
    }
    const utcMs = istanbulLocalToUtcMs(localDateTime);
    if (!localDateTime || Number.isNaN(utcMs)) {
      return NextResponse.json({ error: "Date and time are required" }, { status: 400 });
    }
    pickupAt = new Date(utcMs);
  }

  const passengerCount = parseCount(
    body.passengerCount,
    PASSENGER_COUNT_UNSET,
    PASSENGER_COUNT_MAX,
  );
  const luggageCount = parseCount(
    body.luggageCount,
    LUGGAGE_COUNT_MIN,
    LUGGAGE_COUNT_MAX,
  );
  const babySeatCount = parseCount(
    body.babySeatCount,
    BABY_SEAT_COUNT_MIN,
    BABY_SEAT_COUNT_MAX,
  );
  const meetAndGreet = parseOptionalBoolean(body.meetAndGreet);
  const flightCode = parseOptionalFlightCode(body.flightCode);
  const tourCode = parseOptionalTourCode(body.tourCode);
  const durationHours = parseCount(body.durationHours, 5, 20);
  const currency =
    body.currency === undefined
      ? undefined
      : typeof body.currency === "string" && isDisplayCurrency(body.currency.trim())
        ? body.currency.trim()
        : "invalid";
  const bursaRoute = parseBursaRoute(body.bursaRoute);
  const bosphorusAdultSoft = parseCount(
    body.bosphorusAdultSoft,
    0,
    BOSPHORUS_PAX_MAX,
  );
  const bosphorusAdultAlcohol = parseCount(
    body.bosphorusAdultAlcohol,
    0,
    BOSPHORUS_PAX_MAX,
  );
  const bosphorusChild5to9 = parseCount(
    body.bosphorusChild5to9,
    0,
    BOSPHORUS_PAX_MAX,
  );
  const bosphorusChild0to4 = parseCount(
    body.bosphorusChild0to4,
    0,
    BOSPHORUS_PAX_MAX,
  );

  if (
    passengerCount === "invalid" ||
    luggageCount === "invalid" ||
    babySeatCount === "invalid" ||
    meetAndGreet === "invalid" ||
    flightCode === "invalid" ||
    tourCode === "invalid" ||
    durationHours === "invalid" ||
    currency === "invalid" ||
    bursaRoute === "invalid" ||
    bosphorusAdultSoft === "invalid" ||
    bosphorusAdultAlcohol === "invalid" ||
    bosphorusChild5to9 === "invalid" ||
    bosphorusChild0to4 === "invalid"
  ) {
    return NextResponse.json({ error: "Invalid occupancy fields" }, { status: 400 });
  }

  if (
    !pickupInput &&
    !dropoffInput &&
    !pickupAt &&
    passengerCount === undefined &&
    luggageCount === undefined &&
    babySeatCount === undefined &&
    meetAndGreet === undefined &&
    flightCode === undefined &&
    tourCode === undefined &&
    durationHours === undefined &&
    currency === undefined &&
    bursaRoute === undefined &&
    bosphorusAdultSoft === undefined &&
    bosphorusAdultAlcohol === undefined &&
    bosphorusChild5to9 === undefined &&
    bosphorusChild0to4 === undefined
  ) {
    return NextResponse.json({ error: "No selected fields to update" }, { status: 400 });
  }

  try {
    const updated = await updateSelectedTrip(browserSessionId, {
      tourCode,
      pickup: pickupInput ? await toPersistedLocation(pickupInput, locale) : undefined,
      dropoff: dropoffInput ? await toPersistedLocation(dropoffInput, locale) : undefined,
      pickupAt,
      durationHours,
      passengerCount,
      luggageCount,
      babySeatCount,
      meetAndGreet,
      flightCode,
      currency,
      bursaRoute,
      bosphorusAdultSoft,
      bosphorusAdultAlcohol,
      bosphorusChild5to9,
      bosphorusChild0to4,
    });
    if (!updated) {
      return NextResponse.json({ error: "No active search" }, { status: 404 });
    }
    return NextResponse.json({
      draft: await draftToView(updated.draft, locale, updated.distanceError),
    });
  } catch (error) {
    if (error instanceof UntrustedLocationError) {
      return NextResponse.json(
        { error: "Location could not be verified" },
        { status: 400 },
      );
    }
    console.error("[Tripetica draft-selected]", error);
    return NextResponse.json({ error: "Could not update selection" }, { status: 500 });
  }
}
