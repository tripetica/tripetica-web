import { getPool } from "@/lib/db/postgres";
import { gpsPresence } from "@/lib/gps/presence";
import {
  immobilizerDuplicate,
  immobilizerView,
  planImmobilizerCommand,
  trackerModel,
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
  request: ImmobilizerRequest | null;
  output_state: ImmobilizerOutput | null;
  phase: ImmobilizerPhase | null;
  command_at: Date | null;
  last_heartbeat_at: Date | null;
};

export async function loadImmobilizerPanel(vehicleId: string, partnerScope: string | null, now = new Date()): Promise<ImmobilizerPanel | null> {
  const result = await getPool().query<DeviceRow>(
    `SELECT device.id,
            device.receiver,
            device.partner_id,
            device.vehicle_id,
            device.tracker_model,
            status.speed_mps,
            block.request,
            block.output_state,
            command.phase,
            command.created_at AS command_at,
            status.last_heartbeat_at
     FROM gps_devices device
     LEFT JOIN gps_device_status status ON status.device_id = device.id
     LEFT JOIN gps_immobilizer_status block ON block.device_id = device.id
     LEFT JOIN LATERAL (
       SELECT phase, created_at
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

export async function recordImmobilizerRequest(input: {
  deviceId: string;
  partnerScope: string | null;
  actorLabel: string;
  surface: "ops" | "partner";
  request: ImmobilizerRequest;
  confirmed: boolean;
  env?: Record<string, string | undefined>;
  now?: Date;
}): Promise<{ ok: true; panel: ImmobilizerPanel } | { ok: false; error: "forbidden" | "duplicate" | "confirm" }> {
  if (input.request === "on" && !input.confirmed) return { ok: false, error: "confirm" };
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
              block.request,
              block.output_state,
              NULL::text AS phase,
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
    await client.query(
      `INSERT INTO gps_immobilizer_status (device_id, request)
       VALUES ($1, $2)
       ON CONFLICT (device_id) DO UPDATE
       SET request = EXCLUDED.request,
           updated_at = NOW()`,
      [device.id, input.request],
    );
    await client.query("COMMIT");
    return {
      ok: true,
      panel: panelFrom({
        ...device,
        request: input.request,
        phase: plan.phase,
        command_at: now,
      }, now),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (postgresCode(error) === "23505") return { ok: false, error: "duplicate" };
    throw error;
  } finally {
    client.release();
  }
}

function panelFrom(row: DeviceRow, now: Date): ImmobilizerPanel {
  const phase = row.phase ?? "none";
  const output = row.output_state ?? "unknown";
  const commandAt = row.command_at ? row.command_at.toISOString() : null;
  const lastHeartbeatAt = row.last_heartbeat_at ? row.last_heartbeat_at.toISOString() : null;
  return {
    deviceId: row.id,
    request: row.request ?? "off",
    output,
    phase,
    commandAt,
    lastHeartbeatAt,
    view: immobilizerView({
      presence: gpsPresence(lastHeartbeatAt, now),
      output,
      phase,
      commandAgeMs: row.command_at ? now.getTime() - row.command_at.getTime() : null,
    }),
  };
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
