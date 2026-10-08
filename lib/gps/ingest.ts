import "server-only";

import { type PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";
import { chooseLivePoint } from "@/lib/gps/backfill";
import {
  GPS_BATTERY_UNCHANGED,
  GPS_COMMAND_RETRY_MS,
  GPS_LOW_BATTERY_UNCHANGED,
  type GpsDeviceBattery,
  type GpsHeartbeat,
  type GpsLowBatteryReport,
  type GpsPoint,
  type GpsPointError,
} from "@/lib/gps/contract";

export type GpsLowBatteryAlert = {
  deviceId: string;
  partnerId: string;
  deviceCode: string;
  plate: string | null;
  batteryPercent: number | null;
  episodeAt: string;
};

type IngestOk = {
  http: 200;
  accepted: number[];
  duplicate: number[];
  rejected: { seq: number; error: GpsPointError }[];
  ackedThrough: number;
  liveAdvanced: boolean;
};

type IngestDenied = {
  http: 403 | 409;
  error: "disabled" | "unassigned";
};

export async function ingestTelemetry(
  deviceId: string,
  points: GpsPoint[],
  rejected: { seq: number; error: GpsPointError }[],
  battery: GpsDeviceBattery = GPS_BATTERY_UNCHANGED,
): Promise<IngestOk | IngestDenied> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      partner_id: string;
      vehicle_id: string | null;
      status: string;
    }>(
      `SELECT id, partner_id, vehicle_id, status
       FROM gps_devices
       WHERE id = $1
       FOR UPDATE`,
      [deviceId],
    );
    const device = locked.rows[0];
    if (!device || device.status !== "active") {
      await client.query("ROLLBACK");
      return { http: 403, error: "disabled" };
    }
    if (!device.vehicle_id && points.length > 0) {
      await client.query("ROLLBACK");
      return { http: 409, error: "unassigned" };
    }
    const accepted: number[] = [];
    const acceptedPoints: GpsPoint[] = [];
    const duplicate: number[] = [];
    const known = new Set<number>();
    if (points.length > 0 && device.vehicle_id) {
      const existing = await client.query<{ seq: string }>(
        `SELECT seq::text AS seq
         FROM gps_positions
         WHERE device_id = $1
           AND seq = ANY($2::bigint[])`,
        [device.id, points.map((point) => point.seq)],
      );
      for (const row of existing.rows) {
        known.add(Number(row.seq));
      }
      for (const point of points) {
        if (known.has(point.seq)) {
          duplicate.push(point.seq);
          continue;
        }
        const inserted = await client.query(
          `INSERT INTO gps_positions (
             device_id, partner_id, vehicle_id, seq, recorded_at,
             latitude, longitude, altitude_m, speed_mps, heading_deg,
             satellites, hdop, pdop, vdop, fix_mode
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15
           )
           ON CONFLICT (device_id, seq) DO NOTHING`,
          [
            device.id,
            device.partner_id,
            device.vehicle_id,
            point.seq,
            point.gnssTime.toISOString(),
            point.lat,
            point.lon,
            point.altitudeM,
            point.speedMps,
            point.headingDeg,
            point.satellites,
            point.hdop,
            point.pdop,
            point.vdop,
            point.fixMode,
          ],
        );
        if ((inserted.rowCount ?? 0) === 0) {
          duplicate.push(point.seq);
          known.add(point.seq);
          continue;
        }
        known.add(point.seq);
        accepted.push(point.seq);
        acceptedPoints.push(point);
      }
    }
    const newest = chooseLivePoint(acceptedPoints);
    const cursorRow = await client.query<{ last_contiguous_seq: string }>(
      `SELECT last_contiguous_seq::text AS last_contiguous_seq
       FROM gps_device_status
       WHERE device_id = $1
       FOR UPDATE`,
      [device.id],
    );
    let cursor = Number(cursorRow.rows[0]?.last_contiguous_seq ?? 0);
    for (let step = 0; step < 2000; step += 1) {
      const next = cursor + 1;
      if (!known.has(next)) {
        const found = await client.query(
          `SELECT 1 FROM gps_positions WHERE device_id = $1 AND seq = $2`,
          [device.id, next],
        );
        if ((found.rowCount ?? 0) === 0) {
          break;
        }
      }
      cursor = next;
      known.add(next);
    }
    await client.query(
      `UPDATE gps_device_status
       SET last_seen_at = NOW(),
           last_contiguous_seq = $2,
           updated_at = NOW()
       WHERE device_id = $1`,
      [device.id, cursor],
    );
    await writeDeviceBattery(client, device.id, battery);
    let liveAdvanced = false;
    if (newest) {
      const advanced = await client.query(
        `UPDATE gps_device_status
         SET latitude = $2,
             longitude = $3,
             speed_mps = $4,
             heading_deg = $5,
             altitude_m = $6,
             satellites = $7,
             hdop = $8,
             pdop = $9,
             vdop = $10,
             fix_mode = $11,
             gnss_fix = TRUE,
             recorded_at = $12
         WHERE device_id = $1
           AND (recorded_at IS NULL OR recorded_at <= $12)`,
        [
          device.id,
          newest.lat,
          newest.lon,
          newest.speedMps,
          newest.headingDeg,
          newest.altitudeM,
          newest.satellites,
          newest.hdop,
          newest.pdop,
          newest.vdop,
          newest.fixMode,
          newest.gnssTime.toISOString(),
        ],
      );
      liveAdvanced = (advanced.rowCount ?? 0) > 0;
    }
    await client.query("COMMIT");
    return { http: 200, accepted, duplicate, rejected, ackedThrough: cursor, liveAdvanced };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ingestHeartbeat(deviceId: string, heartbeat: GpsHeartbeat) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ status: string }>(
      `SELECT status FROM gps_devices WHERE id = $1 FOR UPDATE`,
      [deviceId],
    );
    if (locked.rows[0]?.status !== "active") {
      await client.query("ROLLBACK");
      return { http: 403 as const, error: "disabled" as const };
    }
    const assignments: string[] = [
      "last_seen_at = NOW()",
      "last_heartbeat_at = NOW()",
      "updated_at = NOW()",
    ];
    const values: unknown[] = [deviceId];
    const assign = (column: string, value: unknown) => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };
    if (heartbeat.firmware !== null) assign("firmware", heartbeat.firmware);
    if (heartbeat.rssi !== null) assign("rssi", heartbeat.rssi);
    if (heartbeat.network !== null) assign("network", heartbeat.network);
    if (heartbeat.operatorName !== null) assign("operator_name", heartbeat.operatorName);
    if (heartbeat.wifiEnabled !== null) assign("wifi_enabled", heartbeat.wifiEnabled);
    if (heartbeat.wifiSsid !== null) assign("wifi_ssid", heartbeat.wifiSsid);
    if (heartbeat.wifiClients !== null) assign("wifi_clients", heartbeat.wifiClients);
    if (heartbeat.gnssFix !== null) assign("gnss_fix", heartbeat.gnssFix);
    if (heartbeat.uptimeSeconds !== null) assign("uptime_seconds", heartbeat.uptimeSeconds);
    if (heartbeat.simStatus !== null) assign("sim_status", heartbeat.simStatus);
    if (heartbeat.lteRegistration !== null) assign("lte_registration", heartbeat.lteRegistration);
    if (heartbeat.pppStatus !== null) assign("ppp_status", heartbeat.pppStatus);
    if (heartbeat.naptStatus !== null) assign("napt_status", heartbeat.naptStatus);
    if (heartbeat.ipAddress !== null) assign("ip_address", heartbeat.ipAddress);
    if (heartbeat.gnssResponse !== null) assign("gnss_response", heartbeat.gnssResponse);
    if (heartbeat.wifiPolicy !== null) assign("wifi_policy", heartbeat.wifiPolicy);
    if (heartbeat.apStatus !== null) assign("ap_status", heartbeat.apStatus);
    if (heartbeat.reportedMaxClients !== null) assign("reported_max_clients", heartbeat.reportedMaxClients);
    if (heartbeat.lastRecoveryReason !== null) assign("last_recovery_reason", heartbeat.lastRecoveryReason);
    if (heartbeat.lastModemRecoveryAt !== null) assign("last_modem_recovery_at", heartbeat.lastModemRecoveryAt);
    if (heartbeat.lastGnssRecoveryAt !== null) assign("last_gnss_recovery_at", heartbeat.lastGnssRecoveryAt);
    if (heartbeat.resetReason !== null) assign("reset_reason", heartbeat.resetReason);
    if (heartbeat.powerSource !== null) assign("power_source", heartbeat.powerSource);
    if (heartbeat.vehicleBatteryVoltage !== null) assign("vehicle_battery_voltage", heartbeat.vehicleBatteryVoltage);
    if (heartbeat.accState !== null) assign("acc_state", heartbeat.accState);
    if (heartbeat.powerMode !== null) assign("power_mode", heartbeat.powerMode);
    if (heartbeat.cameraAvailable !== null) assign("camera_available", heartbeat.cameraAvailable);
    if (heartbeat.cameraReady !== null) assign("camera_ready", heartbeat.cameraReady);
    appendBatteryAssignments(assignments, values, heartbeat.battery);
    const lowBattery = heartbeat.lowBattery ?? GPS_LOW_BATTERY_UNCHANGED;
    const claimGrace = await appendLowBatteryAssignments(client, deviceId, assignments, values, lowBattery);
    await client.query(
      `UPDATE gps_device_status SET ${assignments.join(", ")} WHERE device_id = $1`,
      values,
    );
    const lowBatteryAlert = claimGrace ? await claimLowBatteryPush(client, deviceId) : null;
    const status = await client.query<{ last_contiguous_seq: string; commands_waiting: string }>(
      `SELECT
         status.last_contiguous_seq::text AS last_contiguous_seq,
         (
           SELECT COUNT(*)::text
           FROM gps_commands command
           WHERE command.device_id = status.device_id
             AND (
               command.status = 'queued'
               OR (
                 command.status = 'delivered'
                 AND command.delivered_at > NOW() - ($2::int * INTERVAL '1 second')
               )
             )
         ) AS commands_waiting
       FROM gps_device_status status
       WHERE status.device_id = $1`,
      [deviceId, Math.round(GPS_COMMAND_RETRY_MS / 1000)],
    );
    await client.query("COMMIT");
    return {
      http: 200 as const,
      ackedThrough: Number(status.rows[0]?.last_contiguous_seq ?? 0),
      commandsWaiting: Number(status.rows[0]?.commands_waiting ?? 0),
      lowBatteryAlert,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function writeDeviceBattery(client: PoolClient, deviceId: string, battery: GpsDeviceBattery) {
  const assignments: string[] = [];
  const values: unknown[] = [deviceId];
  appendBatteryAssignments(assignments, values, battery);
  if (assignments.length === 0) return;
  await client.query(
    `UPDATE gps_device_status SET ${assignments.join(", ")} WHERE device_id = $1`,
    values,
  );
}

async function appendLowBatteryAssignments(
  client: PoolClient,
  deviceId: string,
  assignments: string[],
  values: unknown[],
  lowBattery: GpsLowBatteryReport,
) {
  if (lowBattery.state.kind !== "set") return false;
  const previous = await client.query<{ low_battery_state: string | null }>(
    `SELECT low_battery_state FROM gps_device_status WHERE device_id = $1`,
    [deviceId],
  );
  const previousState = previous.rows[0]?.low_battery_state ?? null;
  values.push(lowBattery.state.value);
  assignments.push(`low_battery_state = $${values.length}`);
  if (lowBattery.remaining.kind === "set") {
    values.push(lowBattery.remaining.value);
    assignments.push(`low_battery_grace_remaining_seconds = $${values.length}`);
  } else if (lowBattery.remaining.kind === "clear") {
    assignments.push("low_battery_grace_remaining_seconds = NULL");
  }
  if (lowBattery.state.value === "grace" && previousState !== "grace") {
    assignments.push("low_battery_episode_at = clock_timestamp()");
  }
  return lowBattery.state.value === "grace";
}

async function claimLowBatteryPush(client: PoolClient, deviceId: string): Promise<GpsLowBatteryAlert | null> {
  const info = await client.query<{
    device_code: string;
    partner_id: string | null;
    plate: string | null;
    battery_percent: number | null;
    episode_at: Date | null;
  }>(
    `SELECT device.device_code,
            device.partner_id,
            vehicle.plate,
            status.battery_percent,
            status.low_battery_episode_at AS episode_at
     FROM gps_devices device
     LEFT JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
     JOIN gps_device_status status ON status.device_id = device.id
     WHERE device.id = $1`,
    [deviceId],
  );
  const row = info.rows[0];
  if (!row?.partner_id || !row.episode_at) return null;
  const claimed = await client.query(
    `INSERT INTO gps_low_battery_pushes (device_id, episode_at)
     VALUES ($1, $2)
     ON CONFLICT (device_id, episode_at) DO NOTHING
     RETURNING device_id`,
    [deviceId, row.episode_at],
  );
  if ((claimed.rowCount ?? 0) === 0) return null;
  return {
    deviceId,
    partnerId: row.partner_id,
    deviceCode: row.device_code,
    plate: row.plate,
    batteryPercent: row.battery_percent,
    episodeAt: row.episode_at.toISOString(),
  };
}

function appendBatteryAssignments(assignments: string[], values: unknown[], battery: GpsDeviceBattery) {
  const assign = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };
  if (battery.percent.kind === "set") {
    assign("battery_percent", battery.percent.value);
    assignments.push("battery_measured_at = NOW()");
  } else if (battery.percent.kind === "clear") {
    assignments.push("battery_percent = NULL");
    assignments.push("battery_measured_at = NULL");
  }
  if (battery.voltage.kind === "set") assign("battery_voltage", battery.voltage.value);
  else if (battery.voltage.kind === "clear") assignments.push("battery_voltage = NULL");
  if (battery.chargingInferred.kind === "set") assign("charging_inferred", battery.chargingInferred.value);
  else if (battery.chargingInferred.kind === "clear") assignments.push("charging_inferred = NULL");
}

export async function pollDeviceCommands(deviceId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE gps_commands
       SET status = 'expired',
           error = 'timeout',
           finished_at = NOW(),
           payload = payload - 'password'
       WHERE device_id = $1
         AND status = 'delivered'
         AND delivered_at <= NOW() - ($2::int * INTERVAL '1 second')`,
      [deviceId, Math.round(GPS_COMMAND_RETRY_MS / 1000)],
    );
    const selected = await client.query<{ id: string; kind: string; payload: Record<string, unknown> }>(
      `SELECT id, kind, payload
       FROM gps_commands
       WHERE device_id = $1
         AND (
           status = 'queued'
           OR (
             status = 'delivered'
             AND delivered_at > NOW() - ($2::int * INTERVAL '1 second')
           )
         )
       ORDER BY created_at
       LIMIT 5
       FOR UPDATE`,
      [deviceId, Math.round(GPS_COMMAND_RETRY_MS / 1000)],
    );
    const ids = selected.rows.map((row) => row.id);
    if (ids.length > 0) {
      await client.query(
        `UPDATE gps_commands
         SET status = 'delivered',
             delivered_at = COALESCE(delivered_at, NOW())
         WHERE id = ANY($1::uuid[])
           AND status = 'queued'`,
        [ids],
      );
    }
    await client.query("COMMIT");
    return selected.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      payload: row.payload,
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function applyAckedWifi(
  client: PoolClient,
  deviceId: string,
  kind: string,
  payload: Record<string, unknown>,
  hadPassword: boolean,
) {
  const ssid = typeof payload.ssid === "string" ? payload.ssid : null;
  const maxClients = typeof payload.max_clients === "number" ? payload.max_clients : null;
  if (kind === "wifi_on" || kind === "wifi.configure") {
    await client.query(
      `UPDATE gps_devices SET wifi_mode = 'on', wifi_enabled = TRUE, updated_at = NOW() WHERE id = $1`,
      [deviceId],
    );
  }
  if (kind === "wifi_off" || kind === "wifi.disable") {
    await client.query(
      `UPDATE gps_devices SET wifi_mode = 'off', wifi_enabled = FALSE, updated_at = NOW() WHERE id = $1`,
      [deviceId],
    );
  }
  if (kind === "wifi_auto") {
    await client.query(
      `UPDATE gps_devices SET wifi_mode = 'auto', wifi_enabled = TRUE, updated_at = NOW() WHERE id = $1`,
      [deviceId],
    );
  }
  if ((kind === "set_ssid" || kind === "wifi.configure") && ssid) {
    await client.query(
      `UPDATE gps_devices SET wifi_ssid = $2, updated_at = NOW() WHERE id = $1`,
      [deviceId, ssid],
    );
  }
  if ((kind === "set_password" || kind === "wifi.configure" || kind === "wifi_config") && hadPassword) {
    await client.query(
      `UPDATE gps_devices SET wifi_password_set = TRUE, updated_at = NOW() WHERE id = $1`,
      [deviceId],
    );
  }
  if (kind === "wifi_config" && (payload.mode === "on" || payload.mode === "off" || payload.mode === "auto")) {
    await client.query(
      `UPDATE gps_devices
       SET wifi_mode = $2,
           wifi_enabled = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [deviceId, payload.mode, payload.mode !== "off"],
    );
  }
  if (kind === "wifi_config" && ssid) {
    await client.query(
      `UPDATE gps_devices SET wifi_ssid = $2, updated_at = NOW() WHERE id = $1`,
      [deviceId, ssid],
    );
  }
  if ((kind === "set_max_wifi_clients" || kind === "wifi_config") && maxClients !== null) {
    await client.query(
      `UPDATE gps_devices SET wifi_max_clients = $2, updated_at = NOW() WHERE id = $1`,
      [deviceId, maxClients],
    );
  }
}

export async function ackDeviceCommand(
  deviceId: string,
  commandId: string,
  result: { ok: boolean; error: string | null; detail: Record<string, unknown> | null },
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ kind: string; payload: Record<string, unknown>; status: string }>(
      `SELECT kind, payload, status
       FROM gps_commands
       WHERE id = $1
         AND device_id = $2
         AND status IN ('queued', 'delivered')
       FOR UPDATE`,
      [commandId, deviceId],
    );
    const command = current.rows[0];
    if (!command) {
      await client.query("ROLLBACK");
      return { http: 404 as const, error: "not_found" as const };
    }
    const payload = command.payload ?? {};
    const hadPassword = typeof payload.password === "string" && payload.password.length > 0;
    if (result.detail && Object.prototype.hasOwnProperty.call(result.detail, "password")) {
      delete result.detail.password;
    }
    await client.query(
      `UPDATE gps_commands
       SET status = $3,
           error = $4,
           result = $5::jsonb,
           finished_at = NOW(),
           payload = payload - 'password'
       WHERE id = $1
         AND device_id = $2`,
      [
        commandId,
        deviceId,
        result.ok ? "acked" : "failed",
        result.ok ? null : (result.error ?? "failed"),
        JSON.stringify(result.detail ?? {}),
      ],
    );
    if (result.ok) {
      await applyAckedWifi(client, deviceId, command.kind, payload, hadPassword);
    }
    await client.query("COMMIT");
    return { http: 200 as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
