import "server-only";

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";
import { parseTeltonikaGetparam } from "@/lib/teltonika/config-read";
import { storeParameterDecision } from "@/lib/gps/parameter-apply";
import {
  advanceConfiguratorJob,
  configDispatchEnabled,
  configuratorWireCommandAllowed,
  mergeConfig,
  parseConfiguratorPlan,
  planDeviceDispatch,
  type ConfiguratorJobPlan,
  type ConfigValues,
} from "@/lib/teltonika/config-plan";

function asValues(value: unknown): ConfigValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const values: ConfigValues = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") values[key] = item;
  }
  return values;
}

function planFrom(value: unknown): ConfiguratorJobPlan | null {
  return parseConfiguratorPlan(value);
}

async function knownRead(client: PoolClient, deviceId: string) {
  const green = await client.query(
    `SELECT response_text, finished_at
       FROM gps_teltonika_config_reads
      WHERE device_id = $1 AND phase = 'answered' AND command_text LIKE 'getparam %' AND response_text IS NOT NULL
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 1`,
    [deviceId],
  );
  const saved = await client.query(
    `SELECT planned, finished_at
       FROM gps_config_jobs
      WHERE device_id = $1 AND planned->>'kind' = 'read' AND phase = 'verified'
      ORDER BY created_at DESC
      LIMIT 1`,
    [deviceId],
  );
  const greenRow = green.rows[0];
  const savedRow = saved.rows[0];
  const greenValues = greenRow?.response_text ? parseTeltonikaGetparam(greenRow.response_text) : null;
  const savedValues = savedRow ? asValues(planFrom(savedRow.planned)?.values) : null;
  if (!greenValues && !savedValues) return null;
  const greenAt = greenRow?.finished_at?.getTime() ?? 0;
  const savedAt = savedRow?.finished_at?.getTime() ?? 0;
  if (greenValues && savedValues) return savedAt >= greenAt ? { ...greenValues, ...savedValues } : { ...savedValues, ...greenValues };
  return greenValues ?? savedValues;
}

async function queueAutomatic(client: PoolClient, deviceId: string) {
  if (!configDispatchEnabled()) return;
  const latest = await client.query(
    `SELECT version.id, version.version, version.values
       FROM gps_config_versions version
       JOIN gps_config_profiles profile ON profile.id = version.profile_id
      WHERE profile.kind = 'standard'
      ORDER BY version.version DESC
      LIMIT 1`,
  );
  const target = latest.rows[0] as { id?: string; version?: number; values?: ConfigValues } | undefined;
  if (!target?.id || typeof target.version !== "number") return;
  const attempt = await client.query(
    `SELECT id FROM gps_config_jobs
      WHERE device_id = $1 AND version_id = $2 AND planned->>'kind' IN ('apply', 'auto')
      LIMIT 1`,
    [deviceId, target.id],
  );
  if (attempt.rows[0]) return;
  const override = await client.query(`SELECT values FROM gps_config_overrides WHERE device_id = $1`, [deviceId]);
  const read = await knownRead(client, deviceId);
  const merged = mergeConfig(target.values ?? {}, asValues((override.rows[0] as { values?: unknown } | undefined)?.values));
  const decision = planDeviceDispatch({ read, target: merged });
  await client.query(
    `INSERT INTO gps_config_jobs (device_id, version_id, phase, error, planned)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [deviceId, target.id, decision.phase, decision.error, JSON.stringify({
      kind: "auto",
      version: target.version,
      steps: decision.steps,
      step: 0,
      values: {},
      target: merged,
      expect: decision.expect,
    })],
  );
}

/** Claims the next DEV configurator command for the connected IMEI. Production database returns nothing. */
export async function claimConfiguratorCommand(imei: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const database = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (database.rows[0]?.name !== "tripetica_dev") {
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
    const open = await client.query(
      `SELECT id FROM gps_config_jobs
        WHERE device_id = $1 AND phase IN ('waiting_link', 'reading', 'applying', 'verifying')
        LIMIT 1`,
      [deviceId],
    );
    if (!open.rows[0]) await queueAutomatic(client, deviceId);
    const job = await client.query<{ id: string; planned: unknown }>(
      `SELECT id, planned
         FROM gps_config_jobs
        WHERE device_id = $1 AND phase = 'waiting_link'
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [deviceId],
    );
    const row = job.rows[0];
    const plan = row ? planFrom(row.planned) : null;
    const command = plan?.steps[plan.step];
    if (!row || !plan || !command || !configuratorWireCommandAllowed(command)) {
      if (row) {
        await client.query(
          `UPDATE gps_config_jobs SET phase = 'failed', error = 'blocked', finished_at = now() WHERE id = $1`,
          [row.id],
        );
      }
      await client.query("COMMIT");
      return null;
    }
    const phase = command.startsWith("get") ? (plan.kind === "read" ? "reading" : "verifying") : "applying";
    await client.query(
      `UPDATE gps_config_jobs SET phase = $2, planned = $3::jsonb WHERE id = $1`,
      [row.id, phase, JSON.stringify({ ...plan, step: plan.step + 1 })],
    );
    await client.query("COMMIT");
    return { id: row.id, text: command };
  } catch {
    await client.query("ROLLBACK");
    return null;
  } finally {
    client.release();
  }
}

export async function finishConfiguratorCommand(commandId: string, responseText: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const database = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (database.rows[0]?.name !== "tripetica_dev") {
      await client.query("ROLLBACK");
      return;
    }
    const job = await client.query<{ planned: unknown }>(
      `SELECT planned FROM gps_config_jobs WHERE id = $1 FOR UPDATE`,
      [commandId],
    );
    const plan = planFrom(job.rows[0]?.planned);
    if (!plan) {
      await client.query("COMMIT");
      return;
    }
    const decision = advanceConfiguratorJob(plan, responseText.slice(0, 4000), { timeout: false });
    if (plan.kind === "parameter") {
      await storeParameterDecision(client, commandId, decision);
    } else {
      await client.query(
        `UPDATE gps_config_jobs
            SET phase = $2, error = $3, planned = $4::jsonb,
                finished_at = CASE WHEN $2 = 'waiting_link' THEN NULL ELSE now() END
          WHERE id = $1`,
        [commandId, decision.phase, decision.error, JSON.stringify(decision.plan)],
      );
    }
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}

export async function timeoutConfiguratorCommand(commandId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const database = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (database.rows[0]?.name !== "tripetica_dev") {
      await client.query("ROLLBACK");
      return;
    }
    const job = await client.query<{ planned: unknown; phase: string }>(
      `SELECT planned, phase FROM gps_config_jobs WHERE id = $1 FOR UPDATE`,
      [commandId],
    );
    const plan = planFrom(job.rows[0]?.planned);
    if (plan?.kind === "parameter" && (job.rows[0]?.phase === "applying" || job.rows[0]?.phase === "verifying")) {
      const decision = advanceConfiguratorJob(plan, "", { timeout: true });
      await storeParameterDecision(client, commandId, decision);
      await client.query("COMMIT");
      return;
    }
    if (plan?.kind === "read" && job.rows[0]?.phase === "reading") {
      const decision = advanceConfiguratorJob(plan, "", { timeout: true });
      await client.query(
        `UPDATE gps_config_jobs
            SET phase = $2, error = $3, planned = $4::jsonb,
                finished_at = CASE WHEN $2 = 'waiting_link' THEN NULL ELSE now() END
          WHERE id = $1`,
        [commandId, decision.phase, decision.error, JSON.stringify(decision.plan)],
      );
      await client.query("COMMIT");
      return;
    }
    await client.query(
      `UPDATE gps_config_jobs
          SET phase = 'failed', error = 'timeout', finished_at = now()
        WHERE id = $1 AND phase IN ('reading', 'applying', 'verifying')`,
      [commandId],
    );
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}
