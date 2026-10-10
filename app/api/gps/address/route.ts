import { type NextRequest, NextResponse } from "next/server";
import { lookupGpsAddress, parseGpsAddressQuery } from "@/lib/gps/address";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await canReadAddress())) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const point = parseGpsAddressQuery(
    request.nextUrl.searchParams.get("lat"),
    request.nextUrl.searchParams.get("lon"),
  );
  if (!point) {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const result = await lookupGpsAddress(point.latitude, point.longitude);
  return NextResponse.json(
    { ok: true, status: result.status, address: result.address },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

async function canReadAddress() {
  const partner = await getPartnerActor();
  if (partner && !partner.mustChangePassword && partnerHasTab(partner, "gps")) {
    return true;
  }
  const ops = await getOpsActor();
  return Boolean(ops && actorCan(ops, "gps.view"));
}
