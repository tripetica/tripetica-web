import "server-only";

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";
import {
  advanceConfiguratorJob,
  parameterApplyAllowed,
  parameterApplyCommandAllowed,
  parseConfiguratorPlan,
  planParameterApply,
  type ConfiguratorJobPlan,
} from "@/lib/teltonika/config-plan";

const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parameterPlan(value: unknown) {
  const plan = parseConfiguratorPlan(value);
  return plan?.kind === "parameter" ? plan : null;
}

async function databaseName(client: PoolClient) {
  const database = await client.query<{ name: string }>("SELECT current_database() AS name");
  return database.rows[0]?.name ?? "";
}

async function knownParameterValue(client: PoolClient, deviceId: string, parameterId: number) {
  const key = String(parameterId);
  const read = await client.query<{ value: string | null; finished_at: Date | null }>(
    `SELECT planned->'values'->>$2 AS value, finished_at
       FROM gps_config_jobs
      WHERE device_id = $1 AND planned->>'kind' = 'read' AND phase = 'verified'
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 1`,
    [deviceId, key],
  );
  const applied = await client.query<{ value: string | null; finished_at: Date | null }>(
    `SELECT planned->'values'->>$2 AS value, finished_at
       FROM gps_config_jobs
      WHERE device_id = $1
        AND planned->>'kind' = 'parameter'
        AND planned->>'parameterId' = $2
        AND phase = 'verified'
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 1`,
    [deviceId, key],
  );
  const catalog = read.rows[0];
  const single = applied.rows[0];
  const chosen = (single?.finished_at?.getTime() ?? 0) >= (catalog?.finished_at?.getTime() ?? 0) ? single : catalog;
  const value = chosen?.value?.trim();
  return value ? value : null;
}

/** Queues one parameter for each selected device. It does not write a profile version. */
export async function queueParameterApply(input: {
  actorId: string;
  deviceIds: readonly string[];
  parameterId: number;
  value: string;
}) {
  const deviceIds = [...new Set(input.deviceIds.map((id) => id.trim()).filter((id) => DEVICE_ID.test(id)))];
  if (deviceIds.length === 0) return { ok: false as const, error: "devices" };
  const preview = planParameterApply({ parameterId: input.parameterId, value: input.value, previous: null });
  if (!preview.ok) return { ok: false as const, error: preview.reason };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!parameterApplyAllowed(await databaseName(client))) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "database" };
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
    const devices = await client.query<{ id: string; tracker_model: string }>(
      `SELECT id, tracker_model
         FROM gps_devices
        WHERE id = ANY($1::uuid[])
          AND receiver = 'teltonika'
          AND status = 'active'
          AND deleted_at IS NULL
        ORDER BY id
        FOR UPDATE`,
      [deviceIds],
    );
    let queued = 0;
    let unchanged = 0;
    let skipped = 0;
    let rejected = deviceIds.length - devices.rows.length;
    for (const device of devices.rows) {
      if (device.tracker_model !== "fmb920" && device.tracker_model !== "fmc920") {
        rejected += 1;
        continue;
      }
      const open = await client.query(
        `SELECT id
           FROM gps_config_jobs
          WHERE device_id = $1
            AND planned->>'kind' = 'parameter'
            AND planned->>'parameterId' = $2
            AND phase IN ('waiting', 'waiting_link', 'reading', 'applying', 'verifying')
          LIMIT 1`,
        [device.id, String(input.parameterId)],
      );
      if (open.rows[0]) {
        skipped += 1;
        continue;
      }
      const previous = await knownParameterValue(client, device.id, input.parameterId);
      const decision = planParameterApply({ parameterId: input.parameterId, value: input.value, previous });
      if (!decision.ok || decision.plan.steps.some((step) => !parameterApplyCommandAllowed(step))) {
        rejected += 1;
        continue;
      }
      const plan = { ...decision.plan, version: version.version };
      if (decision.unchanged) {
        await client.query(
          `INSERT INTO gps_config_jobs (device_id, version_id, phase, planned, created_by, finished_at)
           VALUES ($1, $2, 'no_change', $3::jsonb, $4, now())`,
          [device.id, version.id, JSON.stringify(plan), input.actorId],
        );
        unchanged += 1;
        continue;
      }
      await client.query(
        `INSERT INTO gps_config_jobs (device_id, version_id, phase, planned, created_by)
         VALUES ($1, $2, 'waiting_link', $3::jsonb, $4)`,
        [device.id, version.id, JSON.stringify(plan), input.actorId],
      );
      queued += 1;
    }
    if (queued + unchanged + skipped === 0) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: rejected > 0 ? "unsupported" : "devices" };
    }
    await client.query(
      `INSERT INTO gps_config_audits (actor_id, action, detail)
       VALUES ($1, 'parameter_apply', $2::jsonb)`,
      [input.actorId, JSON.stringify({ parameterId: input.parameterId, queued, unchanged, skipped })],
    );
    await client.query("COMMIT");
    return { ok: true as const, queued, unchanged, skipped };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Claims the next explicit parameter command. It does not create an automatic job. */
export async function claimParameterApply(imei: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!parameterApplyAllowed(await databaseName(client))) {
      await client.query("ROLLBACK");
      return null;
    }
    const device = await client.query<{ id: string }>(
      `SELECT id
         FROM gps_devices
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
        WHERE device_id = $1 AND phase = 'waiting_link' AND planned->>'kind' = 'parameter'
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [deviceId],
    );
    const row = job.rows[0];
    const plan = row ? parameterPlan(row.planned) : null;
    const command = plan?.steps[plan.step];
    if (!row || !plan || !command || !parameterApplyCommandAllowed(command)) {
      if (row) {
        await client.query(
          `UPDATE gps_config_jobs SET phase = 'failed', error = 'blocked', finished_at = now() WHERE id = $1`,
          [row.id],
        );
      }
      await client.query("COMMIT");
      return null;
    }
    const phase = command.startsWith("getparam ") ? "verifying" : "applying";
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

export async function storeParameterDecision(
  client: PoolClient,
  jobId: string,
  decision: { phase: string; error: string | null; plan: ConfiguratorJobPlan },
) {
  const nextCommand = decision.plan.steps[decision.plan.step];
  if (decision.phase === "waiting_link" && !parameterApplyCommandAllowed(nextCommand ?? "")) {
    await client.query(
      `UPDATE gps_config_jobs SET phase = 'failed', error = 'blocked', finished_at = now() WHERE id = $1`,
      [jobId],
    );
    return;
  }
  await client.query(
    `UPDATE gps_config_jobs
        SET phase = $2, error = $3, planned = $4::jsonb,
            finished_at = CASE WHEN $2 = 'waiting_link' THEN NULL ELSE now() END
      WHERE id = $1`,
    [jobId, decision.phase, decision.error, JSON.stringify(decision.plan)],
  );
  if (decision.phase !== "verified" || decision.plan.kind !== "parameter") return;
  const parameterId = decision.plan.parameterId;
  const key = parameterId === undefined ? "" : String(parameterId);
  const value = key ? decision.plan.values[key] : undefined;
  if (!key || value === undefined) return;
  const job = await client.query<{ device_id: string; created_by: string | null }>(
    `SELECT device_id, created_by FROM gps_config_jobs WHERE id = $1`,
    [jobId],
  );
  const row = job.rows[0];
  if (!row) return;
  await client.query(
    `INSERT INTO gps_config_overrides (device_id, values, updated_by)
     VALUES ($1, jsonb_build_object($2::text, $3::text), $4)
     ON CONFLICT (device_id) DO UPDATE
       SET values = gps_config_overrides.values || EXCLUDED.values,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
    [row.device_id, key, value, row.created_by],
  );
}

export async function finishParameterApply(commandId: string, responseText: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!parameterApplyAllowed(await databaseName(client))) {
      await client.query("ROLLBACK");
      return false;
    }
    const job = await client.query<{ planned: unknown }>(
      `SELECT planned FROM gps_config_jobs WHERE id = $1 AND planned->>'kind' = 'parameter' FOR UPDATE`,
      [commandId],
    );
    const plan = parameterPlan(job.rows[0]?.planned);
    if (!plan) {
      await client.query("COMMIT");
      return false;
    }
    const decision = advanceConfiguratorJob(plan, responseText.slice(0, 4000), { timeout: false });
    await storeParameterDecision(client, commandId, decision);
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

export async function timeoutParameterApply(commandId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (!parameterApplyAllowed(await databaseName(client))) {
      await client.query("ROLLBACK");
      return false;
    }
    const job = await client.query<{ planned: unknown; phase: string }>(
      `SELECT planned, phase FROM gps_config_jobs WHERE id = $1 AND planned->>'kind' = 'parameter' FOR UPDATE`,
      [commandId],
    );
    const row = job.rows[0];
    const plan = row ? parameterPlan(row.planned) : null;
    if (!row || !plan) {
      await client.query("COMMIT");
      return false;
    }
    if (row.phase !== "applying" && row.phase !== "verifying") {
      await client.query("COMMIT");
      return true;
    }
    const decision = advanceConfiguratorJob(plan, "", { timeout: true });
    await storeParameterDecision(client, commandId, decision);
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}
