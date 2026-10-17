import { type NextRequest, NextResponse } from "next/server";
import { driverGpsContext } from "@/lib/driver-portal/gps-scope";
import { syncVehicleMaintenance } from "@/lib/gps/maintenance-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VEHICLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ vehicleId: string }> },
) {
  const { vehicleId } = await context.params;
  const headers = { "Cache-Control": "private, no-store" };
  if (!VEHICLE_ID.test(vehicleId)) {
    return NextResponse.json({ ok: false }, { status: 404, headers });
  }
  const scope = await driverGpsContext("gpsMaintenance");
  if (!scope || !scope.vehicleIds.includes(vehicleId)) {
    return NextResponse.json({ ok: false }, { status: scope ? 404 : 401, headers });
  }
  const locale = request.nextUrl.searchParams.get("locale");
  const snapshot = await syncVehicleMaintenance(
    vehicleId,
    scope.actor.partnerId,
    locale === "en" || locale === "ru" ? locale : "tr",
  );
  if (!snapshot) {
    return NextResponse.json({ ok: false }, { status: 404, headers });
  }
  return NextResponse.json(snapshot, { headers });
}
