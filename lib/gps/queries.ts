import "server-only";

import { randomBytes } from "node:crypto";
import { getPool, query } from "@/lib/db/postgres";
import { GPS_DEVICE_CODE_PATTERN, routeSampleStep } from "@/lib/gps/contract";
import { type GpsLiveSnapshot, type GpsRecentFix } from "@/lib/gps/live";
import { gpsLiveSourceAfterAssignment, type GpsRegistrationProfile } from "@/lib/gps/registration";

export type GpsDeviceListItem = {
  id: string;
  deviceCode: string;
  label: string;
  imei: string;
  status: "active" | "disabled";
  partnerId: string | null;
  partnerName: string;
  partnerCode: string;
  createdAt: string;
  vehicleId: string | null;
  plate: string | null;
  uetdsCompany: string | null;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  latitude: number | null;
  longitude: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  recordedAt: string | null;
  gnssFix: boolean | null;
  satellites: number | null;
  hdop: number | null;
  rssi: number | null;
  network: string | null;
  operatorName: string | null;
  firmware: string | null;
  ackedThrough: number;
  accState: string | null;
  din1State: "on" | "off" | null;
  manufacturer: "teltonika";
  trackerModel: "fmb920" | "fmc920";
  linkTechnology: "2g" | "4g";
  installationStatus: "pending" | "installed";
  liveSource: boolean;
  serialNumber: string | null;
  simPhone: string | null;
  simOperator: string | null;
  simApn: string | null;
};

export type GpsRoutePoint = {
  seq: number;
  recordedAt: string;
  receivedAt: string;
  latitude: number;
  longitude: number;
  speedMps: number | null;
  headingDeg: number | null;
  satellites: number | null;
  hdop: number | null;
  fixMode: string | null;
  plate: string | null;
};

type DeviceSqlRow = {
  id: string;
  device_code: string;
  label: string;
  imei: string;
  status: "active" | "disabled";
  partner_id: string | null;
  partner_name: string | null;
  partner_code: string | null;
  created_at: Date;
  vehicle_id: string | null;
  plate: string | null;
  uetds_company: string | null;
  last_seen_at: Date | null;
  last_heartbeat_at: Date | null;
  latitude: string | null;
  longitude: string | null;
  speed_mps: string | null;
  heading_deg: string | null;
  recorded_at: Date | null;
  gnss_fix: boolean | null;
  satellites: number | null;
  hdop: string | null;
  rssi: number | null;
  network: string | null;
  operator_name: string | null;
  firmware: string | null;
  last_contiguous_seq: string;
  acc_state: string | null;
  din1_state: string | null;
  manufacturer: "teltonika";
  tracker_model: "fmb920" | "fmc920";
  link_technology: "2g" | "4g";
  installation_status: "pending" | "installed";
  live_source: boolean;
  serial_number: string | null;
  sim_phone: string | null;
  sim_operator: string | null;
  sim_apn: string | null;
};

const DEVICE_SELECT = `
  SELECT
    device.id,
    device.device_code,
    device.label,
    device.imei,
    device.status,
    device.created_at,
    device.partner_id,
    partner.name AS partner_name,
    partner.partner_code,
    device.vehicle_id,
    vehicle.plate,
    company.short_name AS uetds_company,
    status.last_seen_at,
    status.last_heartbeat_at,
    status.latitude::text AS latitude,
    status.longitude::text AS longitude,
    status.speed_mps::text AS speed_mps,
    status.heading_deg::text AS heading_deg,
    status.recorded_at,
    status.gnss_fix,
    status.satellites,
    status.hdop::text AS hdop,
    status.rssi,
    status.network,
    status.operator_name,
    status.firmware,
    status.last_contiguous_seq::text AS last_contiguous_seq,
    status.acc_state,
    status.din1_state,
    device.manufacturer,
    device.tracker_model,
    device.link_technology,
    device.installation_status,
    device.live_source,
    device.serial_number,
    device.sim_phone,
    device.sim_operator,
    device.sim_apn
  FROM gps_devices device
  LEFT JOIN partners partner ON partner.id = device.partner_id
  LEFT JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
  LEFT JOIN uetds_companies company ON company.id = vehicle.uetds_company_id
  LEFT JOIN gps_device_status status ON status.device_id = device.id
`;

function mapDevice(row: DeviceSqlRow): GpsDeviceListItem {
  return {
    id: row.id,
    deviceCode: row.device_code,
    label: row.label,
    imei: row.imei,
    status: row.status,
    partnerId: row.partner_id,
    partnerName: row.partner_name ?? "",
    partnerCode: row.partner_code ?? "",
    createdAt: row.created_at.toISOString(),
    vehicleId: row.vehicle_id,
    plate: row.plate,
    uetdsCompany: row.uetds_company,
    lastSeenAt: iso(row.last_seen_at),
    lastHeartbeatAt: iso(row.last_heartbeat_at),
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    speedMps: numberOrNull(row.speed_mps),
    headingDeg: numberOrNull(row.heading_deg),
    recordedAt: iso(row.recorded_at),
    gnssFix: row.gnss_fix,
    satellites: row.satellites,
    hdop: numberOrNull(row.hdop),
    rssi: row.rssi,
    network: row.network,
    operatorName: row.operator_name,
    firmware: row.firmware,
    ackedThrough: Number(row.last_contiguous_seq ?? 0),
    accState: row.acc_state,
    din1State: row.din1_state === "on" || row.din1_state === "off" ? row.din1_state : null,
    manufacturer: row.manufacturer,
    trackerModel: row.tracker_model,
    linkTechnology: row.link_technology,
    installationStatus: row.installation_status,
    liveSource: row.live_source,
    serialNumber: row.serial_number,
    simPhone: row.sim_phone,
    simOperator: row.sim_operator,
    simApn: row.sim_apn,
  };
}

export async function listGpsDevices(partnerId: string | null) {
  const result = partnerId
    ? await query<DeviceSqlRow>(
        `${DEVICE_SELECT} WHERE partner_can_access_gps_device($1, device.id) AND device.receiver = 'teltonika' AND device.deleted_at IS NULL ORDER BY vehicle.plate NULLS LAST, device.device_code`,
        [partnerId],
      )
    : await query<DeviceSqlRow>(
        `${DEVICE_SELECT} WHERE device.receiver = 'teltonika' AND device.deleted_at IS NULL ORDER BY partner.name NULLS LAST, vehicle.plate NULLS LAST, device.device_code`,
      );
  return result.rows.map(mapDevice);
}

export async function listFleetDefaultDrivers(partnerId: string) {
  const result = await query<{ vehicle_id: string; driver_name: string }>(
    `SELECT defaults.vehicle_id,
            string_agg(
              trim(driver.first_name || ' ' || driver.last_name),
              ', ' ORDER BY defaults.created_at, driver.last_name, driver.id
            ) AS driver_name
       FROM partner_fleet_defaults defaults
       JOIN partner_drivers driver ON driver.id = defaults.driver_id
      WHERE partner_can_access_vehicle($1, defaults.vehicle_id)
        AND driver.deleted_at IS NULL
      GROUP BY defaults.vehicle_id`,
    [partnerId],
  );
  return new Map(result.rows.map((row) => [row.vehicle_id, row.driver_name]));
}

export async function getGpsLive(deviceId: string, partnerId: string | null): Promise<GpsLiveSnapshot | null> {
  const result = await query<{
    seq: string | null;
    recorded_at: Date | null;
    latitude: string | null;
    longitude: string | null;
    speed_mps: string | null;
    heading_deg: string | null;
    satellites: number | null;
    gnss_fix: boolean | null;
    last_heartbeat_at: Date | null;
    firmware: string | null;
    rssi: number | null;
    operator_name: string | null;
    network: string | null;
    acc_state: string | null;
    din1_state: string | null;
  }>(
    `SELECT status.last_contiguous_seq::text AS seq,
            status.recorded_at,
            status.latitude::text AS latitude,
            status.longitude::text AS longitude,
            status.speed_mps::text AS speed_mps,
            status.heading_deg::text AS heading_deg,
            status.satellites,
            status.gnss_fix,
            status.last_heartbeat_at,
            status.firmware,
            status.rssi,
            status.operator_name,
            status.network,
            status.acc_state,
            status.din1_state
       FROM gps_devices device
       LEFT JOIN gps_device_status status ON status.device_id = device.id
      WHERE device.id = $1
        AND device.receiver = 'teltonika'
        AND device.deleted_at IS NULL
        AND ($2::uuid IS NULL OR partner_can_access_gps_device($2, device.id))
      LIMIT 1`,
    [deviceId, partnerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    seq: Number(row.seq ?? 0),
    recordedAt: iso(row.recorded_at),
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    speedMps: numberOrNull(row.speed_mps),
    headingDeg: numberOrNull(row.heading_deg),
    satellites: row.satellites,
    gnssFix: row.gnss_fix,
    lastHeartbeatAt: iso(row.last_heartbeat_at),
    firmware: row.firmware,
    rssi: row.rssi,
    operatorName: row.operator_name,
    network: row.network,
    accState: row.acc_state,
    din1State: row.din1_state === "on" || row.din1_state === "off" ? row.din1_state : null,
    manufacturer: "teltonika",
    recent: (await listGpsRecentFixes([deviceId])).get(deviceId) ?? [],
  };
}

export async function listGpsRecentFixes(deviceIds: string[]) {
  const grouped = new Map<string, GpsRecentFix[]>();
  const ids = [...new Set(deviceIds.filter((id) => id.length > 0))];
  for (const id of ids) grouped.set(id, []);
  if (ids.length === 0) return grouped;
  const result = await query<{
    device_id: string;
    recorded_at: Date;
    latitude: string;
    longitude: string;
    speed_mps: string | null;
  }>(
    `SELECT device_id::text AS device_id, recorded_at,
            latitude::text AS latitude, longitude::text AS longitude,
            speed_mps::text AS speed_mps
       FROM gps_positions
      WHERE device_id = ANY($1::uuid[])
        AND recorded_at >= NOW() - INTERVAL '20 minutes'
      ORDER BY recorded_at ASC
      LIMIT 4000`,
    [ids],
  );
  for (const row of result.rows) {
    const bucket = grouped.get(row.device_id);
    if (!bucket || bucket.length >= 500) continue;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const speed = row.speed_mps === null ? null : Number(row.speed_mps);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    bucket.push({
      at: row.recorded_at.getTime(),
      latitude,
      longitude,
      speedMps: speed !== null && Number.isFinite(speed) ? speed : null,
    });
  }
  return grouped;
}

export async function getGpsDevice(deviceId: string, partnerId: string | null) {
  const result = partnerId
    ? await query<DeviceSqlRow>(
        `${DEVICE_SELECT} WHERE device.id = $1 AND partner_can_access_gps_device($2, device.id) AND device.receiver = 'teltonika' AND device.deleted_at IS NULL LIMIT 1`,
        [deviceId, partnerId],
      )
    : await query<DeviceSqlRow>(
        `${DEVICE_SELECT} WHERE device.id = $1 AND device.receiver = 'teltonika' AND device.deleted_at IS NULL LIMIT 1`,
        [deviceId],
      );
  return result.rows[0] ? mapDevice(result.rows[0]) : null;
}

export async function listGpsRoute(input: {
  deviceId: string;
  partnerId: string | null;
  vehicleId: string | null;
  accessPartnerId: string | null;
  from: Date;
  to: Date;
}) {
  const assigned = Boolean(input.partnerId && input.vehicleId);
  if (input.accessPartnerId) {
    const allowed = await query<{ allowed: boolean }>(
      assigned
        ? `SELECT partner_can_access_vehicle($1, $2) AS allowed`
        : `SELECT partner_can_access_gps_device($1, $2) AS allowed`,
      assigned
        ? [input.accessPartnerId, input.vehicleId]
        : [input.accessPartnerId, input.deviceId],
    );
    if (!allowed.rows[0]?.allowed) {
      return { total: 0, step: 1, points: [] as GpsRoutePoint[] };
    }
  }
  const from = input.from.toISOString();
  const to = input.to.toISOString();
  const count = await query<{ total: number }>(
    assigned
      ? `SELECT COUNT(*)::int AS total FROM gps_positions
          WHERE partner_id = $1 AND vehicle_id = $2
            AND recorded_at >= $3 AND recorded_at < $4`
      : `SELECT COUNT(*)::int AS total FROM gps_positions
          WHERE device_id = $1 AND vehicle_id IS NULL
            AND recorded_at >= $2 AND recorded_at < $3`,
    assigned
      ? [input.partnerId, input.vehicleId, from, to]
      : [input.deviceId, from, to],
  );
  const total = count.rows[0]?.total ?? 0;
  if (total === 0) return { total: 0, step: 1, points: [] as GpsRoutePoint[] };
  const step = routeSampleStep(total);
  const result = await query<{
    seq: string;
    recorded_at: Date;
    received_at: Date;
    latitude: string;
    longitude: string;
    speed_mps: string | null;
    heading_deg: string | null;
    satellites: number | null;
    hdop: string | null;
    fix_mode: string | null;
    plate: string | null;
  }>(
    `WITH windowed AS (
       SELECT position.seq, position.recorded_at, position.received_at,
              position.latitude, position.longitude, position.speed_mps,
              position.heading_deg, position.satellites, position.hdop,
              position.fix_mode, vehicle.plate,
              row_number() OVER (ORDER BY position.recorded_at, position.seq) AS n
         FROM gps_positions position
         LEFT JOIN partner_vehicles vehicle ON vehicle.id = position.vehicle_id
        WHERE ${assigned
          ? "position.partner_id = $1 AND position.vehicle_id = $2"
          : "position.device_id = $1 AND position.vehicle_id IS NULL"}
          AND position.recorded_at >= $${assigned ? 3 : 2}
          AND position.recorded_at < $${assigned ? 4 : 3}
     )
     SELECT seq::text AS seq, recorded_at, received_at,
            latitude::text AS latitude, longitude::text AS longitude,
            speed_mps::text AS speed_mps, heading_deg::text AS heading_deg,
            satellites, hdop::text AS hdop, fix_mode, plate
       FROM windowed
      WHERE ((n - 1) % $${assigned ? 5 : 4}) = 0
      ORDER BY n`,
    assigned
      ? [input.partnerId, input.vehicleId, from, to, step]
      : [input.deviceId, from, to, step],
  );
  return {
    total,
    step,
    points: result.rows.map((row) => ({
      seq: Number(row.seq),
      recordedAt: row.recorded_at.toISOString(),
      receivedAt: row.received_at.toISOString(),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      speedMps: numberOrNull(row.speed_mps),
      headingDeg: numberOrNull(row.heading_deg),
      satellites: row.satellites,
      hdop: numberOrNull(row.hdop),
      fixMode: row.fix_mode,
      plate: row.plate,
    })),
  };
}

export async function listGpsPartners() {
  const result = await query<{ id: string; partner_code: string; name: string }>(
    `SELECT id, partner_code, name
       FROM partners
      WHERE deleted_at IS NULL AND status = 'active'
      ORDER BY name`,
  );
  return result.rows;
}

export type GpsVehicleChoice = {
  id: string;
  partner_id: string;
  plate: string;
  uetds_company: string | null;
};

export async function listGpsVehicles() {
  const result = await query<GpsVehicleChoice>(
    `SELECT vehicle.id, vehicle.partner_id, vehicle.plate,
            company.short_name AS uetds_company
       FROM partner_vehicles vehicle
       LEFT JOIN uetds_companies company ON company.id = vehicle.uetds_company_id
      WHERE vehicle.deleted_at IS NULL
      ORDER BY vehicle.plate`,
  );
  return result.rows;
}

export async function createGpsDevice(input: {
  partnerId: string | null;
  vehicleId: string | null;
  deviceCode?: string | null;
  label?: string | null;
  profile: GpsRegistrationProfile;
  assignedBy: string;
}) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const deviceCode = input.deviceCode || generateDeviceCode();
    const label = (input.label || deviceCode).trim();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO gps_devices (
           partner_id, vehicle_id, device_code, label, imei, receiver, tracker_model,
           manufacturer, link_technology, serial_number, sim_phone, sim_operator, sim_apn,
           installation_status, live_source
         ) VALUES ($1, $2, $3, $4, $5, 'teltonika', $6, 'teltonika', $7, $8, $9, $10, $11, 'pending', FALSE)
         RETURNING id`,
        [
          input.partnerId,
          input.vehicleId,
          deviceCode,
          label,
          input.profile.imei,
          input.profile.trackerModel,
          input.profile.linkTechnology,
          input.profile.serialNumber,
          input.profile.simPhone,
          input.profile.simOperator,
          input.profile.simApn,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new Error("gps device was not created");
      await client.query(`INSERT INTO gps_device_status (device_id) VALUES ($1)`, [id]);
      await client.query(
        `INSERT INTO gps_device_assignments (device_id, partner_id, vehicle_id, assigned_by)
         VALUES ($1, $2, $3, $4)`,
        [id, input.partnerId, input.vehicleId, input.assignedBy],
      );
      await client.query(`INSERT INTO gps_immobilizer_status (device_id) VALUES ($1)`, [id]);
      await client.query("COMMIT");
      return { id, deviceCode };
    } catch (error) {
      await client.query("ROLLBACK");
      lastError = error;
      const constraint = typeof error === "object" && error && "constraint" in error
        ? String((error as { constraint?: unknown }).constraint ?? "")
        : "";
      if (!input.deviceCode && constraint.includes("device_code")) continue;
      throw error;
    } finally {
      client.release();
    }
  }
  throw lastError instanceof Error ? lastError : new Error("gps device code collision");
}

export async function updateGpsImei(deviceId: string, imei: string) {
  await query(
    `UPDATE gps_devices
        SET imei = $2, updated_at = NOW()
      WHERE id = $1 AND receiver = 'teltonika' AND deleted_at IS NULL`,
    [deviceId, imei],
  );
}

export async function updateGpsSimOperator(deviceId: string, simOperator: string) {
  await query(
    `UPDATE gps_devices SET sim_operator = $2, updated_at = NOW()
      WHERE id = $1 AND receiver = 'teltonika' AND deleted_at IS NULL`,
    [deviceId, simOperator],
  );
}

export async function updateGpsSimPhone(deviceId: string, simPhone: string | null) {
  await query(
    `UPDATE gps_devices SET sim_phone = $2, updated_at = NOW()
      WHERE id = $1 AND receiver = 'teltonika' AND deleted_at IS NULL`,
    [deviceId, simPhone],
  );
}

export async function assignGpsDevice(input: {
  deviceId: string;
  partnerId: string | null;
  vehicleId: string | null;
  assignedBy: string;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ live_source: boolean }>(
      `SELECT live_source FROM gps_devices
        WHERE id = $1 AND receiver = 'teltonika' AND deleted_at IS NULL
        FOR UPDATE`,
      [input.deviceId],
    );
    const row = current.rows[0];
    if (!row) throw new Error("gps device was not assigned");
    const occupied = input.vehicleId
      ? await client.query(
          `SELECT 1 FROM gps_devices
            WHERE vehicle_id = $1 AND id <> $2 AND status = 'active'
              AND live_source AND deleted_at IS NULL
            LIMIT 1`,
          [input.vehicleId, input.deviceId],
        )
      : { rowCount: 0 };
    const liveSource = gpsLiveSourceAfterAssignment({
      liveSource: row.live_source,
      vehicleId: input.vehicleId,
      destinationHasOtherLiveSource: (occupied.rowCount ?? 0) > 0,
    });
    const updated = await client.query(
      `UPDATE gps_devices
          SET partner_id = $2, vehicle_id = $3, live_source = $4, updated_at = NOW()
        WHERE id = $1 AND receiver = 'teltonika'`,
      [input.deviceId, input.partnerId, input.vehicleId, liveSource],
    );
    if ((updated.rowCount ?? 0) !== 1) throw new Error("gps device was not assigned");
    await client.query(
      `INSERT INTO gps_device_assignments (device_id, partner_id, vehicle_id, assigned_by)
       VALUES ($1, $2, $3, $4)`,
      [input.deviceId, input.partnerId, input.vehicleId, input.assignedBy],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listGpsAssignments(deviceId: string) {
  const result = await query<{
    assigned_at: Date;
    partner_name: string | null;
    partner_code: string | null;
    plate: string | null;
  }>(
    `SELECT assignment.assigned_at, partner.name AS partner_name,
            partner.partner_code, vehicle.plate
       FROM gps_device_assignments assignment
       LEFT JOIN partners partner ON partner.id = assignment.partner_id
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = assignment.vehicle_id
      WHERE assignment.device_id = $1
      ORDER BY assignment.assigned_at DESC
      LIMIT 12`,
    [deviceId],
  );
  return result.rows.map((row) => ({
    assignedAt: row.assigned_at.toISOString(),
    partnerName: row.partner_name,
    partnerCode: row.partner_code,
    plate: row.plate,
  }));
}

export async function setGpsDeviceStatus(deviceId: string, status: "active" | "disabled") {
  await query(
    `UPDATE gps_devices SET status = $2, updated_at = NOW()
      WHERE id = $1 AND receiver = 'teltonika' AND deleted_at IS NULL`,
    [deviceId, status],
  );
}

export type GpsDeviceDeleteResult = "deleted" | "missing";

export async function deleteGpsDevice(deviceId: string, actorId: string): Promise<GpsDeviceDeleteResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      device_code: string;
      imei: string;
      sim_phone: string | null;
      manufacturer: string;
      tracker_model: string;
      partner_id: string | null;
      vehicle_id: string | null;
    }>(
      `SELECT id, device_code, imei, sim_phone, manufacturer, tracker_model, partner_id, vehicle_id
         FROM gps_devices
        WHERE id = $1 AND receiver = 'teltonika' AND deleted_at IS NULL
        FOR UPDATE`,
      [deviceId],
    );
    const device = locked.rows[0];
    if (!device) {
      await client.query("ROLLBACK");
      return "missing";
    }
    await client.query(
      `INSERT INTO gps_device_deletion_audits (
         device_id, device_code, imei, sim_phone, manufacturer, tracker_model,
         partner_id, vehicle_id, actor_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        device.id,
        device.device_code,
        device.imei,
        device.sim_phone,
        device.manufacturer,
        device.tracker_model,
        device.partner_id,
        device.vehicle_id,
        actorId,
      ],
    );
    await client.query(
      `WITH disabled AS (
         UPDATE gps_ats_settings
            SET enabled = FALSE, source_device_id = NULL, updated_at = NOW()
          WHERE source_device_id = $1
          RETURNING vehicle_id
       )
       INSERT INTO gps_ats_control_events (vehicle_id, device_id, action, actor_user_id)
       SELECT vehicle_id, $1, 'disable', $2 FROM disabled`,
      [deviceId, actorId],
    );
    await client.query(
      `UPDATE gps_devices
          SET status = 'disabled', partner_id = NULL, vehicle_id = NULL,
              live_source = FALSE, deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
        WHERE id = $1`,
      [deviceId, actorId],
    );
    await client.query(
      `INSERT INTO gps_device_assignments (device_id, partner_id, vehicle_id, assigned_by)
       VALUES ($1, NULL, NULL, $2)`,
      [deviceId, `deleted:${actorId}`.slice(0, 80)],
    );
    await client.query("COMMIT");
    return "deleted";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function generateDeviceCode() {
  const code = `TPT-${randomBytes(6).toString("hex").toUpperCase()}`;
  if (!GPS_DEVICE_CODE_PATTERN.test(code)) throw new Error("invalid generated GPS device code");
  return code;
}

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function numberOrNull(value: string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
