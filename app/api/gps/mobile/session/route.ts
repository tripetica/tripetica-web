import { NextResponse } from "next/server";
import { loadMobileShare, startMobileShare, stopMobileShare } from "@/lib/gps/mobile-store";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { getPartnerActor } from "@/lib/partner/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

async function actor(request: Request, token: string | null) {
  const partner = await getPartnerActor();
  if (partner && !partner.mustChangePassword) {
    return {
      surface: "partner" as const,
      partnerId: partner.partnerId,
      email: partner.email,
      isOwner: partner.isOwner,
      clientToken: token ?? request.headers.get("x-mobile-client"),
    };
  }
  const driver = await getDriverPortalActor();
  if (driver) {
    return {
      surface: "driver" as const,
      partnerId: driver.partnerId,
      driverId: driver.driverId,
      isOwner: true,
      clientToken: token ?? request.headers.get("x-mobile-client"),
    };
  }
  return null;
}

export async function GET(request: Request) {
  const current = await actor(request, null);
  if (!current) return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  const share = await loadMobileShare(current);
  return NextResponse.json({ ok: true, share }, { headers: noStore });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: string; clientToken?: string } | null;
  const current = await actor(request, body?.clientToken ?? null);
  if (!current) return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  if (body?.action === "start") {
    const started = await startMobileShare(current);
    return NextResponse.json(started, { status: started.ok ? 200 : 403, headers: noStore });
  }
  if (body?.action === "stop" || body?.action === "permission_denied" || body?.action === "stream_lost" || body?.action === "stream_resumed") {
    const stopped = await stopMobileShare(current, body.action === "stop" ? "stopped" : body.action);
    return NextResponse.json(stopped, { status: stopped.ok ? 200 : 403, headers: noStore });
  }
  return NextResponse.json({ ok: false }, { status: 400, headers: noStore });
}
