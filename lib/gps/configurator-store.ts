import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import {
  type ConfiguratorSnapshot,
  type ConfiguratorVersion,
} from "@/lib/gps/configurator-types";
import { parseTeltonikaGetparam } from "@/lib/teltonika/config-read";
import { queueProductionConfiguratorRead } from "@/lib/gps/production-config-read";
import { deviceRestartAllowed } from "@/lib/teltonika/restart";
import { configDispatchEnabled, configDraftForSave, configuratorReadPlan, manualReadAllowed, mergeConfig, planDeviceDispatch, profileSaveAllowed, readOutcomeTotals, retainUnverifiedObservations, type ConfigValues } from "@/lib/teltonika/config-plan";
import { fmb920ReadParameterIds, parameterById } from "@/lib/teltonika/parameters";

type VersionRow = {
  id: string;
  version: number;
  status: "draft" | "approved";
  values: ConfigValues;
  note: string;
  created_at: Date;
};

function versionOf(row: VersionRow): ConfiguratorVersion {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    values: row.values ?? {},
    note: row.note,
    createdAt: row.created_at.toISOString(),
  };
}

export async function loadConfiguratorSnapshot(): Promise<ConfiguratorSnapshot> {
  const database = await query<{ name: string }>("SELECT current_database() AS name");
  const name = database.rows[0]?.name ?? "";
  const profile = await query<{ id: string; name: string }>(
    `SELECT id, name FROM gps_config_profiles WHERE kind = 'standard' ORDER BY created_at LIMIT 1`,
  );
  const versions = profile.rows[0]
    ? await query<VersionRow>(
      `SELECT id, version, status, values, note, created_at
         FROM gps_config_versions
        WHERE profile_id = $1
        ORDER BY version DESC
        LIMIT 12`,
      [profile.rows[0].id],
    )
    : { rows: [] as VersionRow[] };
  const overrides = await query<{ device_id: string; values: ConfigValues }>(
    `SELECT device_id, values FROM gps_config_overrides`,
  );
  const jobs = await query<{
    id: string;
    device_id: string;
    plate: string | null;
    imei: string;
    partner_name: string | null;
    tracker_model: string | null;
    version: number;
    phase: string;
    error: string | null;
    created_at: Date;
  }>(
    `SELECT job.id, job.device_id, vehicle.plate, device.imei, partner.name AS partner_name,
            device.tracker_model, version.version, job.phase, job.error, job.created_at
       FROM gps_config_jobs job
       JOIN gps_devices device ON device.id = job.device_id
       JOIN gps_config_versions version ON version.id = job.version_id
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
       LEFT JOIN partners partner ON partner.id = device.partner_id
     WHERE COALESCE(job.planned->>'kind', '') <> 'parameter'
      ORDER BY job.created_at DESC
      LIMIT 40`,
  );
  const parameterApplies = await query<{
    id: string;
    device_id: string;
    plate: string | null;
    imei: string;
    parameter_id: string | null;
    previous: string | null;
    desired: string | null;
    verified: string | null;
    phase: string;
    error: string | null;
    created_at: Date;
    finished_at: Date | null;
    first_name: string | null;
    last_name: string | null;
  }>(
    `SELECT job.id, job.device_id, vehicle.plate, device.imei,
            job.planned->>'parameterId' AS parameter_id,
            job.planned->>'from' AS previous,
            job.planned->'target'->>(job.planned->>'parameterId') AS desired,
            job.planned->'values'->>(job.planned->>'parameterId') AS verified,
            job.phase, job.error, job.created_at, job.finished_at,
            actor.first_name, actor.last_name
       FROM gps_config_jobs job
       JOIN gps_devices device ON device.id = job.device_id
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
       LEFT JOIN ops_users actor ON actor.id = job.created_by
      WHERE job.planned->>'kind' = 'parameter'
      ORDER BY job.created_at DESC
      LIMIT 80`,
  );
  const firmware = await query<{ model: string; firmware: string }>(
    `SELECT model, firmware FROM gps_firmware_catalog ORDER BY model, firmware`,
  );
  const reads = await query<{ device_id: string; response_text: string; finished_at: Date | null }>(
    `SELECT DISTINCT ON (reads.device_id) reads.device_id, reads.response_text, reads.finished_at
       FROM gps_teltonika_config_reads reads
      WHERE reads.phase = 'answered'
        AND reads.command_text LIKE 'getparam %'
        AND reads.response_text IS NOT NULL
      ORDER BY reads.device_id, reads.finished_at DESC NULLS LAST`,
  );
  const readJobs = await query<{ device_id: string; phase: string; error: string | null; planned: { values?: ConfigValues; steps?: string[]; step?: number }; finished_at: Date | null; created_at: Date }>(
    `SELECT DISTINCT ON (job.device_id) job.device_id, job.phase, job.error, job.planned, job.finished_at, job.created_at
       FROM gps_config_jobs job
      WHERE job.planned->>'kind' = 'read'
      ORDER BY job.device_id, job.created_at DESC`,
  );
  const verifiedReads = await query<{ device_id: string; planned: { values?: ConfigValues }; finished_at: Date | null }>(
    `SELECT DISTINCT ON (job.device_id) job.device_id, job.planned, job.finished_at
       FROM gps_config_jobs job
      WHERE job.planned->>'kind' = 'read' AND job.phase = 'verified'
      ORDER BY job.device_id, job.created_at DESC`,
  );
  const restarts = await query<{ device_id: string; phase: string; error: string | null; created_at: Date }>(
    `SELECT DISTINCT ON (restart.device_id) restart.device_id, restart.phase, restart.error, restart.created_at
       FROM gps_device_restarts restart
      ORDER BY restart.device_id, restart.created_at DESC`,
  );
  const keywords = await query<{ device_id: string; has_keyword: boolean; phase: string | null; error: string | null }>(
    `SELECT device.id AS device_id,
            keyword.device_id IS NOT NULL AS has_keyword,
            job.phase,
            job.error
       FROM gps_devices device
       LEFT JOIN gps_device_keywords keyword ON keyword.device_id = device.id
       LEFT JOIN LATERAL (
         SELECT phase, error
           FROM gps_device_keyword_jobs
          WHERE device_id = device.id
          ORDER BY created_at DESC
          LIMIT 1
       ) job ON TRUE
      WHERE device.receiver = 'teltonika' AND device.deleted_at IS NULL
        AND (keyword.device_id IS NOT NULL OR job.phase IS NOT NULL)`,
  );
  const mapped = versions.rows.map(versionOf);
  return {
    database: name,
    writesOpen: name === "tripetica_dev",
    restartOpen: deviceRestartAllowed(name),
    readsOpen: manualReadAllowed(name),
    saveOpen: profileSaveAllowed(name),
    transmissionOpen: configDispatchEnabled(),
    profileName: profile.rows[0]?.name ?? null,
    latest: mapped[0] ?? null,
    approved: mapped.find((version) => version.status === "approved") ?? null,
    versions: mapped,
    overrides: overrides.rows.map((row) => ({ deviceId: row.device_id, values: row.values ?? {} })),
    reads: configuratorReads(reads.rows, verifiedReads.rows, readJobs.rows),
    restarts: restarts.rows.map((row) => ({
      deviceId: row.device_id,
      phase: row.phase,
      error: row.error,
      createdAt: row.created_at.toISOString(),
    })),
    keywords: keywords.rows.map((row) => ({
      deviceId: row.device_id,
      hasKeyword: row.has_keyword,
      phase: row.phase,
      error: row.error,
    })),
    jobs: jobs.rows.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      plate: row.plate,
      imei: row.imei,
      partnerName: row.partner_name,
      model: row.tracker_model,
      version: row.version,
      phase: row.phase,
      error: row.error,
      createdAt: row.created_at.toISOString(),
    })),
    parameterApplies: parameterApplies.rows.flatMap((row) => {
      const parameterId = Number(row.parameter_id);
      const parameter = parameterById(parameterId);
      if (!parameter) return [];
      const secret = /password|username|keyword|login|apn/i.test(parameter.name);
      const show = (value: string | null) => {
        const text = value?.trim() ?? "";
        if (!text) return "";
        return secret ? "••••" : text;
      };
      const actorName = [row.first_name, row.last_name].filter((part) => part && part.trim()).join(" ");
      return [{
        id: row.id,
        deviceId: row.device_id,
        plate: row.plate,
        imei: row.imei,
        parameterId,
        from: show(row.previous),
        to: show(row.desired),
        verified: row.phase === "verified" ? show(row.verified) : "",
        phase: row.phase,
        error: row.error,
        createdAt: row.created_at.toISOString(),
        finishedAt: row.finished_at?.toISOString() ?? null,
        actorName,
      }];
    }),
    firmware: firmware.rows,
  };
}

function readProgress(planned: { values?: ConfigValues; steps?: string[]; expect?: string[]; outcomes?: Record<string, "read" | "unsupported" | "empty" | "device_error" | "parse_error" | "timeout" | "unresolved"> } | null | undefined, phase: string) {
  if (!planned?.steps?.some((step) => step.startsWith("getparam "))) return null;
  const totals = readOutcomeTotals({
    expect: planned.expect ?? [],
    steps: planned.steps ?? [],
    values: planned.values ?? {},
    outcomes: planned.outcomes,
  });
  if (totals.total === 0) return null;
  return { ...totals, phase };
}

function configuratorReads(
  green: { device_id: string; response_text: string; finished_at: Date | null }[],
  verified: { device_id: string; planned: { values?: ConfigValues }; finished_at: Date | null }[],
  latest: { device_id: string; phase: string; error: string | null; planned: Parameters<typeof readProgress>[0]; finished_at: Date | null; created_at: Date }[],
) {
  const byDevice = new Map<string, {
    values: ConfigValues;
    readAt: string | null;
    status: "answered" | "pending" | "failed" | "partial" | "none";
    progress: ReturnType<typeof readProgress>;
  }>();
  for (const row of green) {
    byDevice.set(row.device_id, {
      values: publicRead(parseTeltonikaGetparam(row.response_text)),
      readAt: row.finished_at?.toISOString() ?? null,
      status: "answered",
      progress: null,
    });
  }
  for (const row of verified) {
    const current = byDevice.get(row.device_id);
    const readAt = row.finished_at?.toISOString() ?? null;
    if (current?.readAt && readAt && current.readAt > readAt) continue;
    byDevice.set(row.device_id, {
      values: { ...(current?.values ?? {}), ...publicRead(row.planned?.values ?? {}) },
      readAt,
      status: "answered",
      progress: null,
    });
  }
  for (const row of latest) {
    const pending = row.phase === "waiting_link" || row.phase === "reading" || row.phase === "applying" || row.phase === "verifying";
    const progress = readProgress(row.planned, row.phase);
    const collected = publicRead(row.planned?.values ?? {});
    if (pending) {
      byDevice.set(row.device_id, {
        values: {},
        readAt: null,
        status: "pending",
        progress,
      });
      continue;
    }
    if (row.phase === "verified") {
      const partial = row.error === "partial" || (progress !== null && progress.read < progress.total);
      byDevice.set(row.device_id, {
        values: collected,
        readAt: row.finished_at?.toISOString() ?? row.created_at.toISOString(),
        status: partial ? "partial" : "answered",
        progress,
      });
      continue;
    }
    if (Object.keys(collected).length > 0 || (progress && progress.read + progress.unsupported + progress.empty + progress.failed + progress.unresolved > 0)) {
      byDevice.set(row.device_id, {
        values: collected,
        readAt: row.finished_at?.toISOString() ?? null,
        status: "partial",
        progress,
      });
      continue;
    }
    byDevice.set(row.device_id, {
      values: {},
      readAt: null,
      status: "failed",
      progress,
    });
  }
  return [...byDevice.entries()].map(([deviceId, read]) => ({ deviceId, ...read }));
}

function publicRead(values: ConfigValues) {
  const visible: ConfigValues = {};
  for (const [key, value] of Object.entries(values)) {
    const parameter = /^\d+$/.test(key) ? parameterById(Number(key)) : null;
    if (parameter && /password|username|apn/i.test(parameter.name)) continue;
    visible[key] = value;
  }
  return visible;
}

function uuidList(ids: readonly string[]) {
  return [...new Set(ids.map((id) => id.trim().toLowerCase()))].filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id));
}

export async function saveConfigurator(input: {
  actorId: string;
  scope: "standard" | "devices";
  deviceIds: string[];
  values: ConfigValues;
  note: string;
  criticalApproved: boolean;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const database = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (!profileSaveAllowed(database.rows[0]?.name ?? "")) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "dev_only" };
    }
    const profile = await client.query<{ id: string }>(
      `SELECT id FROM gps_config_profiles WHERE kind = 'standard' ORDER BY created_at LIMIT 1 FOR UPDATE`,
    );
    const profileId = profile.rows[0]?.id;
    if (!profileId) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "missing_profile" };
    }
    const previous = await client.query<{ values: ConfigValues }>(
      `SELECT values
         FROM gps_config_versions
        WHERE profile_id = $1
        ORDER BY version DESC
        LIMIT 1`,
      [profileId],
    );
    const deviceIds = uuidList(input.deviceIds);
    const reads = deviceIds.length === 0 ? { rows: [] as { planned: { values?: ConfigValues } }[] } : await client.query<{ planned: { values?: ConfigValues } }>(
      `SELECT DISTINCT ON (device_id) planned
         FROM gps_config_jobs
        WHERE device_id = ANY($1::uuid[])
          AND planned->>'kind' = 'read'
          AND phase = 'verified'
        ORDER BY device_id, created_at DESC`,
      [deviceIds],
    );
    const observed: ConfigValues = {};
    for (const row of reads.rows) {
      for (const [key, value] of Object.entries(row.planned?.values ?? {})) {
        if (typeof value === "string") observed[key] = value;
      }
    }
    const clean = retainUnverifiedObservations(
      configDraftForSave(input.values, previous.rows[0]?.values ?? {}, input.criticalApproved),
      input.values,
      observed,
    );
    if (clean.rejected.length > 0 || Object.keys(clean.values).length === 0) {
      await client.query("ROLLBACK");
      const detail = clean.rejected.length > 0
        ? clean.rejected.slice(0, 20).map((item) => `${item.id}:${item.reason}`).join("|")
        : "values:empty";
      return { ok: false as const, error: "invalid", detail };
    }
    if (input.scope === "devices") {
      if (deviceIds.length === 0) {
        await client.query("ROLLBACK");
        return { ok: false as const, error: "devices" };
      }
      for (const deviceId of deviceIds) {
        await client.query(
          `INSERT INTO gps_config_overrides (device_id, values, updated_by)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (device_id) DO UPDATE
             SET values = gps_config_overrides.values || EXCLUDED.values,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = now()`,
          [deviceId, JSON.stringify(clean.values), input.actorId],
        );
      }
      await client.query(
        `INSERT INTO gps_config_audits (actor_id, action, detail) VALUES ($1, 'save_override', $2::jsonb)`,
        [input.actorId, JSON.stringify({ devices: deviceIds.length, ids: Object.keys(clean.values) })],
      );
      await client.query("COMMIT");
      return { ok: true as const, saved: "override" as const, values: clean.values };
    }
    const next = await client.query<{ version: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS version FROM gps_config_versions WHERE profile_id = $1`,
      [profileId],
    );
    const version = next.rows[0]?.version ?? 1;
    await client.query(
      `INSERT INTO gps_config_versions (profile_id, version, status, values, note, created_by)
       VALUES ($1, $2, 'draft', $3::jsonb, $4, $5)`,
      [profileId, version, JSON.stringify(clean.values), input.note.slice(0, 240), input.actorId],
    );
    await client.query(
      `INSERT INTO gps_config_audits (actor_id, action, detail) VALUES ($1, 'save_standard', $2::jsonb)`,
      [input.actorId, JSON.stringify({ version, ids: Object.keys(clean.values) })],
    );
    await client.query("COMMIT");
    return { ok: true as const, saved: "standard" as const, version, values: clean.values };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function queueConfiguratorApply(input: {
  actorId: string;
  deviceIds: string[];
  criticalApproved: boolean;
}) {
  const deviceIds = uuidList(input.deviceIds);
  if (deviceIds.length === 0) return { ok: false as const, error: "devices" };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const database = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (database.rows[0]?.name !== "tripetica_dev" || configDispatchEnabled()) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: database.rows[0]?.name === "tripetica_dev" ? "dispatch_closed" : "dev_only" };
    }
    const latest = await client.query<{ id: string; status: string; values: ConfigValues; version: number }>(
      `SELECT version.id, version.status, version.values, version.version
         FROM gps_config_versions version
         JOIN gps_config_profiles profile ON profile.id = version.profile_id
        WHERE profile.kind = 'standard'
        ORDER BY version.version DESC
        LIMIT 1`,
    );
    const target = latest.rows[0];
    if (!target) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "missing_profile" };
    }
    let queued = 0;
    for (const deviceId of deviceIds) {
      const override = await client.query<{ values: ConfigValues }>(
        `SELECT values FROM gps_config_overrides WHERE device_id = $1`,
        [deviceId],
      );
      const reading = await client.query<{ response_text: string; finished_at: Date | null }>(
        `SELECT response_text, finished_at
           FROM gps_teltonika_config_reads
          WHERE device_id = $1
            AND phase = 'answered'
            AND command_text LIKE 'getparam %'
            AND response_text IS NOT NULL
          ORDER BY finished_at DESC NULLS LAST
          LIMIT 1`,
        [deviceId],
      );
      const savedRead = await client.query<{ planned: { values?: ConfigValues }; finished_at: Date | null }>(
        `SELECT planned, finished_at
           FROM gps_config_jobs
          WHERE device_id = $1 AND planned->>'kind' = 'read' AND phase = 'verified'
          ORDER BY created_at DESC
          LIMIT 1`,
        [deviceId],
      );
      const greenValues = reading.rows[0] ? parseTeltonikaGetparam(reading.rows[0].response_text) : null;
      const savedValues = savedRead.rows[0]?.planned?.values ?? null;
      const known = greenValues || savedValues
        ? { ...(greenValues ?? {}), ...(savedValues ?? {}) }
        : null;
      const merged = mergeConfig(target.values ?? {}, override.rows[0]?.values ?? {});
      const decision = planDeviceDispatch({ read: known, target: merged });
      await client.query(
        `INSERT INTO gps_config_jobs (device_id, version_id, phase, error, planned, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [deviceId, target.id, decision.phase, decision.error, JSON.stringify({
          kind: "apply",
          version: target.version,
          steps: decision.steps,
          step: 0,
          values: {},
          target: merged,
          expect: decision.expect,
        }), input.actorId],
      );
      queued += 1;
    }
    await client.query(
      `INSERT INTO gps_config_audits (actor_id, action, detail) VALUES ($1, 'apply_queued', $2::jsonb)`,
      [input.actorId, JSON.stringify({ devices: queued, version: target.version, carrier: "dev-listener" })],
    );
    await client.query("COMMIT");
    return { ok: true as const, queued, version: target.version };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Queues a TCP read for one device. Any other selection cancels pending reads. */
export async function syncConfiguratorRead(input: { actorId: string; deviceId: string | null }) {
  const deviceId = input.deviceId ? uuidList([input.deviceId])[0] ?? null : null;
  if (input.deviceId && !deviceId) return { ok: false as const, error: "devices" };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const database = await client.query<{ name: string }>("SELECT current_database() AS name");
    if (database.rows[0]?.name !== "tripetica_dev") {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "dev_only" };
    }
    await client.query(
      `UPDATE gps_config_jobs
          SET phase = 'failed', error = 'cancelled', finished_at = now()
        WHERE phase = 'waiting_link'
          AND planned->>'kind' = 'read'
          AND ($1::uuid IS NULL OR device_id <> $1::uuid)`,
      [deviceId],
    );
    if (!deviceId) {
      await client.query("COMMIT");
      return { ok: true as const, queued: 0 };
    }
    await client.query(`SELECT id FROM gps_devices WHERE id = $1 FOR UPDATE`, [deviceId]);
    const existing = await client.query(
      `SELECT id FROM gps_config_jobs
        WHERE device_id = $1 AND phase IN ('waiting_link', 'reading') AND planned->>'kind' = 'read'
        LIMIT 1`,
      [deviceId],
    );
    if (existing.rows[0]) {
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
    await client.query(
      `INSERT INTO gps_config_jobs (device_id, version_id, phase, planned, created_by)
       VALUES ($1, $2, 'waiting_link', $3::jsonb, $4)`,
      [deviceId, version.id, JSON.stringify(planned), input.actorId],
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

/** Queues one getparam read for the selected device. It does not write a device parameter. */
export async function queueManualConfiguratorRead(input: { actorId: string; deviceId: string }) {
  const database = await query<{ name: string }>("SELECT current_database() AS name");
  const name = database.rows[0]?.name ?? "";
  if (!manualReadAllowed(name)) return { ok: false as const, error: "dev_only" };
  if (name === "tripetica") return queueProductionConfiguratorRead(input);
  return syncConfiguratorRead({ actorId: input.actorId, deviceId: input.deviceId });
}
