import { type NextRequest, NextResponse } from "next/server";
import { syncVehicleMaintenance } from "@/lib/gps/maintenance-store";
import { partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VEHICLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ vehicleId: string }> },
) {
  const { vehicleId } = await context.params;
  if (!VEHICLE_ID.test(vehicleId)) {
    return NextResponse.json({ ok: false }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const actor = await getPartnerActor();
  if (!actor || actor.mustChangePassword || !partnerHasTab(actor, "gps")) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const locale = request.nextUrl.searchParams.get("locale");
  const snapshot = await syncVehicleMaintenance(
    vehicleId,
    actor.partnerId,
    locale === "en" || locale === "ru" ? locale : "tr",
  );
  if (!snapshot) {
    return NextResponse.json({ ok: false }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
}
