import "server-only";

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";
import {
  advanceConfiguratorJob,
  configuratorReadPlan,
  parseConfiguratorPlan,
  productionConfiguratorGetparamAllowed,
  type ConfiguratorJobPlan,
} from "@/lib/teltonika/config-plan";
import { fmb920ReadParameterIds } from "@/lib/teltonika/parameters";

function readPlan(value: unknown): ConfiguratorJobPlan | null {
  const plan = parseConfiguratorPlan(value);
  return plan?.kind === "read" ? plan : null;
}

async function onProduction(client: PoolClient) {
  const database = await client.query<{ name: string }>("SELECT current_database() AS name");
  return database.rows[0]?.name === "tripetica";
}

/**
 * Queues one catalog getparam for one production device.
 * The configurator screen does not call this. A later explicit approval does.
 */
export async function queueProductionConfiguratorRead(input: { actorId: string; deviceId: string }) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await onProduction(client)) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "production_only" };
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
    await client.query(`SELECT id FROM gps_devices WHERE id = $1 FOR UPDATE`, [input.deviceId]);
    const open = await client.query(
      `SELECT id FROM gps_config_jobs
        WHERE device_id = $1 AND phase IN ('waiting_link', 'reading') AND planned->>'kind' = 'read'
        LIMIT 1`,
      [input.deviceId],
    );
    if (open.rows[0]) {
      await client.query("COMMIT");
      return { ok: true as const, queued: 0 };
    }
    const latest = await client.query<{ id: string; version: number }>(
      `SELECT version.id, version.version
         FROM gps_config_versions version
         JOIN gps_config_profiles profile ON profile.id = version.profile_id
        WHERE profile.kind = 'standard'
        ORDER BY version.version DESC
        LIMIT 1`,
    );
    const version = latest.rows[0];
    if (!version) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "missing_profile" };
    }
    const planned = configuratorReadPlan(fmb920ReadParameterIds(), version.version);
    if (planned.steps.length === 0 || planned.steps.some((step) => !productionConfiguratorGetparamAllowed(step))) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "blocked" };
    }
    await client.query(
      `INSERT INTO gps_config_jobs (device_id, version_id, phase, planned, created_by)
       VALUES ($1, $2, 'waiting_link', $3::jsonb, $4)`,
      [input.deviceId, version.id, JSON.stringify(planned), input.actorId],
    );
    await client.query(
      `INSERT INTO gps_config_audits (actor_id, action, detail)
       VALUES ($1, 'production_read_queued', $2::jsonb)`,
      [input.actorId, JSON.stringify({ deviceId: input.deviceId, version: version.version })],
    );
    await client.query("COMMIT");
    return { ok: true as const, queued: 1 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Claims one already queued getparam. It never creates an apply or automatic job. */
export async function claimProductionConfiguratorRead(imei: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await onProduction(client)) {
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
    const job = await client.query<{ id: string; planned: unknown }>(
      `SELECT id, planned
         FROM gps_config_jobs
        WHERE device_id = $1 AND phase = 'waiting_link' AND planned->>'kind' = 'read'
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [deviceId],
    );
    const row = job.rows[0];
    const plan = row ? readPlan(row.planned) : null;
    const command = plan?.steps[plan.step];
    if (!row || !plan || !command || !productionConfiguratorGetparamAllowed(command)) {
      if (row) {
        await client.query(
          `UPDATE gps_config_jobs SET phase = 'failed', error = 'blocked', finished_at = now() WHERE id = $1`,
          [row.id],
        );
      }
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `UPDATE gps_config_jobs SET phase = 'reading', planned = $2::jsonb WHERE id = $1`,
      [row.id, JSON.stringify({ ...plan, step: plan.step + 1 })],
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

export async function finishProductionConfiguratorRead(commandId: string, responseText: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await onProduction(client)) {
      await client.query("ROLLBACK");
      return false;
    }
    const job = await client.query<{ planned: unknown }>(
      `SELECT planned FROM gps_config_jobs WHERE id = $1 AND planned->>'kind' = 'read' FOR UPDATE`,
      [commandId],
    );
    const plan = readPlan(job.rows[0]?.planned);
    if (!plan) {
      await client.query("COMMIT");
      return false;
    }
    const decision = advanceConfiguratorJob(plan, responseText.slice(0, 4000), { timeout: false });
    const nextCommand = decision.plan.steps[decision.plan.step];
    if (decision.phase === "waiting_link" && !productionConfiguratorGetparamAllowed(nextCommand ?? "")) {
      await client.query(
        `UPDATE gps_config_jobs SET phase = 'failed', error = 'blocked', finished_at = now() WHERE id = $1`,
        [commandId],
      );
      await client.query("COMMIT");
      return true;
    }
    await client.query(
      `UPDATE gps_config_jobs
          SET phase = $2, error = $3, planned = $4::jsonb,
              finished_at = CASE WHEN $2 = 'waiting_link' THEN NULL ELSE now() END
        WHERE id = $1`,
      [commandId, decision.phase, decision.error, JSON.stringify(decision.plan)],
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

export async function timeoutProductionConfiguratorRead(commandId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!await onProduction(client)) {
      await client.query("ROLLBACK");
      return false;
    }
    const job = await client.query<{ planned: unknown; phase: string }>(
      `SELECT planned, phase FROM gps_config_jobs WHERE id = $1 AND planned->>'kind' = 'read' FOR UPDATE`,
      [commandId],
    );
    const plan = readPlan(job.rows[0]?.planned);
    if (!plan || job.rows[0]?.phase !== "reading") {
      await client.query("COMMIT");
      return false;
    }
    const decision = advanceConfiguratorJob(plan, "", { timeout: true });
    const nextCommand = decision.plan.steps[decision.plan.step];
    if (decision.phase === "waiting_link" && !productionConfiguratorGetparamAllowed(nextCommand ?? "")) {
      await client.query(
        `UPDATE gps_config_jobs SET phase = 'failed', error = 'blocked', finished_at = now() WHERE id = $1`,
        [commandId],
      );
      await client.query("COMMIT");
      return true;
    }
    await client.query(
      `UPDATE gps_config_jobs
          SET phase = $2, error = $3, planned = $4::jsonb,
              finished_at = CASE WHEN $2 = 'waiting_link' THEN NULL ELSE now() END
        WHERE id = $1`,
      [commandId, decision.phase, decision.error, JSON.stringify(decision.plan)],
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
