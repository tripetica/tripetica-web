import { type GpsPresence } from "@/lib/gps/presence";

export const GPS_CAMERA_SESSION_IDLE_MS = 45_000;
export const GPS_CAMERA_SESSION_ABSOLUTE_MS = 10 * 60 * 1000;
export const GPS_CAMERA_FRAME_STALE_MS = 8_000;
export const GPS_CAMERA_VIEWER_POLL_MS = 1_000;
export const GPS_CAMERA_FRAME_SAFETY_MAX_BYTES = 1024 * 1024;
export const GPS_CAMERA_FRAME_SAFETY_MAX_PER_SEC = 8;
export const GPS_CAMERA_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type GpsCameraIdlePhase = "ready" | "offline" | "unavailable" | "unknown";

const frames = new Map<string, { body: Uint8Array; at: number }>();
const rates = new Map<string, number[]>();

export function cameraIdlePhase(input: {
  presence: GpsPresence;
  cameraAvailable: boolean | null;
  cameraReady: boolean | null;
}): GpsCameraIdlePhase {
  if (input.presence !== "online") {
    return "offline";
  }
  if (input.cameraAvailable === false || input.cameraReady === false) {
    return "unavailable";
  }
  if (input.cameraAvailable !== true || input.cameraReady !== true) {
    return "unknown";
  }
  return "ready";
}

export function isJpegFrame(body: Uint8Array) {
  return body.length >= 4
    && body[0] === 0xff
    && body[1] === 0xd8
    && body[2] === 0xff
    && body[body.length - 2] === 0xff
    && body[body.length - 1] === 0xd9;
}

export function storeCameraFrame(sessionId: string, body: Uint8Array, now: number) {
  const recent = (rates.get(sessionId) ?? []).filter((time) => now - time < 1000);
  if (recent.length >= GPS_CAMERA_FRAME_SAFETY_MAX_PER_SEC) {
    rates.set(sessionId, recent);
    return "dropped" as const;
  }
  recent.push(now);
  rates.set(sessionId, recent);
  frames.set(sessionId, { body, at: now });
  return "stored" as const;
}

export function readCameraFrame(sessionId: string) {
  return frames.get(sessionId) ?? null;
}

export function forgetCameraFrame(sessionId: string) {
  frames.delete(sessionId);
  rates.delete(sessionId);
}

export function clearCameraFrames() {
  frames.clear();
  rates.clear();
}

export function cameraFrameCount() {
  return frames.size;
}
