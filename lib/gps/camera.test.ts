import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  cameraFrameCount,
  cameraIdlePhase,
  clearCameraFrames,
  GPS_CAMERA_FRAME_SAFETY_MAX_PER_SEC,
  isJpegFrame,
  storeCameraFrame,
} from "@/lib/gps/camera";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

test("camera phase stays unknown until the device reports both flags", () => {
  assert.equal(cameraIdlePhase({ presence: "online", cameraAvailable: null, cameraReady: null }), "unknown");
  assert.equal(cameraIdlePhase({ presence: "online", cameraAvailable: true, cameraReady: null }), "unknown");
  assert.equal(cameraIdlePhase({ presence: "online", cameraAvailable: false, cameraReady: true }), "unavailable");
  assert.equal(cameraIdlePhase({ presence: "online", cameraAvailable: true, cameraReady: false }), "unavailable");
  assert.equal(cameraIdlePhase({ presence: "offline", cameraAvailable: true, cameraReady: true }), "offline");
  assert.equal(cameraIdlePhase({ presence: "stale", cameraAvailable: true, cameraReady: true }), "offline");
  assert.equal(cameraIdlePhase({ presence: "online", cameraAvailable: true, cameraReady: true }), "ready");
});

test("camera frames keep one latest jpeg and drop the overflow", () => {
  clearCameraFrames();
  assert.equal(isJpegFrame(jpeg), true);
  assert.equal(isJpegFrame(Uint8Array.from([1, 2, 3, 4])), false);
  const now = 1_000;
  for (let index = 0; index < GPS_CAMERA_FRAME_SAFETY_MAX_PER_SEC; index += 1) {
    const body = Uint8Array.from([0xff, 0xd8, 0xff, index, 0xff, 0xd9]);
    assert.equal(storeCameraFrame("session", body, now + index), "stored");
  }
  assert.equal(storeCameraFrame("session", jpeg, now + 10), "dropped");
  assert.equal(cameraFrameCount(), 1);
  clearCameraFrames();
  assert.equal(cameraFrameCount(), 0);
});

test("camera transport does not invent a frame rate or store pictures in telemetry", () => {
  const camera = readFileSync(new URL("./camera.ts", import.meta.url), "utf8");
  const frames = readFileSync(new URL("../../app/api/device/v1/camera/frames/route.ts", import.meta.url), "utf8");
  const telemetry = readFileSync(new URL("../../app/api/device/v1/telemetry/route.ts", import.meta.url), "utf8");
  const heartbeat = readFileSync(new URL("../../app/api/device/v1/heartbeat/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(camera, /30\s*\*\s*FPS|fps:\s*30|recommendedFps/i);
  assert.doesNotMatch(frames, /console\.(log|info|debug|error)/);
  assert.doesNotMatch(telemetry, /image\/jpeg|camera\/frames/);
  assert.doesNotMatch(heartbeat, /image\/jpeg|camera\/frames/);
  assert.match(frames, /private|no-store|deviceJson/);
});
