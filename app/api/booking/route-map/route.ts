import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { readBrowserSessionId } from "@/lib/booking/browser-session";
import { isLocale } from "@/lib/i18n/config";
import { findActiveDraft } from "@/lib/booking/reservation-search";
import { parseLatLngParam } from "@/lib/booking/route-fingerprint";
import { fetchGoogleStaticRouteMap } from "@/lib/booking/static-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = "private, no-store";

export async function GET(request: NextRequest) {
  const sessionId = readBrowserSessionId(request);
  if (!sessionId) {
    return NextResponse.json(
      { error: "No session" },
      { status: 401, headers: { "Cache-Control": NO_STORE } },
    );
  }

  const localeParam = request.nextUrl.searchParams.get("locale") ?? "en";
  const locale = isLocale(localeParam) ? localeParam : "en";
  const origin = parseLatLngParam(request.nextUrl.searchParams.get("p"));
  const destination = parseLatLngParam(request.nextUrl.searchParams.get("d"));
  if (!origin || !destination) {
    return NextResponse.json(
      { error: "Incomplete route" },
      { status: 409, headers: { "Cache-Control": NO_STORE } },
    );
  }

  try {
    const draft = await findActiveDraft(sessionId);
    if (!draft || draft.serviceType !== "transfer") {
      return NextResponse.json(
        { error: "No active search" },
        { status: 404, headers: { "Cache-Control": NO_STORE } },
      );
    }

    const image = await fetchGoogleStaticRouteMap({
      origin,
      destination,
      encodedPolyline: null,
      locale,
    });
    if (image) {
      return new NextResponse(Buffer.from(image.bytes), {
        status: 200,
        headers: {
          "Content-Type": image.contentType,
          "Cache-Control": NO_STORE,
        },
      });
    }

    return NextResponse.json(
      {
        origin,
        destination,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": NO_STORE,
        },
      },
    );
  } catch (error) {
    console.error("[Tripetica route-map]", error);
    return NextResponse.json(
      { error: "Could not render map" },
      { status: 500, headers: { "Cache-Control": NO_STORE } },
    );
  }
}
