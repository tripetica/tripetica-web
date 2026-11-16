import "server-only";

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";
import { advanceDeviceRestart, deviceRestartAllowed, TELTONIKA_CPU_RESET, type RestartPhase } from "@/lib/teltonika/restart";

const OPEN_RESTART = ["preparing", "armed", "sent", "waiting_reconnect"];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

async function restartOpen(client: PoolClient) {
  const database = await client.query<{ name: string }>("SELECT current_database() AS name");
  return deviceRestartAllowed(database.rows[0]?.name ?? "");
}

export async function requestDeviceRestart(input: { actorId: string; deviceId: string }) {
  if (!isUuid(input.deviceId)) return { ok: false as const, error: "devices" };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await restartOpen(client)) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "dev_only" };
    }
    const device = await client.query<{ id: string }>(
      `SELECT id FROM gps_devices
        WHERE id = $1 AND receiver = 'teltonika' AND status = 'active' AND deleted_at IS NULL`,
      [input.deviceId],
    );
    if (!device.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "devices" };
    }
    const open = await client.query<{ id: string; phase: RestartPhase }>(
      `SELECT id, phase FROM gps_device_restarts
        WHERE device_id = $1 AND phase = ANY($2::text[])
        ORDER BY created_at DESC
        LIMIT 1`,
      [input.deviceId, OPEN_RESTART],
    );
    if (open.rows[0]) {
      await client.query("COMMIT");
      return { ok: true as const, id: open.rows[0].id, phase: open.rows[0].phase };
    }
    const link = await client.query(
      `SELECT device_id FROM gps_teltonika_links
        WHERE device_id = $1 AND disconnected_at IS NULL`,
      [input.deviceId],
    );
    if (!link.rows[0]) {
      const row = await client.query<{ id: string }>(
        `INSERT INTO gps_device_restarts (device_id, phase, error, created_by, finished_at)
         VALUES ($1, 'no_link', 'no_link', $2, now())
         RETURNING id`,
        [input.deviceId, input.actorId],
      );
      await client.query("COMMIT");
      return { ok: false as const, error: "no_link", id: row.rows[0]?.id, phase: "no_link" as const };
    }
    const row = await client.query<{ id: string }>(
      `INSERT INTO gps_device_restarts (device_id, phase, created_by)
       VALUES ($1, 'preparing', $2)
       RETURNING id`,
      [input.deviceId, input.actorId],
    );
    await client.query("COMMIT");
    return { ok: true as const, id: row.rows[0]?.id, phase: "preparing" as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function claimDeviceRestart(imei: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await restartOpen(client)) {
      await client.query("ROLLBACK");
      return null;
    }
    const device = await client.query<{ id: string }>(
      `SELECT id FROM gps_devices
        WHERE imei = $1 AND receiver = 'teltonika' AND status = 'active' AND deleted_at IS NULL
        LIMIT 1`,
      [imei],
    );
    const deviceId = device.rows[0]?.id;
    if (!deviceId) {
      await client.query("ROLLBACK");
      return null;
    }
    const link = await client.query(
      `SELECT device_id FROM gps_teltonika_links
        WHERE device_id = $1 AND disconnected_at IS NULL`,
      [deviceId],
    );
    if (!link.rows[0]) {
      await client.query(
        `UPDATE gps_device_restarts
            SET phase = 'no_link', error = 'no_link', finished_at = now()
          WHERE device_id = $1 AND phase = 'preparing'`,
        [deviceId],
      );
      await client.query("COMMIT");
      return null;
    }
    const job = await client.query<{ id: string }>(
      `SELECT id FROM gps_device_restarts
        WHERE device_id = $1 AND phase = 'preparing'
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [deviceId],
    );
    const id = job.rows[0]?.id;
    if (!id) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(`UPDATE gps_device_restarts SET phase = 'armed' WHERE id = $1`, [id]);
    await client.query("COMMIT");
    return { id, text: TELTONIKA_CPU_RESET };
  } catch {
    await client.query("ROLLBACK");
    return null;
  } finally {
    client.release();
  }
}

async function applyRestart(commandId: string, event: "written" | "closed" | "reply" | "timeout" | "blocked", reply?: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await restartOpen(client)) {
      await client.query("ROLLBACK");
      return false;
    }
    const current = await client.query<{ phase: RestartPhase }>(
      `SELECT phase FROM gps_device_restarts WHERE id = $1 FOR UPDATE`,
      [commandId],
    );
    const phase = current.rows[0]?.phase;
    if (!phase) {
      await client.query("COMMIT");
      return false;
    }
    const next = advanceDeviceRestart({ phase, event, reply });
    if (next.phase === phase && next.error === null) {
      await client.query("COMMIT");
      return true;
    }
    const finished = next.phase === "failed" || next.phase === "unverified" || next.phase === "verified";
    await client.query(
      `UPDATE gps_device_restarts
          SET phase = $2,
              error = $3,
              sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END,
              disconnected_at = CASE WHEN $2 = 'waiting_reconnect' THEN now() ELSE disconnected_at END,
              finished_at = CASE WHEN $4 THEN now() ELSE finished_at END
        WHERE id = $1`,
      [commandId, next.phase, next.error, finished],
    );
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

export function markDeviceRestartSent(commandId: string) {
  return applyRestart(commandId, "written");
}

export function markDeviceRestartClosed(commandId: string) {
  return applyRestart(commandId, "closed");
}

export function finishDeviceRestart(commandId: string, responseText: string) {
  if (responseText === "blocked") return applyRestart(commandId, "blocked");
  return applyRestart(commandId, "reply", responseText.slice(0, 400));
}

export function timeoutDeviceRestart(commandId: string) {
  return applyRestart(commandId, "timeout");
}

export async function noteDeviceSession(imei: string, event: "open" | "close") {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await restartOpen(client)) {
      await client.query("ROLLBACK");
      return;
    }
    const device = await client.query<{ id: string }>(
      `SELECT id FROM gps_devices
        WHERE imei = $1 AND receiver = 'teltonika' AND status = 'active' AND deleted_at IS NULL
        LIMIT 1`,
      [imei],
    );
    const deviceId = device.rows[0]?.id;
    if (!deviceId) {
      await client.query("COMMIT");
      return;
    }
    if (event === "close") {
      await client.query(
        `UPDATE gps_teltonika_links SET disconnected_at = now()
          WHERE device_id = $1 AND disconnected_at IS NULL`,
        [deviceId],
      );
      await client.query(
        `UPDATE gps_device_restarts
            SET phase = 'no_link', error = 'no_link', finished_at = now()
          WHERE device_id = $1 AND phase = 'preparing'`,
        [deviceId],
      );
      await client.query("COMMIT");
      return;
    }
    await client.query(
      `INSERT INTO gps_teltonika_links (device_id, imei, connected_at, disconnected_at)
       VALUES ($1, $2, now(), NULL)
       ON CONFLICT (device_id) DO UPDATE
         SET imei = EXCLUDED.imei, connected_at = now(), disconnected_at = NULL`,
      [deviceId, imei],
    );
    const current = await client.query<{ id: string; phase: RestartPhase }>(
      `SELECT id, phase FROM gps_device_restarts
        WHERE device_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [deviceId],
    );
    const row = current.rows[0];
    if (row) {
      const next = advanceDeviceRestart({ phase: row.phase, event: "reconnected" });
      if (next.phase !== row.phase) {
        await client.query(
          `UPDATE gps_device_restarts
              SET phase = $2, error = $3, reconnected_at = now(), finished_at = now()
            WHERE id = $1`,
          [row.id, next.phase, next.error],
        );
      }
    }
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}
