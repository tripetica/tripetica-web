import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { databaseNameFromUrl } from "@/lib/db/database-target";
import { clearCameraFrames, readCameraFrame } from "@/lib/gps/camera";
import { parseHeartbeatBody } from "@/lib/gps/contract";

function loadEnv(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(new URL("../../.env.development.local", import.meta.url).pathname);
process.env.EXPECTED_DATABASE = "tripetica_dev";
const devDatabase = process.env.DATABASE_URL ? databaseNameFromUrl(process.env.DATABASE_URL) === "tripetica_dev" : false;
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

test("camera live sessions on DEV", { skip: devDatabase ? false : "DEV database is not selected" }, async () => {
  const { getPool, query } = await import("@/lib/db/postgres");
  const { storeCameraFrame } = await import("@/lib/gps/camera");
  const {
    pollDeviceCameraSession,
    readOpenCameraSession,
    startCameraSession,
    stopCameraSession,
  } = await import("@/lib/gps/camera-sessions");
  const { ingestHeartbeat } = await import("@/lib/gps/ingest");
  const { createGpsDevice, getGpsDevice } = await import("@/lib/gps/queries");
  const before = await query<{ token_hash: string; vehicle_id: string; positions: number; camera_available: boolean | null }>(
    `SELECT credential.token_hash,
            device.vehicle_id,
            status.camera_available,
            (SELECT COUNT(*)::int FROM gps_positions position WHERE position.device_id = device.id) AS positions
     FROM gps_devices device
     JOIN gps_device_credentials credential ON credential.device_id = device.id
     JOIN gps_device_status status ON status.device_id = device.id
     WHERE device.device_code = 'TPT-1CDBD4475D88'`,
  );
  const real = before.rows[0];
  assert.ok(real);
  const owner = await query<{ partner_id: string }>(
    `SELECT partner_id FROM gps_devices WHERE device_code = 'TPT-1CDBD4475D88'`,
  );
  const other = await query<{ id: string }>(
    `SELECT id FROM partners WHERE id <> $1 AND deleted_at IS NULL LIMIT 1`,
    [owner.rows[0]?.partner_id],
  );
  const created = await createGpsDevice({
    partnerId: owner.rows[0]?.partner_id ?? null,
    vehicleId: null,
    imei: null,
    assignedBy: "camera-session-test",
  });
  clearCameraFrames();
  try {
    const fresh = await getGpsDevice(created.id, owner.rows[0]?.partner_id ?? null);
    assert.equal(fresh?.cameraAvailable, null);
    assert.equal(fresh?.cameraReady, null);
    const offline = await startCameraSession({
      deviceId: created.id,
      partnerScope: owner.rows[0]?.partner_id ?? null,
      surface: "partner",
      openedBy: "camera-session-test",
    });
    assert.equal(offline.ok, false);
    if (!offline.ok) assert.equal(offline.error, "offline");
    await query(`UPDATE gps_device_status SET last_heartbeat_at = NOW() WHERE device_id = $1`, [created.id]);
    const unavailable = await startCameraSession({
      deviceId: created.id,
      partnerScope: owner.rows[0]?.partner_id ?? null,
      surface: "partner",
      openedBy: "camera-session-test",
    });
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) assert.equal(unavailable.error, "camera_unavailable");
    const foreign = await startCameraSession({
      deviceId: created.id,
      partnerScope: other.rows[0]?.id ?? "00000000-0000-4000-8000-000000000000",
      surface: "partner",
      openedBy: "other",
    });
    assert.equal(foreign.ok, false);
    if (!foreign.ok) assert.equal(foreign.error, "not_found");

    const heartbeat = parseHeartbeatBody({
      firmware: "0.1.0",
      network: "lte",
      operator: "Turkcell",
      camera_available: true,
      camera_ready: true,
    });
    assert.ok(heartbeat);
    assert.equal((await ingestHeartbeat(created.id, heartbeat)).http, 200);
    await query(
      `UPDATE gps_device_status SET last_heartbeat_at = NOW() WHERE device_id = $1`,
      [created.id],
    );
    const started = await startCameraSession({
      deviceId: created.id,
      partnerScope: owner.rows[0]?.partner_id ?? null,
      surface: "partner",
      openedBy: "camera-session-test",
    });
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const polled = await pollDeviceCameraSession(created.id);
    assert.equal(polled.active, true);
    if (!polled.active) return;
    assert.equal(polled.sessionId, started.sessionId);
    assert.equal(await readOpenCameraSession(started.sessionId, "00000000-0000-4000-8000-000000000099"), null);
    assert.equal(storeCameraFrame(started.sessionId, jpeg, Date.now()), "stored");
    assert.equal(readCameraFrame(started.sessionId)?.body.length, jpeg.length);
    const columns = await query<{ data_type: string }>(
      `SELECT data_type
       FROM information_schema.columns
       WHERE table_name = 'gps_camera_sessions'`,
    );
    assert.equal(columns.rows.some((row) => row.data_type === "bytea"), false);
    const quiet = parseHeartbeatBody({ firmware: "0.1.0", network: "lte", operator: "Turkcell" });
    assert.ok(quiet);
    await ingestHeartbeat(created.id, quiet);
    const kept = await getGpsDevice(created.id, owner.rows[0]?.partner_id ?? null);
    assert.equal(kept?.cameraAvailable, true);
    assert.equal(kept?.cameraReady, true);
    assert.equal(await stopCameraSession(started.sessionId), true);
    assert.equal(readCameraFrame(started.sessionId), null);
    assert.equal((await pollDeviceCameraSession(created.id)).active, false);
    await query(
      `UPDATE gps_camera_sessions
       SET status = 'open',
           expires_at = NOW() - INTERVAL '1 second',
           closed_at = NULL
       WHERE id = $1`,
      [started.sessionId],
    );
    assert.equal((await pollDeviceCameraSession(created.id)).active, false);
  } finally {
    clearCameraFrames();
    await query(`DELETE FROM gps_devices WHERE id = $1`, [created.id]);
    const after = await query<{ token_hash: string; vehicle_id: string; positions: number; camera_available: boolean | null }>(
      `SELECT credential.token_hash,
              device.vehicle_id,
              status.camera_available,
              (SELECT COUNT(*)::int FROM gps_positions position WHERE position.device_id = device.id) AS positions
       FROM gps_devices device
       JOIN gps_device_credentials credential ON credential.device_id = device.id
       JOIN gps_device_status status ON status.device_id = device.id
       WHERE device.device_code = 'TPT-1CDBD4475D88'`,
    );
    assert.equal(after.rows[0]?.token_hash, real.token_hash);
    assert.equal(after.rows[0]?.vehicle_id, real.vehicle_id);
    assert.equal(after.rows[0]?.positions, real.positions);
    assert.equal(after.rows[0]?.camera_available, real.camera_available);
    await getPool().end();
  }
});
