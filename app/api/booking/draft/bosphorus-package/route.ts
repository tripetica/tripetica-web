import { NextRequest, NextResponse } from "next/server";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { applyBosphorusPackage } from "@/lib/booking/reservation-search";
import { draftToView } from "@/lib/booking/transfer-draft-hydration";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  const locale =
    typeof body.locale === "string" && isLocale(body.locale) ? body.locale : null;
  if (!locale) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  try {
    const result = await applyBosphorusPackage(browserSessionId, locale);
    if (result.status === "missing") {
      return NextResponse.json({ error: "No active search" }, { status: 404 });
    }
    if (result.status === "incomplete") {
      return NextResponse.json(
        {
          error: "incomplete",
          draft: await draftToView(result.draft, locale, false),
        },
        { status: 409 },
      );
    }
    return NextResponse.json({
      draft: await draftToView(result.draft, locale, false),
    });
  } catch (error) {
    console.error("[Tripetica draft-bosphorus-package]", error);
    return NextResponse.json(
      { error: "Could not apply Bosphorus package" },
      { status: 500 },
    );
  }
}
