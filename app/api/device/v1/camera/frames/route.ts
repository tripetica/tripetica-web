import { type NextRequest } from "next/server";
import {
  GPS_CAMERA_FRAME_SAFETY_MAX_BYTES,
  GPS_CAMERA_SESSION_ID_PATTERN,
  isJpegFrame,
  storeCameraFrame,
} from "@/lib/gps/camera";
import { readOpenCameraSession } from "@/lib/gps/camera-sessions";
import { authenticateDevice } from "@/lib/gps/device-auth";
import { deviceJson } from "@/lib/gps/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length < 1) {
    return deviceJson(400, { ok: false, error: "invalid_body" });
  }
  if (length > GPS_CAMERA_FRAME_SAFETY_MAX_BYTES) {
    return deviceJson(413, { ok: false, error: "payload_too_large" });
  }
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("image/jpeg")) {
    return deviceJson(415, { ok: false, error: "unsupported_media" });
  }
  const sessionId = request.headers.get("x-camera-session") ?? "";
  if (!GPS_CAMERA_SESSION_ID_PATTERN.test(sessionId)) {
    return deviceJson(404, { ok: false, error: "not_found" });
  }
  const auth = await authenticateDevice(request);
  if ("response" in auth) {
    return auth.response;
  }
  const session = await readOpenCameraSession(sessionId, auth.device.id);
  if (!session) {
    return deviceJson(404, { ok: false, error: "not_found" });
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength < 1 || body.byteLength > GPS_CAMERA_FRAME_SAFETY_MAX_BYTES || !isJpegFrame(body)) {
    return deviceJson(400, { ok: false, error: "invalid_body" });
  }
  const stored = storeCameraFrame(session.id, body, Date.now());
  return deviceJson(200, { ok: true, dropped: stored === "dropped" });
}
