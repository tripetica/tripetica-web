import "server-only";

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";
import { classifyKeywordReply, keywordCommand, keywordTextAllowed } from "@/lib/teltonika/keyword";
import { sealSecret, unsealSecret } from "@/lib/security/sealed-secret";

const KEY_ENV = "GPS_KEYWORD_KEY";
const OPEN = ["preparing", "armed", "sent"];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

function keyReady() {
  const raw = process.env[KEY_ENV]?.trim();
  if (!raw) return false;
  const key = raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return key.length === 32;
}

async function onDev(client: PoolClient) {
  const database = await client.query<{ name: string }>("SELECT current_database() AS name");
  return database.rows[0]?.name === "tripetica_dev";
}

export async function requestDeviceKeyword(input: {
  actorId: string;
  deviceId: string;
  action: "set" | "remove";
  current: string;
  next: string;
}) {
  if (!isUuid(input.deviceId)) return { ok: false as const, error: "devices" };
  const current = input.current.trim();
  const next = input.next.trim();
  if (input.action === "set" && !keywordTextAllowed(next)) return { ok: false as const, error: "format" };
  if (current !== "" && !keywordTextAllowed(current)) return { ok: false as const, error: "format" };
  if (input.action === "remove" && !keywordTextAllowed(current)) return { ok: false as const, error: "format" };
  if (!keyReady()) return { ok: false as const, error: "keyword_key" };
  const command = keywordCommand(input.action, current, next);
  if (!command) return { ok: false as const, error: "format" };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await onDev(client)) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "dev_only" };
    }
    const device = await client.query(
      `SELECT id FROM gps_devices
        WHERE id = $1 AND receiver = 'teltonika' AND status = 'active' AND deleted_at IS NULL`,
      [input.deviceId],
    );
    if (!device.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "devices" };
    }
    const pending = await client.query<{ phase: string }>(
      `SELECT phase FROM gps_device_keyword_jobs
        WHERE device_id = $1 AND phase = ANY($2::text[])
        ORDER BY created_at DESC
        LIMIT 1`,
      [input.deviceId, OPEN],
    );
    if (pending.rows[0]) {
      await client.query("COMMIT");
      return { ok: true as const, phase: pending.rows[0].phase };
    }
    const stored = await client.query<{ sealed: string }>(
      `SELECT sealed FROM gps_device_keywords WHERE device_id = $1`,
      [input.deviceId],
    );
    if (stored.rows[0]) {
      let known = "";
      try {
        known = unsealSecret(stored.rows[0].sealed, KEY_ENV);
      } catch {
        await client.query("ROLLBACK");
        return { ok: false as const, error: "keyword_key" };
      }
      if (current !== known) {
        await client.query(
          `INSERT INTO gps_config_audits (actor_id, action, detail)
           VALUES ($1, 'keyword_request', $2::jsonb)`,
          [input.actorId, JSON.stringify({ deviceId: input.deviceId, action: input.action, result: "wrong_old" })],
        );
        await client.query("COMMIT");
        return { ok: false as const, error: "wrong_old" };
      }
    }
    const link = await client.query(
      `SELECT device_id FROM gps_teltonika_links WHERE device_id = $1 AND disconnected_at IS NULL`,
      [input.deviceId],
    );
    if (!link.rows[0]) {
      await client.query(
        `INSERT INTO gps_device_keyword_jobs (device_id, action, phase, error, created_by, finished_at)
         VALUES ($1, $2, 'no_link', 'no_link', $3, now())`,
        [input.deviceId, input.action, input.actorId],
      );
      await client.query(
        `INSERT INTO gps_config_audits (actor_id, action, detail)
         VALUES ($1, 'keyword_request', $2::jsonb)`,
        [input.actorId, JSON.stringify({ deviceId: input.deviceId, action: input.action, result: "no_link" })],
      );
      await client.query("COMMIT");
      return { ok: false as const, error: "no_link", phase: "no_link" as const };
    }
    const sealedCommand = sealSecret(command, KEY_ENV);
    const sealedNext = input.action === "set" ? sealSecret(next, KEY_ENV) : null;
    await client.query(
      `INSERT INTO gps_device_keyword_jobs (device_id, action, phase, sealed_command, sealed_next, created_by)
       VALUES ($1, $2, 'preparing', $3, $4, $5)`,
      [input.deviceId, input.action, sealedCommand, sealedNext, input.actorId],
    );
    await client.query(
      `INSERT INTO gps_config_audits (actor_id, action, detail)
       VALUES ($1, 'keyword_request', $2::jsonb)`,
      [input.actorId, JSON.stringify({ deviceId: input.deviceId, action: input.action, result: "preparing" })],
    );
    await client.query("COMMIT");
    return { ok: true as const, phase: "preparing" as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function claimDeviceKeyword(imei: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await onDev(client)) {
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
      `SELECT device_id FROM gps_teltonika_links WHERE device_id = $1 AND disconnected_at IS NULL`,
      [deviceId],
    );
    if (!link.rows[0]) {
      await client.query(
        `UPDATE gps_device_keyword_jobs
            SET phase = 'no_link', error = 'no_link', sealed_command = NULL, sealed_next = NULL, finished_at = now()
          WHERE device_id = $1 AND phase = 'preparing'`,
        [deviceId],
      );
      await client.query("COMMIT");
      return null;
    }
    const job = await client.query<{ id: string; sealed_command: string }>(
      `SELECT id, sealed_command FROM gps_device_keyword_jobs
        WHERE device_id = $1 AND phase = 'preparing' AND sealed_command IS NOT NULL
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [deviceId],
    );
    const row = job.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }
    const text = unsealSecret(row.sealed_command, KEY_ENV);
    await client.query(`UPDATE gps_device_keyword_jobs SET phase = 'armed' WHERE id = $1`, [row.id]);
    await client.query("COMMIT");
    return { id: row.id, text };
  } catch {
    await client.query("ROLLBACK");
    return null;
  } finally {
    client.release();
  }
}

export async function markDeviceKeywordSent(commandId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await onDev(client)) {
      await client.query("ROLLBACK");
      return false;
    }
    const updated = await client.query(
      `UPDATE gps_device_keyword_jobs
          SET phase = 'sent', sent_at = now()
        WHERE id = $1 AND phase = 'armed'`,
      [commandId],
    );
    await client.query("COMMIT");
    return (updated.rowCount ?? 0) > 0;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

export async function finishDeviceKeyword(commandId: string, responseText: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await onDev(client)) {
      await client.query("ROLLBACK");
      return false;
    }
    const current = await client.query<{
      device_id: string;
      action: "set" | "remove";
      phase: string;
      sealed_next: string | null;
      created_by: string | null;
    }>(
      `SELECT device_id, action, phase, sealed_next, created_by
         FROM gps_device_keyword_jobs WHERE id = $1 FOR UPDATE`,
      [commandId],
    );
    const row = current.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return false;
    }
    const decision = responseText === "blocked"
      ? { phase: "failed" as const, error: "blocked" }
      : classifyKeywordReply(responseText);
    if (decision.phase === "accepted" && row.action === "set" && row.sealed_next) {
      await client.query(
        `INSERT INTO gps_device_keywords (device_id, sealed, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (device_id) DO UPDATE SET sealed = EXCLUDED.sealed, updated_at = now()`,
        [row.device_id, row.sealed_next],
      );
    }
    if (decision.phase === "accepted" && row.action === "remove") {
      await client.query(`DELETE FROM gps_device_keywords WHERE device_id = $1`, [row.device_id]);
    }
    await client.query(
      `UPDATE gps_device_keyword_jobs
          SET phase = $2, error = $3, sealed_command = NULL, sealed_next = NULL, finished_at = now()
        WHERE id = $1`,
      [commandId, decision.phase, decision.error],
    );
    await client.query(
      `INSERT INTO gps_config_audits (actor_id, action, detail)
       VALUES ($1, 'keyword_result', $2::jsonb)`,
      [row.created_by, JSON.stringify({ deviceId: row.device_id, action: row.action, result: decision.phase, error: decision.error })],
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

export async function timeoutDeviceKeyword(commandId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await onDev(client)) {
      await client.query("ROLLBACK");
      return false;
    }
    const updated = await client.query(
      `UPDATE gps_device_keyword_jobs
          SET phase = 'unverified', error = 'no_reply', sealed_command = NULL, sealed_next = NULL, finished_at = now()
        WHERE id = $1 AND phase IN ('armed', 'sent')`,
      [commandId],
    );
    await client.query("COMMIT");
    return (updated.rowCount ?? 0) > 0;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}
