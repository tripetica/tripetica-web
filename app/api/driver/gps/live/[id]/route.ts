import { type NextRequest, NextResponse } from "next/server";
import { driverDeviceVehicleId, driverGpsContext } from "@/lib/driver-portal/gps-scope";
import { gpsLiveEtag, gpsPartnerLivePayload } from "@/lib/gps/live";
import { getGpsLive } from "@/lib/gps/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const headers = { "Cache-Control": "private, no-store" };
  if (!DEVICE_ID.test(id)) {
    return NextResponse.json({ ok: false }, { status: 404, headers });
  }
  const scope = await driverGpsContext();
  if (!scope || (!scope.actor.permissions.gpsLive && !scope.actor.permissions.gpsDevice)) {
    return NextResponse.json({ ok: false }, { status: 401, headers });
  }
  const vehicleId = await driverDeviceVehicleId(id, scope.actor.partnerId);
  if (!vehicleId || !scope.vehicleIds.includes(vehicleId)) {
    return NextResponse.json({ ok: false }, { status: 404, headers });
  }
  const snapshot = await getGpsLive(id, scope.actor.partnerId);
  if (!snapshot) {
    return NextResponse.json({ ok: false }, { status: 404, headers });
  }
  const payload = gpsPartnerLivePayload(snapshot);
  if (!scope.actor.permissions.gpsLive) {
    payload.latitude = null;
    payload.longitude = null;
    payload.speedMps = null;
    payload.headingDeg = null;
    payload.recent = [];
  }
  const etag = gpsLiveEtag(snapshot);
  const responseHeaders = { ...headers, ETag: etag };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: responseHeaders });
  }
  return NextResponse.json(payload, { headers: responseHeaders });
}
