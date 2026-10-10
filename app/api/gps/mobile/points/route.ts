import { NextResponse } from "next/server";
import { storeMobilePoint } from "@/lib/gps/mobile-store";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { getPartnerActor } from "@/lib/partner/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    sessionId?: string;
    latitude?: number;
    longitude?: number;
    recordedAt?: string;
    accuracyM?: number | null;
    speedMps?: number | null;
    headingDeg?: number | null;
    clientToken?: string;
  } | null;
  const partner = await getPartnerActor();
  const driver = partner && !partner.mustChangePassword ? null : await getDriverPortalActor();
  const clientToken = body?.clientToken ?? request.headers.get("x-mobile-client");
  const actor = partner && !partner.mustChangePassword
    ? { surface: "partner" as const, partnerId: partner.partnerId, email: partner.email, isOwner: partner.isOwner, clientToken }
    : driver
      ? { surface: "driver" as const, partnerId: driver.partnerId, driverId: driver.driverId, isOwner: true, clientToken }
      : null;
  if (!actor) return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  if (!body?.sessionId || body.latitude == null || body.longitude == null || !body.recordedAt) {
    return NextResponse.json({ ok: false }, { status: 400, headers: noStore });
  }
  const stored = await storeMobilePoint(actor, {
    sessionId: body.sessionId,
    latitude: body.latitude,
    longitude: body.longitude,
    recordedAt: body.recordedAt,
    accuracyM: body.accuracyM ?? null,
    speedMps: body.speedMps ?? null,
    headingDeg: body.headingDeg ?? null,
  });
  return NextResponse.json(stored, { status: stored.ok ? 200 : stored.error === "invalid" ? 400 : 403, headers: noStore });
}
