import { getPool } from "@/lib/db/postgres";
import {
  decideGreenDrivingFollowup,
  TELTONIKA_GREEN_GETPARAM,
  TELTONIKA_GREEN_SETPARAM,
} from "@/lib/teltonika/config-read";

const ALLOWED_CONFIG_COMMANDS = [TELTONIKA_GREEN_GETPARAM, TELTONIKA_GREEN_SETPARAM];

export async function claimTeltonikaConfigRead(imei: string) {
  const result = await getPool().query<{ id: string; command_text: string }>(
    `UPDATE gps_teltonika_config_reads AS read
     SET phase = 'sent'
     WHERE read.id = (
       SELECT queued.id
       FROM gps_teltonika_config_reads queued
       JOIN gps_devices device ON device.id = queued.device_id
       WHERE device.imei = $1
         AND device.receiver = 'teltonika'
         AND device.status = 'active'
         AND device.deleted_at IS NULL
         AND queued.phase = 'queued'
         AND queued.command_text = ANY($2::text[])
       ORDER BY queued.created_at
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING read.id, read.command_text`,
    [imei, ALLOWED_CONFIG_COMMANDS],
  );
  return result.rows[0] ?? null;
}

export async function finishTeltonikaConfigRead(commandId: string, responseText: string) {
  await getPool().query(
    `UPDATE gps_teltonika_config_reads
     SET phase = 'answered',
         response_text = $2,
         finished_at = NOW()
     WHERE id = $1
       AND phase = 'sent'`,
    [commandId, responseText.slice(0, 4000)],
  );
}

export async function advanceTeltonikaConfigRead(commandId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const flag = await client.query<{ enabled: boolean }>(
      "SELECT enabled FROM gps_teltonika_config_apply WHERE id",
    );
    const row = await client.query<{
      device_id: string;
      command_text: string;
      response_text: string | null;
      phase: string;
    }>(
      `SELECT device_id, command_text, response_text, phase
       FROM gps_teltonika_config_reads
       WHERE id = $1
       FOR UPDATE`,
      [commandId],
    );
    const current = row.rows[0];
    if (!current || current.phase !== "answered" || current.response_text === null) {
      await client.query("COMMIT");
      return;
    }
    const prior = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM gps_teltonika_config_reads
         WHERE device_id = $1
           AND command_text = $2
           AND phase = 'answered'
           AND id <> $3
       ) AS exists`,
      [current.device_id, TELTONIKA_GREEN_SETPARAM, commandId],
    );
    const decision = decideGreenDrivingFollowup({
      applyEnabled: flag.rows[0]?.enabled === true,
      command: current.command_text,
      response: current.response_text,
      priorSetparamAnswered: prior.rows[0]?.exists === true,
    });
    const next = decision === "setparam"
      ? TELTONIKA_GREEN_SETPARAM
      : decision === "verify"
        ? TELTONIKA_GREEN_GETPARAM
        : null;
    if (next) {
      await client.query(
        `INSERT INTO gps_teltonika_config_reads (device_id, command_text)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM gps_teltonika_config_reads
           WHERE device_id = $1 AND phase IN ('queued', 'sent')
         )`,
        [current.device_id, next],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function timeoutTeltonikaConfigRead(commandId: string) {
  await getPool().query(
    `UPDATE gps_teltonika_config_reads
     SET phase = 'timeout',
         finished_at = NOW()
     WHERE id = $1
       AND phase = 'sent'`,
    [commandId],
  );
}
