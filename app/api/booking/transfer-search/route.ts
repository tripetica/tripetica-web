import { NextRequest, NextResponse } from "next/server";
import {
  attachBrowserSessionCookie,
  resolveBrowserSessionId,
} from "@/lib/booking/browser-session";
import {
  computeSelectedRoute,
  upsertTransferDraft,
} from "@/lib/booking/reservation-search";
import {
  parseTransferSearchBody,
  toTransferSearchFields,
} from "@/lib/booking/transfer-search-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseTransferSearchBody(body);
  if ("status" in parsed) {
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }

  const session = resolveBrowserSessionId(request);
  const fields = await toTransferSearchFields(parsed);
  const route = await computeSelectedRoute(fields.pickup, fields.dropoff);
  const distanceKm = route?.distanceKm ?? null;

  try {
    const reservationSearchId = await upsertTransferDraft(session.id, {
      ...fields,
      distanceKm,
    });
    const response = NextResponse.json({
      reservationSearchId,
      distanceKm,
      distanceError: distanceKm === null,
    });
    return attachBrowserSessionCookie(response, session.id, session.isNew, request);
  } catch (error) {
    console.error("[Tripetica transfer-search]", error);
    return NextResponse.json({ error: "Could not save search" }, { status: 500 });
  }
}
