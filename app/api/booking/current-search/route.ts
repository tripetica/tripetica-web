import { NextRequest, NextResponse } from "next/server";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { isLocale } from "@/lib/i18n/config";
import { BOOKING_TIME_ZONE } from "@/lib/booking/istanbul-time";
import { findActiveDraft } from "@/lib/booking/reservation-search";
import { draftToView } from "@/lib/booking/transfer-draft-hydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const browserSessionId = readBrowserSessionId(request);
  const localeParam = request.nextUrl.searchParams.get("locale") ?? "";
  const locale = isLocale(localeParam) ? localeParam : "en";

  if (!browserSessionId) {
    return NextResponse.json({
      reservationSearchId: null,
      currentStage: null,
      pickupAtLocal: null,
      serviceTimezone: BOOKING_TIME_ZONE,
      draft: null,
    });
  }

  try {
    const draft = await findActiveDraft(browserSessionId);
    if (!draft) {
      return NextResponse.json({
        reservationSearchId: null,
        currentStage: null,
        pickupAtLocal: null,
        serviceTimezone: BOOKING_TIME_ZONE,
        draft: null,
      });
    }
    const view = await draftToView(draft, locale, draft.selected.distanceKm === null);
    return NextResponse.json({
      reservationSearchId: draft.id,
      currentStage: draft.currentStage,
      pickupAtLocal: view.applied.pickupAtLocal,
      serviceTimezone: draft.serviceTimezone ?? BOOKING_TIME_ZONE,
      draft: view,
    });
  } catch (error) {
    console.error("[Tripetica current-search]", error);
    return NextResponse.json({ error: "Could not load search" }, { status: 500 });
  }
}
