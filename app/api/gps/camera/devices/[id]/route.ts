import { type NextRequest, NextResponse } from "next/server";
import { cameraIdlePhase } from "@/lib/gps/camera";
import { cameraViewerScope } from "@/lib/gps/camera-access";
import { gpsPresence, gpsPresenceThresholds } from "@/lib/gps/presence";
import { getGpsDevice } from "@/lib/gps/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!DEVICE_ID.test(id)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: noStore });
  }
  const surface = request.nextUrl.searchParams.get("surface");
  const scope = await cameraViewerScope(surface);
  if (!scope) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const device = await getGpsDevice(id, scope.partnerId);
  if (!device) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: noStore });
  }
  const presence = gpsPresence(device.lastHeartbeatAt, new Date(), gpsPresenceThresholds());
  return NextResponse.json({
    ok: true,
    presence,
    cameraAvailable: device.cameraAvailable,
    cameraReady: device.cameraReady,
    phase: cameraIdlePhase({
      presence,
      cameraAvailable: device.cameraAvailable,
      cameraReady: device.cameraReady,
    }),
    lowBatteryState: device.lowBatteryState,
    batteryPercent: device.batteryPercent,
  }, { headers: noStore });
}
