import { type NextRequest, NextResponse } from "next/server";
import { cameraViewerScope } from "@/lib/gps/camera-access";
import { startCameraSession } from "@/lib/gps/camera-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: noStore });
  }
  const record = body && typeof body === "object" ? body as { deviceId?: unknown; surface?: unknown } : {};
  const deviceId = typeof record.deviceId === "string" ? record.deviceId : "";
  const surface = record.surface === "partner" || record.surface === "ops" ? record.surface : null;
  if (!DEVICE_ID.test(deviceId) || !surface) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: noStore });
  }
  const scope = await cameraViewerScope(surface);
  if (!scope) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const started = await startCameraSession({
    deviceId,
    partnerScope: scope.partnerId,
    surface: scope.surface,
    openedBy: scope.openedBy,
  });
  if (!started.ok) {
    const status = started.error === "not_found" ? 404 : 409;
    return NextResponse.json({ ok: false, error: started.error }, { status, headers: noStore });
  }
  return NextResponse.json({
    ok: true,
    sessionId: started.sessionId,
    expiresAt: started.expiresAt,
  }, { headers: noStore });
}
