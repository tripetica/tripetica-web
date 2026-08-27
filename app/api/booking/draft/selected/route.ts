import { NextRequest, NextResponse } from "next/server";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { toPersistedLocation } from "@/lib/booking/location-persist";
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
    const localDateTime =
      typeof body.localDateTime === "string" ? body.localDateTime.trim() : "";
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
  const currency =
    body.currency === undefined
      ? undefined
      : typeof body.currency === "string" && isDisplayCurrency(body.currency.trim())
        ? body.currency.trim()
        : "invalid";

  if (
    passengerCount === "invalid" ||
    luggageCount === "invalid" ||
    babySeatCount === "invalid" ||
    meetAndGreet === "invalid" ||
    flightCode === "invalid" ||
    currency === "invalid"
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
    currency === undefined
  ) {
    return NextResponse.json({ error: "No selected fields to update" }, { status: 400 });
  }

  try {
    const updated = await updateSelectedTrip(browserSessionId, {
      pickup: pickupInput ? await toPersistedLocation(pickupInput, locale) : undefined,
      dropoff: dropoffInput ? await toPersistedLocation(dropoffInput, locale) : undefined,
      pickupAt,
      passengerCount,
      luggageCount,
      babySeatCount,
      meetAndGreet,
      flightCode,
      currency,
    });
    if (!updated) {
      return NextResponse.json({ error: "No active search" }, { status: 404 });
    }
    return NextResponse.json({
      draft: await draftToView(updated.draft, locale, updated.distanceError),
    });
  } catch (error) {
    console.error("[Tripetica draft-selected]", error);
    return NextResponse.json({ error: "Could not update selection" }, { status: 500 });
  }
}
