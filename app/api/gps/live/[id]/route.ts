import { type NextRequest, NextResponse } from "next/server";
import { gpsLiveEtag } from "@/lib/gps/live";
import { getGpsLive } from "@/lib/gps/queries";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { getPartnerActor } from "@/lib/partner/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!DEVICE_ID.test(id)) {
    return NextResponse.json({ ok: false }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const surface = request.nextUrl.searchParams.get("surface");
  const partnerId = await livePartnerScope(surface);
  if (partnerId === "denied") {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const snapshot = await getGpsLive(id, partnerId);
  if (!snapshot) {
    return NextResponse.json({ ok: false }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const etag = gpsLiveEtag(snapshot);
  const headers = {
    "Cache-Control": "private, no-store",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return NextResponse.json(snapshot, { headers });
}

async function livePartnerScope(surface: string | null) {
  if (surface === "partner") {
    const actor = await getPartnerActor();
    if (!actor || actor.mustChangePassword) {
      return "denied" as const;
    }
    return actor.partnerId;
  }
  if (surface === "ops") {
    const actor = await getOpsActor();
    if (!actor || !actorCan(actor, "gps.view")) {
      return "denied" as const;
    }
    return null;
  }
  return "denied" as const;
}
