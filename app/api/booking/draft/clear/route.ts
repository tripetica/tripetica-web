import { NextRequest, NextResponse } from "next/server";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { clearDraftTripFields } from "@/lib/booking/reservation-search";
import { draftToView } from "@/lib/booking/transfer-draft-hydration";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: NextRequest) {
  const browserSessionId = readBrowserSessionId(request);
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

  const pickup = body.pickup === true;
  const dropoff = body.dropoff === true;
  const pickupAt = body.localDateTime === true;
  const durationHours = body.durationHours === true;
  const tourCode = body.tourCode === true;
  if (!pickup && !dropoff && !pickupAt && !durationHours && !tourCode) {
    return NextResponse.json({ error: "No fields to clear" }, { status: 400 });
  }

  if (!browserSessionId) {
    return NextResponse.json({ ok: true, draft: null });
  }

  try {
    const draft = await clearDraftTripFields(browserSessionId, {
      pickup,
      dropoff,
      pickupAt,
      durationHours,
      tourCode,
    });
    if (!draft) {
      return NextResponse.json({ ok: true, draft: null });
    }
    return NextResponse.json({
      ok: true,
      draft: await draftToView(draft, locale, draft.selected.distanceKm === null),
    });
  } catch (error) {
    console.error("[Tripetica draft-clear]", error);
    return NextResponse.json({ error: "Could not clear field" }, { status: 500 });
  }
}
