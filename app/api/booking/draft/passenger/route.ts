import { NextRequest, NextResponse } from "next/server";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import {
  PASSENGER_GENDERS,
  upsertDraftPassenger,
  type PassengerGender,
} from "@/lib/booking/reservation-search";
import { draftToView } from "@/lib/booking/transfer-draft-hydration";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | null | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return "invalid";
  }
  return value;
}

function optionalGender(value: unknown): PassengerGender | null | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && PASSENGER_GENDERS.includes(value as PassengerGender)) {
    return value as PassengerGender;
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
  const sequenceNo =
    typeof body.sequenceNo === "number" && Number.isInteger(body.sequenceNo)
      ? body.sequenceNo
      : null;
  if (sequenceNo === null) {
    return NextResponse.json({ error: "Invalid passenger" }, { status: 400 });
  }

  const firstName = optionalString(body.firstName);
  const lastName = optionalString(body.lastName);
  const countryCode = optionalString(body.countryCode);
  const identityNumber = optionalString(body.identityNumber);
  const gender = optionalGender(body.gender);
  if (
    firstName === "invalid" ||
    lastName === "invalid" ||
    countryCode === "invalid" ||
    identityNumber === "invalid" ||
    gender === "invalid"
  ) {
    return NextResponse.json({ error: "Invalid passenger fields" }, { status: 400 });
  }

  try {
    const result = await upsertDraftPassenger(browserSessionId, {
      sequenceNo,
      firstName,
      lastName,
      countryCode,
      identityNumber,
      gender,
    });
    if (result.status === "missing") {
      return NextResponse.json({ error: "No active search" }, { status: 404 });
    }
    if (result.status === "invalid") {
      return NextResponse.json({ error: "Invalid passenger" }, { status: 400 });
    }
    return NextResponse.json({
      draft: await draftToView(result.draft, locale, result.draft.selected.distanceKm === null),
    });
  } catch (error) {
    console.error("[Tripetica draft-passenger]", error);
    return NextResponse.json({ error: "Could not save passenger" }, { status: 500 });
  }
}
