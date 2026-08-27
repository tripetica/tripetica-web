import { NextRequest, NextResponse } from "next/server";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { isValidEmail } from "@/lib/booking/phone";
import { updateDraftContact } from "@/lib/booking/reservation-search";
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

  const email = optionalString(body.email);
  const phoneCountryCode = optionalString(body.phoneCountryCode);
  const phoneNational = optionalString(body.phoneNational);
  const notes = optionalString(body.notes);
  if (
    email === "invalid" ||
    phoneCountryCode === "invalid" ||
    phoneNational === "invalid" ||
    notes === "invalid"
  ) {
    return NextResponse.json({ error: "Invalid contact fields" }, { status: 400 });
  }
  if (email !== undefined && email !== null && email.trim() !== "" && !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (
    email === undefined &&
    phoneCountryCode === undefined &&
    phoneNational === undefined &&
    notes === undefined
  ) {
    return NextResponse.json({ error: "No contact fields to update" }, { status: 400 });
  }

  try {
    const result = await updateDraftContact(browserSessionId, {
      email,
      phoneCountryCode,
      phoneNational,
      notes,
    });
    if (result.status === "missing") {
      return NextResponse.json({ error: "No active search" }, { status: 404 });
    }
    return NextResponse.json({
      draft: await draftToView(result.draft, locale, result.draft.selected.distanceKm === null),
    });
  } catch (error) {
    console.error("[Tripetica draft-contact]", error);
    return NextResponse.json({ error: "Could not save contact" }, { status: 500 });
  }
}
