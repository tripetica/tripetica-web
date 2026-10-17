import { getPool } from "@/lib/db/postgres";
import { gpsPresence } from "@/lib/gps/presence";
import {
  immobilizerDisplayedPhase,
  immobilizerDuplicate,
  immobilizerReadiness,
  immobilizerReplyPhase,
  immobilizerView,
  nextImmobilizerCapability,
  immobilizerEnableGate,
  planImmobilizerCommand,
  trackerModel,
  IMMOBILIZER_ENABLE_CONFIRM_MS,
  type ImmobilizerIgnition,
  type ImmobilizerOutput,
  type ImmobilizerPanel,
  type ImmobilizerPhase,
  type ImmobilizerRequest,
} from "@/lib/teltonika/immobilizer";

type DeviceRow = {
  id: string;
  receiver: string;
  partner_id: string | null;
  vehicle_id: string | null;
  tracker_model: string | null;
  speed_mps: string | number | null;
  acc_state: string | null;
  din1_state: string | null;
  recorded_at: Date | null;
  request: ImmobilizerRequest | null;
  output_state: ImmobilizerOutput | null;
  output_observed_at: Date | null;
  hardware_supported: boolean | null;
  relay_installed: boolean | null;
  installation_verified_at: Date | null;
  installation_verified_by: string | null;
  service_enabled: boolean | null;
  starter_circuit_verified: boolean | null;
  starter_circuit_verified_at: Date | null;
  starter_circuit_verified_by: string | null;
  phase: ImmobilizerPhase | null;
  command_text: string | null;
  response_text: string | null;
  command_at: Date | null;
  last_heartbeat_at: Date | null;
};

const PANEL_COLUMNS = `
  device.id,
  device.receiver,
  device.partner_id,
  device.vehicle_id,
  device.tracker_model,
  status.speed_mps,
  status.acc_state,
  status.din1_state,
  status.recorded_at,
  block.request,
  block.output_state,
  block.output_observed_at,
  block.hardware_supported,
  block.relay_installed,
  block.installation_verified_at,
  block.installation_verified_by,
  block.service_enabled,
  block.starter_circuit_verified,
  block.starter_circuit_verified_at,
  block.starter_circuit_verified_by,
  command.phase,
  command.command_text,
  command.response_text,
  command.created_at AS command_at,
  status.last_heartbeat_at`;

export async function loadImmobilizerPanelForDevice(deviceId: string, partnerScope: string | null, now = new Date()): Promise<ImmobilizerPanel | null> {
  const result = await getPool().query<DeviceRow>(
    `SELECT ${PANEL_COLUMNS}
     FROM gps_devices device
     LEFT JOIN gps_device_status status ON status.device_id = device.id
     LEFT JOIN gps_immobilizer_status block ON block.device_id = device.id
     LEFT JOIN LATERAL (
       SELECT phase, command_text, response_text, created_at
       FROM gps_immobilizer_commands
       WHERE device_id = device.id
       ORDER BY created_at DESC
       LIMIT 1
     ) command ON TRUE
     WHERE device.id = $1
       AND device.receiver = 'teltonika'
       AND device.status = 'active'
       AND ($2::uuid IS NULL OR device.partner_id = $2)`,
    [deviceId, partnerScope],
  );
  if (result.rows.length !== 1) return null;
  return panelFrom(result.rows[0]!, now);
}

export async function loadImmobilizerPanel(vehicleId: string, partnerScope: string | null, now = new Date()): Promise<ImmobilizerPanel | null> {
  const result = await getPool().query<DeviceRow>(
    `SELECT ${PANEL_COLUMNS}
     FROM gps_devices device
     LEFT JOIN gps_device_status status ON status.device_id = device.id
     LEFT JOIN gps_immobilizer_status block ON block.device_id = device.id
     LEFT JOIN LATERAL (
       SELECT phase, command_text, response_text, created_at
       FROM gps_immobilizer_commands
       WHERE device_id = device.id
       ORDER BY created_at DESC
       LIMIT 1
     ) command ON TRUE
     WHERE device.vehicle_id = $1
       AND device.receiver = 'teltonika'
       AND device.status = 'active'
       AND ($2::uuid IS NULL OR device.partner_id = $2)`,
    [vehicleId, partnerScope],
  );
  if (result.rows.length !== 1) return null;
  return panelFrom(result.rows[0]!, now);
}

export async function beginImmobilizerEnable(input: {
  deviceId: string;
  partnerScope: string | null;
  actorKey: string;
  surface: "ops" | "partner";
  now?: Date;
}): Promise<{ ok: true; confirmationId: string } | { ok: false; error: "forbidden" }> {
  const now = input.now ?? new Date();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const allowed = await client.query<{ id: string }>(
      `SELECT device.id
       FROM gps_devices device
       WHERE device.id = $1
         AND device.receiver = 'teltonika'
         AND device.status = 'active'
         AND device.vehicle_id IS NOT NULL
         AND device.partner_id IS NOT NULL
         AND ($2::uuid IS NULL OR device.partner_id = $2)
         AND (
           SELECT COUNT(*)
           FROM gps_devices sibling
           WHERE sibling.vehicle_id = device.vehicle_id
             AND sibling.receiver = 'teltonika'
             AND sibling.status = 'active'
         ) = 1`,
      [input.deviceId, input.partnerScope],
    );
    if (!allowed.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "forbidden" };
    }
    const created = await client.query<{ id: string }>(
      `INSERT INTO gps_immobilizer_enable_confirmations (device_id, surface, actor_key, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.deviceId, input.surface, input.actorKey, new Date(now.getTime() + IMMOBILIZER_ENABLE_CONFIRM_MS)],
    );
    await client.query("COMMIT");
    const confirmationId = created.rows[0]?.id;
    if (!confirmationId) return { ok: false, error: "forbidden" };
    return { ok: true, confirmationId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordImmobilizerRequest(input: {
  deviceId: string;
  partnerScope: string | null;
  actorLabel: string;
  actorKey: string;
  surface: "ops" | "partner";
  request: ImmobilizerRequest;
  confirmationId: string | null;
  env?: Record<string, string | undefined>;
  now?: Date;
}): Promise<{ ok: true; panel: ImmobilizerPanel } | { ok: false; error: "forbidden" | "duplicate" | "confirm" | "not_ready" | "unsafe" }> {
  const enableConfirmation = input.request === "on" ? immobilizerEnableGate(input.confirmationId) : null;
  if (enableConfirmation && !enableConfirmation.ok) return { ok: false, error: "confirm" };
  const now = input.now ?? new Date();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<DeviceRow>(
      `SELECT device.id,
              device.receiver,
              device.partner_id,
              device.vehicle_id,
              device.tracker_model,
              status.speed_mps,
              status.acc_state,
              status.din1_state,
              status.recorded_at,
              block.request,
              block.output_state,
              block.output_observed_at,
              block.hardware_supported,
              block.relay_installed,
              block.installation_verified_at,
              block.installation_verified_by,
              block.service_enabled,
              block.starter_circuit_verified,
              NULL::text AS phase,
              NULL::text AS command_text,
              NULL::text AS response_text,
              NULL::timestamptz AS command_at,
              status.last_heartbeat_at
       FROM gps_devices device
       LEFT JOIN gps_device_status status ON status.device_id = device.id
       LEFT JOIN gps_immobilizer_status block ON block.device_id = device.id
       WHERE device.id = $1
         AND device.receiver = 'teltonika'
         AND device.status = 'active'
         AND device.vehicle_id IS NOT NULL
         AND ($2::uuid IS NULL OR device.partner_id = $2)
       FOR UPDATE OF device`,
      [input.deviceId, input.partnerScope],
    );
    const device = locked.rows[0];
    if (!device?.vehicle_id || !device.partner_id) {
      await client.query("ROLLBACK");
      return { ok: false, error: "forbidden" };
    }
    const count = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM gps_devices
       WHERE vehicle_id = $1
         AND receiver = 'teltonika'
         AND status = 'active'`,
      [device.vehicle_id],
    );
    if (count.rows[0]?.count !== "1") {
      await client.query("ROLLBACK");
      return { ok: false, error: "forbidden" };
    }
    if (enableConfirmation?.ok) {
      const consumed = await client.query<{ id: string }>(
        `UPDATE gps_immobilizer_enable_confirmations
         SET used_at = $5
         WHERE id = $1
           AND device_id = $2
           AND surface = $3
           AND actor_key = $4
           AND used_at IS NULL
           AND expires_at > $5
         RETURNING id`,
        [enableConfirmation.confirmationId, device.id, input.surface, input.actorKey, now],
      );
      if (!consumed.rows[0]) {
        await client.query("ROLLBACK");
        return { ok: false, error: "confirm" };
      }
    }
    const recent = await client.query<{ request: ImmobilizerRequest; created_at: Date; phase: ImmobilizerPhase }>(
      `SELECT request, created_at, phase
       FROM gps_immobilizer_commands
       WHERE device_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [device.id],
    );
    const last = recent.rows[0];
    if (immobilizerDuplicate(
      last
        ? { request: last.request, phase: last.phase, ageMs: now.getTime() - last.created_at.getTime() }
        : null,
      input.request,
    )) {
      await client.query("ROLLBACK");
      return { ok: false, error: "duplicate" };
    }
    const plan = planImmobilizerCommand({
      request: input.request,
      model: trackerModel(device.tracker_model),
      speedMps: speedMps(device.speed_mps),
      env: input.env ?? process.env,
      hardwareSupported: device.hardware_supported === true,
      relayInstalled: device.relay_installed === true,
      installationVerified: device.installation_verified_at !== null,
      serviceEnabled: device.service_enabled === true,
      starterCircuitVerified: device.starter_circuit_verified === true,
      presence: gpsPresence(device.last_heartbeat_at, now),
      ignition: ignitionState(device.din1_state),
      gnssAgeMs: device.recorded_at ? now.getTime() - device.recorded_at.getTime() : null,
    });
    if (!plan.commandText) {
      await client.query("ROLLBACK");
      return { ok: false, error: "forbidden" };
    }
    await client.query(
      `INSERT INTO gps_immobilizer_commands (
         device_id, vehicle_id, partner_id, actor_label, surface, request, command_text, phase
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [device.id, device.vehicle_id, device.partner_id, input.actorLabel, input.surface, input.request, plan.commandText, plan.phase],
    );
    if (plan.phase !== "rejected") {
      await client.query(
        `INSERT INTO gps_immobilizer_status (device_id, request)
         VALUES ($1, $2)
         ON CONFLICT (device_id) DO UPDATE
         SET request = EXCLUDED.request,
             updated_at = NOW()`,
        [device.id, input.request],
      );
    }
    await client.query("COMMIT");
    const panel = panelFrom({
      ...device,
      request: plan.phase === "rejected" ? device.request : input.request,
      phase: plan.phase,
      command_text: plan.commandText,
      command_at: now,
    }, now);
    if (plan.phase === "rejected") return { ok: false, error: "unsafe" };
    return { ok: true, panel };
  } catch (error) {
    await client.query("ROLLBACK");
    if (postgresCode(error) === "23505") return { ok: false, error: "duplicate" };
    throw error;
  } finally {
    client.release();
  }
}

export async function saveImmobilizerCapability(input: {
  deviceId: string;
  actorLabel: string;
  hardwareSupported: boolean;
  relayInstalled: boolean;
  verified: boolean;
  serviceEnabled: boolean;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ tracker_model: string | null; verified_at: Date | null; verified_by: string | null }>(
      `SELECT device.tracker_model,
              block.installation_verified_at AS verified_at,
              block.installation_verified_by AS verified_by
       FROM gps_devices device
       LEFT JOIN gps_immobilizer_status block ON block.device_id = device.id
       WHERE device.id = $1
         AND device.receiver = 'teltonika'
         AND device.status = 'active'
       FOR UPDATE OF device`,
      [input.deviceId],
    );
    const device = locked.rows[0];
    if (!device) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "forbidden" as const };
    }
    const next = nextImmobilizerCapability({
      model: trackerModel(device.tracker_model),
      hardwareSupported: input.hardwareSupported,
      relayInstalled: input.relayInstalled,
      verified: input.verified,
      serviceEnabled: input.serviceEnabled,
    });
    const verifiedAt = next.verified ? device.verified_at ?? new Date() : null;
    const verifiedBy = next.verified ? device.verified_by ?? input.actorLabel : null;
    await client.query(
      `INSERT INTO gps_immobilizer_status (
         device_id, hardware_supported, relay_installed, installation_verified_at, installation_verified_by,
         service_enabled, starter_circuit_verified, starter_circuit_verified_at, starter_circuit_verified_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $6, CASE WHEN $6 THEN NOW() ELSE NULL END, CASE WHEN $6 THEN $7 ELSE NULL END)
       ON CONFLICT (device_id) DO UPDATE
       SET hardware_supported = EXCLUDED.hardware_supported,
           relay_installed = EXCLUDED.relay_installed,
           installation_verified_at = EXCLUDED.installation_verified_at,
           installation_verified_by = EXCLUDED.installation_verified_by,
           service_enabled = EXCLUDED.service_enabled,
           starter_circuit_verified = EXCLUDED.service_enabled,
           starter_circuit_verified_at = CASE
             WHEN EXCLUDED.service_enabled THEN COALESCE(gps_immobilizer_status.starter_circuit_verified_at, EXCLUDED.starter_circuit_verified_at)
             ELSE NULL
           END,
           starter_circuit_verified_by = CASE
             WHEN EXCLUDED.service_enabled THEN COALESCE(gps_immobilizer_status.starter_circuit_verified_by, EXCLUDED.starter_circuit_verified_by)
             ELSE NULL
           END,
           updated_at = NOW()`,
      [input.deviceId, next.hardwareSupported, next.relayInstalled, verifiedAt, verifiedBy, next.serviceEnabled, input.actorLabel],
    );
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordStarterCircuitVerification(input: {
  deviceId: string;
  actorLabel: string;
  verified: boolean;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ service_enabled: boolean | null }>(
      `SELECT block.service_enabled
       FROM gps_devices device
       LEFT JOIN gps_immobilizer_status block ON block.device_id = device.id
       WHERE device.id = $1
         AND device.receiver = 'teltonika'
         AND device.status = 'active'
       FOR UPDATE OF device`,
      [input.deviceId],
    );
    if (!locked.rows[0] || locked.rows[0].service_enabled !== true) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "not_ready" as const };
    }
    const actor = input.actorLabel.slice(0, 120);
    await client.query(
      `UPDATE gps_immobilizer_status
       SET starter_circuit_verified = $2,
           starter_circuit_verified_at = CASE WHEN $2 THEN COALESCE(starter_circuit_verified_at, NOW()) ELSE NULL END,
           starter_circuit_verified_by = CASE WHEN $2 THEN COALESCE(starter_circuit_verified_by, $3) ELSE NULL END,
           updated_at = NOW()
       WHERE device_id = $1
         AND service_enabled`,
      [input.deviceId, input.verified, actor],
    );
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function claimStarterCommand(imei: string) {
  const result = await getPool().query<{ id: string; command_text: string }>(
    `UPDATE gps_immobilizer_commands AS command
     SET phase = 'sent'
     WHERE command.id = (
       SELECT queued.id
       FROM gps_immobilizer_commands queued
       JOIN gps_devices device ON device.id = queued.device_id
       WHERE device.imei = $1
         AND device.receiver = 'teltonika'
         AND device.status = 'active'
         AND queued.phase = 'queued'
       ORDER BY queued.created_at DESC
       LIMIT 1
     )
     RETURNING command.id, command.command_text`,
    [imei],
  );
  return result.rows[0] ?? null;
}

export async function finishStarterCommand(commandId: string, responseText: string) {
  const reply = immobilizerReplyPhase(responseText);
  const phase = reply.phase === "acknowledged" ? "acknowledged" : reply.phase === "rejected" ? "rejected" : reply.phase === "queued" ? "queued" : "sent";
  await getPool().query(
    `UPDATE gps_immobilizer_commands
     SET phase = $2, response_text = $3
     WHERE id = $1
       AND phase = 'sent'`,
    [commandId, phase, responseText.slice(0, 500)],
  );
  if (phase !== "acknowledged" || reply.output === "unknown") return;
  await getPool().query(
    `UPDATE gps_immobilizer_status AS block
     SET output_state = $2,
         output_observed_at = NOW(),
         updated_at = NOW()
     FROM gps_immobilizer_commands command
     WHERE command.id = $1
       AND block.device_id = command.device_id`,
    [commandId, reply.output],
  );
}

export async function timeoutStarterCommand(commandId: string) {
  await getPool().query(
    `UPDATE gps_immobilizer_commands
     SET phase = 'timeout'
     WHERE id = $1
       AND phase = 'sent'
       AND command_text NOT LIKE 'setigndigout%'`,
    [commandId],
  );
}

function panelFrom(row: DeviceRow, now: Date): ImmobilizerPanel {
  const commandAgeMs = row.command_at ? now.getTime() - row.command_at.getTime() : null;
  const phase = immobilizerDisplayedPhase(row.phase ?? "none", commandAgeMs);
  const output = row.output_state ?? "unknown";
  const commandAt = row.command_at ? row.command_at.toISOString() : null;
  const lastHeartbeatAt = row.last_heartbeat_at ? row.last_heartbeat_at.toISOString() : null;
  const hardwareSupported = row.hardware_supported === true;
  const relayInstalled = row.relay_installed === true;
  const serviceEnabled = row.service_enabled === true;
  const installationVerified = row.installation_verified_at !== null && row.installation_verified_at !== undefined;
  return {
    deviceId: row.id,
    request: row.request ?? "off",
    output,
    outputObservedAt: row.output_observed_at ? row.output_observed_at.toISOString() : null,
    phase,
    commandAt,
    commandText: row.command_text,
    responseText: row.response_text,
    lastHeartbeatAt,
    ignition: ignitionState(row.din1_state),
    hardwareSupported,
    relayInstalled,
    installationVerifiedAt: row.installation_verified_at ? row.installation_verified_at.toISOString() : null,
    installationVerifiedBy: row.installation_verified_by,
    serviceEnabled,
    starterCircuitVerified: row.starter_circuit_verified === true,
    starterCircuitVerifiedAt: row.starter_circuit_verified_at ? row.starter_circuit_verified_at.toISOString() : null,
    starterCircuitVerifiedBy: row.starter_circuit_verified_by,
    readiness: immobilizerReadiness({
      hardwareSupported,
      relayInstalled,
      installationVerified,
      serviceEnabled,
    }),
    view: immobilizerView({
      presence: gpsPresence(lastHeartbeatAt, now),
      output,
      phase,
      commandAgeMs,
    }),
  };
}

function ignitionState(value: string | null): ImmobilizerIgnition {
  if (value === "on" || value === "off") return value;
  return null;
}

function speedMps(value: string | number | null) {
  if (value === null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function postgresCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}
