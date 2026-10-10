import { NextResponse } from "next/server";
import { listPartnerLowBattery } from "@/lib/gps/queries";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const partner = await getPartnerActor();
  if (!partner || !partnerHasTab(partner, "gps")) {
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }
  const devices = await listPartnerLowBattery(partner.partnerId);
  return NextResponse.json({ ok: true, devices }, { headers: noStore });
}
