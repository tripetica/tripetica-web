import { NextRequest, NextResponse } from "next/server";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { applySelectedTripToApplied } from "@/lib/booking/reservation-search";
import { draftToView } from "@/lib/booking/transfer-draft-hydration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const browserSessionId = readBrowserSessionId(request);
  if (!browserSessionId) {
    return NextResponse.json({ error: "No active search" }, { status: 401 });
  }

  let locale: Locale = "en";
  try {
    const body = (await request.json()) as { locale?: string };
    if (typeof body.locale === "string" && isLocale(body.locale)) {
      locale = body.locale;
    }
  } catch {
    locale = "en";
  }

  try {
    const result = await applySelectedTripToApplied(browserSessionId);
    if (result.status === "missing") {
      return NextResponse.json({ error: "No active search" }, { status: 404 });
    }
    if (result.status === "incomplete") {
      return NextResponse.json(
        {
          error: "incomplete",
          draft: await draftToView(result.draft, locale, true),
        },
        { status: 409 },
      );
    }
    return NextResponse.json({
      draft: await draftToView(result.draft, locale, false),
    });
  } catch (error) {
    console.error("[Tripetica draft-apply]", error);
    return NextResponse.json({ error: "Could not apply selections" }, { status: 500 });
  }
}
