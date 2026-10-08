import { type NextRequest } from "next/server";
import { pollDeviceCameraSession } from "@/lib/gps/camera-sessions";
import { authenticateDevice } from "@/lib/gps/device-auth";
import { deviceJson } from "@/lib/gps/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateDevice(request);
  if ("response" in auth) {
    return auth.response;
  }
  const session = await pollDeviceCameraSession(auth.device.id);
  if (!session.active) {
    return deviceJson(200, { ok: true, active: false });
  }
  return deviceJson(200, {
    ok: true,
    active: true,
    session_id: session.sessionId,
    expires_at: session.expiresAt,
  });
}
