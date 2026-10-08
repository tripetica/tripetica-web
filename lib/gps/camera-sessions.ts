import "server-only";

import { randomBytes } from "node:crypto";
import { query } from "@/lib/db/postgres";
import {
  forgetCameraFrame,
  GPS_CAMERA_SESSION_ABSOLUTE_MS,
  GPS_CAMERA_SESSION_IDLE_MS,
} from "@/lib/gps/camera";
import { gpsPresence, gpsPresenceThresholds } from "@/lib/gps/presence";
import { getGpsDevice } from "@/lib/gps/queries";

export type CameraSessionError = "not_found" | "disabled" | "offline" | "camera_unavailable";

type SessionRow = {
  id: string;
  device_id: string;
  partner_id: string | null;
  surface: "partner" | "ops";
  status: "open" | "closed" | "expired";
  created_at: Date;
  expires_at: Date;
};

async function expireDeviceSessions(deviceId: string) {
  const expired = await query<{ id: string }>(
    `UPDATE gps_camera_sessions
     SET status = 'expired',
         closed_at = NOW()
     WHERE device_id = $1
       AND status = 'open'
       AND (
         expires_at <= NOW()
         OR created_at <= NOW() - ($2::int * INTERVAL '1 millisecond')
       )
     RETURNING id`,
    [deviceId, GPS_CAMERA_SESSION_ABSOLUTE_MS],
  );
  for (const row of expired.rows) {
    forgetCameraFrame(row.id);
  }
}

export async function startCameraSession(input: {
  deviceId: string;
  partnerScope: string | null;
  surface: "partner" | "ops";
  openedBy: string;
}): Promise<{ ok: true; sessionId: string; expiresAt: string } | { ok: false; error: CameraSessionError }> {
  const device = await getGpsDevice(input.deviceId, input.partnerScope);
  if (!device) {
    return { ok: false, error: "not_found" };
  }
  if (input.surface === "partner" && device.partnerId !== input.partnerScope) {
    return { ok: false, error: "not_found" };
  }
  if (device.status !== "active") {
    return { ok: false, error: "disabled" };
  }
  if (gpsPresence(device.lastHeartbeatAt, new Date(), gpsPresenceThresholds()) !== "online") {
    return { ok: false, error: "offline" };
  }
  if (device.cameraAvailable !== true || device.cameraReady !== true) {
    return { ok: false, error: "camera_unavailable" };
  }
  await expireDeviceSessions(device.id);
  const closed = await query<{ id: string }>(
    `UPDATE gps_camera_sessions
     SET status = 'closed',
         closed_at = NOW()
     WHERE device_id = $1
       AND status = 'open'
     RETURNING id`,
    [device.id],
  );
  for (const row of closed.rows) {
    forgetCameraFrame(row.id);
  }
  const sessionId = randomBytes(32).toString("base64url");
  const openedBy = input.openedBy.trim().slice(0, 80) || input.surface;
  const inserted = await query<{ expires_at: Date }>(
    `INSERT INTO gps_camera_sessions (id, device_id, partner_id, surface, opened_by, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'open', NOW() + ($6::int * INTERVAL '1 millisecond'))
     RETURNING expires_at`,
    [sessionId, device.id, device.partnerId, input.surface, openedBy, GPS_CAMERA_SESSION_IDLE_MS],
  );
  return {
    ok: true,
    sessionId,
    expiresAt: inserted.rows[0]?.expires_at.toISOString() ?? new Date(Date.now() + GPS_CAMERA_SESSION_IDLE_MS).toISOString(),
  };
}

export async function readOpenCameraSession(sessionId: string, deviceId?: string) {
  const result = await query<SessionRow>(
    `SELECT id, device_id, partner_id, surface, status, created_at, expires_at
     FROM gps_camera_sessions
     WHERE id = $1
       AND ($2::uuid IS NULL OR device_id = $2)
     LIMIT 1`,
    [sessionId, deviceId ?? null],
  );
  const row = result.rows[0];
  if (!row || row.status !== "open") {
    return null;
  }
  if (row.expires_at.getTime() <= Date.now() || Date.now() - row.created_at.getTime() >= GPS_CAMERA_SESSION_ABSOLUTE_MS) {
    await query(
      `UPDATE gps_camera_sessions
       SET status = 'expired',
           closed_at = NOW()
       WHERE id = $1
         AND status = 'open'`,
      [row.id],
    );
    forgetCameraFrame(row.id);
    return null;
  }
  return row;
}

export async function touchCameraSession(sessionId: string) {
  const result = await query<{ expires_at: Date }>(
    `UPDATE gps_camera_sessions
     SET last_viewer_at = NOW(),
         expires_at = LEAST(
           NOW() + ($2::int * INTERVAL '1 millisecond'),
           created_at + ($3::int * INTERVAL '1 millisecond')
         )
     WHERE id = $1
       AND status = 'open'
       AND expires_at > NOW()
       AND created_at > NOW() - ($3::int * INTERVAL '1 millisecond')
     RETURNING expires_at`,
    [sessionId, GPS_CAMERA_SESSION_IDLE_MS, GPS_CAMERA_SESSION_ABSOLUTE_MS],
  );
  return result.rows[0]?.expires_at ?? null;
}

export async function stopCameraSession(sessionId: string) {
  const result = await query<{ id: string }>(
    `UPDATE gps_camera_sessions
     SET status = 'closed',
         closed_at = NOW()
     WHERE id = $1
       AND status = 'open'
     RETURNING id`,
    [sessionId],
  );
  if (result.rows[0]) {
    forgetCameraFrame(result.rows[0].id);
  }
  return (result.rowCount ?? 0) > 0;
}

export async function pollDeviceCameraSession(deviceId: string) {
  await expireDeviceSessions(deviceId);
  const result = await query<{ id: string; expires_at: Date }>(
    `SELECT id, expires_at
     FROM gps_camera_sessions
     WHERE device_id = $1
       AND status = 'open'
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [deviceId],
  );
  const row = result.rows[0];
  if (!row) {
    return { active: false as const };
  }
  return {
    active: true as const,
    sessionId: row.id,
    expiresAt: row.expires_at.toISOString(),
  };
}
