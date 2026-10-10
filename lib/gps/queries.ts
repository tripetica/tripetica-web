import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { lowBatteryActionPayload, wifiSharePayload } from "@/lib/gps/commands";
import { GPS_COMMAND_RETRY_MS, routeSampleStep } from "@/lib/gps/contract";
import { canDeleteGpsDevice } from "@/lib/gps/delete-access";
import { type GpsLiveSnapshot, type GpsRecentFix, type GpsWifiShareCommand } from "@/lib/gps/live";
import { gpsInitialLiveSource, gpsLiveSourceAfterAssignment, type GpsRegistrationProfile } from "@/lib/gps/registration";
import { generateDeviceCode, generateDeviceToken, hashDeviceToken } from "@/lib/gps/token";

export type GpsDeviceListItem = {
  id: string;
  deviceCode: string;
  label: string;
  imei: string | null;
  status: "active" | "disabled";
  partnerId: string | null;
  partnerName: string;
  partnerCode: string;
  createdAt: string;
  credentialState: "active" | "revoked" | "missing";
  vehicleId: string | null;
  plate: string | null;
  uetdsCompany: string | null;
  wifiEnabled: boolean;
  wifiMode: "on" | "off" | "auto";
  wifiSsid: string | null;
  wifiPasswordSet: boolean;
  wifiMaxClients: number;
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
  reportedWifiEnabled: boolean | null;
  reportedWifiSsid: string | null;
  wifiClients: number | null;
  ackedThrough: number;
  uptimeSeconds: number | null;
  simStatus: string | null;
  lteRegistration: string | null;
  pppStatus: string | null;
  naptStatus: string | null;
  ipAddress: string | null;
  gnssResponse: string | null;
  wifiPolicy: string | null;
  apStatus: string | null;
  reportedMaxClients: number | null;
  lastRecoveryReason: string | null;
  lastModemRecoveryAt: string | null;
  lastGnssRecoveryAt: string | null;
  resetReason: string | null;
  powerSource: string | null;
  vehicleBatteryVoltage: number | null;
  accState: string | null;
  powerMode: string | null;
  cameraAvailable: boolean | null;
  cameraReady: boolean | null;
  batteryPercent: number | null;
  lowBatteryState: "normal" | "grace" | "keep_on" | "saving" | null;
  lowBatteryGraceRemainingSeconds: number | null;
  lowBatteryEpisodeAt: string | null;
  manufacturer: "esp32" | "teltonika";
  trackerModel: "fmb920" | "fmc920" | null;
  linkTechnology: "2g" | "4g" | null;
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

export type GpsCommandView = {
  id: string;
  kind: string;
  status: string;
  createdBy: string;
  actorLabel: string | null;
  createdAt: string;
  deliveredAt: string | null;
  finishedAt: string | null;
  error: string | null;
  ssid: string | null;
  maxClients: number | null;
  intervalSeconds: number | null;
};

type DeviceSqlRow = {
  id: string;
  device_code: string;
  label: string;
  imei: string | null;
  status: "active" | "disabled";
  partner_id: string | null;
  partner_name: string | null;
  partner_code: string | null;
  created_at: Date;
  credential_device_id: string | null;
  credential_revoked_at: Date | null;
  vehicle_id: string | null;
  plate: string | null;
  uetds_company: string | null;
  wifi_enabled: boolean;
  wifi_mode: "on" | "off" | "auto";
  wifi_ssid: string | null;
  wifi_password_set: boolean;
  wifi_max_clients: number;
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
  reported_wifi_enabled: boolean | null;
  reported_wifi_ssid: string | null;
  wifi_clients: number | null;
  last_contiguous_seq: string;
  uptime_seconds: number | null;
  sim_status: string | null;
  lte_registration: string | null;
  ppp_status: string | null;
  napt_status: string | null;
  ip_address: string | null;
  gnss_response: string | null;
  wifi_policy: string | null;
  ap_status: string | null;
  reported_max_clients: number | null;
  last_recovery_reason: string | null;
  last_modem_recovery_at: Date | null;
  last_gnss_recovery_at: Date | null;
  reset_reason: string | null;
  power_source: string | null;
  vehicle_battery_voltage: string | null;
  acc_state: string | null;
  power_mode: string | null;
  camera_available: boolean | null;
  camera_ready: boolean | null;
  battery_percent: number | null;
  low_battery_state: "normal" | "grace" | "keep_on" | "saving" | null;
  low_battery_grace_remaining_seconds: number | null;
  low_battery_episode_at: Date | null;
  manufacturer: "esp32" | "teltonika";
  tracker_model: "fmb920" | "fmc920" | null;
  link_technology: "2g" | "4g" | null;
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
    device.wifi_enabled,
    device.wifi_mode,
    device.wifi_ssid,
    device.wifi_password_set,
    device.wifi_max_clients,
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
    status.wifi_enabled AS reported_wifi_enabled,
    status.wifi_ssid AS reported_wifi_ssid,
    status.wifi_clients,
    status.last_contiguous_seq::text AS last_contiguous_seq,
    status.uptime_seconds,
    status.sim_status,
    status.lte_registration,
    status.ppp_status,
    status.napt_status,
    status.ip_address,
    status.gnss_response,
    status.wifi_policy,
    status.ap_status,
    status.reported_max_clients,
    status.last_recovery_reason,
    status.last_modem_recovery_at,
    status.last_gnss_recovery_at,
    status.reset_reason,
    status.power_source,
    status.vehicle_battery_voltage::text AS vehicle_battery_voltage,
    status.acc_state,
    status.power_mode,
    status.camera_available,
    status.camera_ready,
    status.battery_percent,
    status.low_battery_state,
    status.low_battery_grace_remaining_seconds,
    status.low_battery_episode_at,
    device.manufacturer,
    device.tracker_model,
    device.link_technology,
    device.installation_status,
    device.live_source,
    device.serial_number,
    device.sim_phone,
    device.sim_operator,
    device.sim_apn,
    credential.device_id AS credential_device_id,
    credential.revoked_at AS credential_revoked_at
  FROM gps_devices device
  LEFT JOIN partners partner ON partner.id = device.partner_id
  LEFT JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
  LEFT JOIN uetds_companies company ON company.id = vehicle.uetds_company_id
  LEFT JOIN gps_device_status status ON status.device_id = device.id
  LEFT JOIN gps_device_credentials credential ON credential.device_id = device.id
`;

function credentialState(row: DeviceSqlRow): GpsDeviceListItem["credentialState"] {
  if (!row.credential_device_id) return "missing";
  if (row.credential_revoked_at) return "revoked";
  return "active";
}

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
    credentialState: credentialState(row),
    vehicleId: row.vehicle_id,
    plate: row.plate,
    uetdsCompany: row.uetds_company,
    wifiEnabled: row.wifi_enabled,
    wifiMode: row.wifi_mode,
    wifiSsid: row.wifi_ssid,
    wifiPasswordSet: row.wifi_password_set,
    wifiMaxClients: row.wifi_max_clients,
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
    reportedWifiEnabled: row.reported_wifi_enabled,
    reportedWifiSsid: row.reported_wifi_ssid,
    wifiClients: row.wifi_clients,
    ackedThrough: Number(row.last_contiguous_seq ?? 0),
    uptimeSeconds: row.uptime_seconds,
    simStatus: row.sim_status,
    lteRegistration: row.lte_registration,
    pppStatus: row.ppp_status,
    naptStatus: row.napt_status,
    ipAddress: row.ip_address,
    gnssResponse: row.gnss_response,
    wifiPolicy: row.wifi_policy,
    apStatus: row.ap_status,
    reportedMaxClients: row.reported_max_clients,
    lastRecoveryReason: row.last_recovery_reason,
    lastModemRecoveryAt: iso(row.last_modem_recovery_at),
    lastGnssRecoveryAt: iso(row.last_gnss_recovery_at),
    resetReason: row.reset_reason,
    powerSource: row.power_source,
    vehicleBatteryVoltage: numberOrNull(row.vehicle_battery_voltage),
    accState: row.acc_state,
    powerMode: row.power_mode,
    cameraAvailable: row.camera_available,
    cameraReady: row.camera_ready,
    batteryPercent: row.battery_percent,
    lowBatteryState: row.low_battery_state,
    lowBatteryGraceRemainingSeconds: row.low_battery_grace_remaining_seconds,
    lowBatteryEpisodeAt: row.low_battery_episode_at ? row.low_battery_episode_at.toISOString() : null,
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
        `${DEVICE_SELECT} WHERE device.partner_id = $1 ORDER BY vehicle.plate NULLS LAST, device.device_code`,
        [partnerId],
      )
    : await query<DeviceSqlRow>(
        `${DEVICE_SELECT} ORDER BY partner.name NULLS LAST, vehicle.plate NULLS LAST, device.device_code`,
      );
  return result.rows.map(mapDevice);
}

export async function listFleetDefaultDrivers(partnerId: string) {
  const result = await query<{ vehicle_id: string; driver_name: string }>(
    `SELECT defaults.vehicle_id,
            trim(driver.first_name || ' ' || driver.last_name) AS driver_name
       FROM partner_fleet_defaults defaults
       JOIN partner_drivers driver ON driver.id = defaults.driver_id
      WHERE defaults.partner_id = $1
        AND driver.deleted_at IS NULL`,
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
    uptime_seconds: number | null;
    sim_status: string | null;
    lte_registration: string | null;
    ppp_status: string | null;
    napt_status: string | null;
    ip_address: string | null;
    gnss_response: string | null;
    wifi_policy: string | null;
    ap_status: string | null;
    wifi_clients: number | null;
    reported_max_clients: number | null;
    last_recovery_reason: string | null;
    last_modem_recovery_at: Date | null;
    last_gnss_recovery_at: Date | null;
    reset_reason: string | null;
    power_source: string | null;
    vehicle_battery_voltage: string | null;
    acc_state: string | null;
    power_mode: string | null;
    battery_percent: number | null;
    wifi_enabled: boolean | null;
    low_battery_state: "normal" | "grace" | "keep_on" | "saving" | null;
    low_battery_grace_remaining_seconds: number | null;
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
            status.uptime_seconds,
            status.sim_status,
            status.lte_registration,
            status.ppp_status,
            status.napt_status,
            status.ip_address,
            status.gnss_response,
            status.wifi_policy,
            status.ap_status,
            status.wifi_clients,
            status.reported_max_clients,
            status.last_recovery_reason,
            status.last_modem_recovery_at,
            status.last_gnss_recovery_at,
            status.reset_reason,
            status.power_source,
            status.vehicle_battery_voltage::text AS vehicle_battery_voltage,
            status.acc_state,
            status.power_mode,
            status.battery_percent,
            status.wifi_enabled,
            status.low_battery_state,
            status.low_battery_grace_remaining_seconds
     FROM gps_devices device
     LEFT JOIN gps_device_status status ON status.device_id = device.id
     WHERE device.id = $1
       AND ($2::uuid IS NULL OR device.partner_id = $2)
     LIMIT 1`,
    [deviceId, partnerId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
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
    uptimeSeconds: row.uptime_seconds,
    simStatus: row.sim_status,
    lteRegistration: row.lte_registration,
    pppStatus: row.ppp_status,
    naptStatus: row.napt_status,
    ipAddress: row.ip_address,
    gnssResponse: row.gnss_response,
    wifiPolicy: row.wifi_policy,
    apStatus: row.ap_status,
    wifiClients: row.wifi_clients,
    reportedMaxClients: row.reported_max_clients,
    lastRecoveryReason: row.last_recovery_reason,
    lastModemRecoveryAt: iso(row.last_modem_recovery_at),
    lastGnssRecoveryAt: iso(row.last_gnss_recovery_at),
    resetReason: row.reset_reason,
    powerSource: row.power_source,
    vehicleBatteryVoltage: numberOrNull(row.vehicle_battery_voltage),
    accState: row.acc_state,
    powerMode: row.power_mode,
    batteryPercent: row.battery_percent,
    wifiEnabled: row.wifi_enabled,
    lowBatteryState: row.low_battery_state,
    lowBatteryGraceRemainingSeconds: row.low_battery_grace_remaining_seconds,
    wifiShareCommand: await latestWifiShareCommand(deviceId),
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
    `SELECT device_id::text AS device_id,
            recorded_at,
            latitude::text AS latitude,
            longitude::text AS longitude,
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

async function latestWifiShareCommand(deviceId: string): Promise<GpsWifiShareCommand | null> {
  const result = await query<{ id: string; status: string; mode: string | null }>(
    `SELECT id::text, status, payload->>'mode' AS mode
     FROM gps_commands
     WHERE device_id = $1
       AND kind = 'wifi_config'
       AND payload->>'mode' IN ('on', 'off')
       AND NOT (payload ? 'max_clients')
     ORDER BY created_at DESC
     LIMIT 1`,
    [deviceId],
  );
  const row = result.rows[0];
  if (!row || (row.mode !== "on" && row.mode !== "off")) return null;
  if (
    row.status !== "queued" &&
    row.status !== "delivered" &&
    row.status !== "acked" &&
    row.status !== "failed" &&
    row.status !== "expired" &&
    row.status !== "cancelled"
  ) {
    return null;
  }
  return { id: row.id, mode: row.mode, status: row.status };
}

export async function getGpsDevice(deviceId: string, partnerId: string | null) {
  const result = partnerId
    ? await query<DeviceSqlRow>(
        `${DEVICE_SELECT} WHERE device.id = $1 AND device.partner_id = $2 LIMIT 1`,
        [deviceId, partnerId],
      )
    : await query<DeviceSqlRow>(
        `${DEVICE_SELECT} WHERE device.id = $1 LIMIT 1`,
        [deviceId],
      );
  const row = result.rows[0];
  return row ? mapDevice(row) : null;
}

export async function listGpsRoute(input: {
  deviceId: string;
  partnerId: string;
  vehicleId: string;
  from: Date;
  to: Date;
}) {
  const count = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM gps_positions
     WHERE device_id = $1
       AND partner_id = $2
       AND vehicle_id = $5
       AND recorded_at >= $3
       AND recorded_at < $4`,
    [input.deviceId, input.partnerId, input.from.toISOString(), input.to.toISOString(), input.vehicleId],
  );
  const total = count.rows[0]?.total ?? 0;
  if (total === 0) {
    return { total: 0, step: 1, points: [] as GpsRoutePoint[] };
  }
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
       SELECT
         position.seq,
         position.recorded_at,
         position.received_at,
         position.latitude,
         position.longitude,
         position.speed_mps,
         position.heading_deg,
         position.satellites,
         position.hdop,
         position.fix_mode,
         vehicle.plate,
         row_number() OVER (ORDER BY position.recorded_at, position.seq) AS n
       FROM gps_positions position
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = position.vehicle_id
       WHERE position.device_id = $1
         AND position.partner_id = $2
         AND position.vehicle_id = $6
         AND position.recorded_at >= $3
         AND position.recorded_at < $4
     )
     SELECT
       seq::text AS seq,
       recorded_at,
       received_at,
       latitude::text AS latitude,
       longitude::text AS longitude,
       speed_mps::text AS speed_mps,
       heading_deg::text AS heading_deg,
       satellites,
       hdop::text AS hdop,
       fix_mode,
       plate
     FROM windowed
     WHERE ((n - 1) % $5) = 0
     ORDER BY n`,
    [input.deviceId, input.partnerId, input.from.toISOString(), input.to.toISOString(), step, input.vehicleId],
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

export async function listGpsCommands(deviceId: string, partnerId: string) {
  await query(
    `UPDATE gps_commands
       SET status = 'expired',
           error = 'timeout',
         finished_at = NOW(),
         payload = payload - 'password'
     WHERE device_id = $1
       AND partner_id = $2
       AND status = 'delivered'
       AND delivered_at <= NOW() - ($3::int * INTERVAL '1 second')`,
    [deviceId, partnerId, Math.round(GPS_COMMAND_RETRY_MS / 1000)],
  );
  const result = await query<{
    id: string;
    kind: string;
    status: string;
    created_by: string;
    actor_label: string | null;
    created_at: Date;
    delivered_at: Date | null;
    finished_at: Date | null;
    error: string | null;
    ssid: string | null;
    max_clients: number | null;
    interval_seconds: number | null;
  }>(
    `SELECT
       id,
       kind,
       status,
       created_by,
       actor_label,
       created_at,
       delivered_at,
       finished_at,
       error,
       payload->>'ssid' AS ssid,
       CASE WHEN payload ? 'max_clients' THEN (payload->>'max_clients')::int ELSE NULL END AS max_clients,
       CASE WHEN payload ? 'interval_s' THEN (payload->>'interval_s')::int ELSE NULL END AS interval_seconds
     FROM gps_commands
     WHERE device_id = $1
       AND partner_id = $2
     ORDER BY created_at DESC
     LIMIT 20`,
    [deviceId, partnerId],
  );
  return result.rows.map((row): GpsCommandView => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    createdBy: row.created_by,
    actorLabel: row.actor_label,
    createdAt: row.created_at.toISOString(),
    deliveredAt: iso(row.delivered_at),
    finishedAt: iso(row.finished_at),
    error: row.error,
    ssid: row.ssid,
    maxClients: row.max_clients,
    intervalSeconds: row.interval_seconds,
  }));
}

export async function listGpsPartners() {
  const result = await query<{ id: string; partner_code: string; name: string }>(
    `SELECT id, partner_code, name
     FROM partners
     WHERE deleted_at IS NULL
       AND status = 'active'
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
    `SELECT vehicle.id,
            vehicle.partner_id,
            vehicle.plate,
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
  imei: string | null;
  receiver?: "esp32" | "teltonika";
  trackerModel?: "fmb920" | "fmc920" | null;
  profile?: GpsRegistrationProfile;
  assignedBy: string;
  firmware?: string | null;
}) {
  const token = generateDeviceToken();
  const profile = input.profile ?? {
    receiver: input.receiver ?? "esp32",
    manufacturer: input.receiver === "teltonika" ? "teltonika" as const : "esp32" as const,
    trackerModel: input.receiver === "teltonika" ? input.trackerModel ?? null : null,
    linkTechnology: input.trackerModel === "fmb920" ? "2g" as const : input.trackerModel === "fmc920" ? "4g" as const : null,
    imei: input.imei,
    serialNumber: null,
    simPhone: null,
    simOperator: null,
    simApn: null,
    installationStatus: input.receiver === "teltonika" ? "pending" as const : "installed" as const,
  };
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const deviceCode = input.deviceCode || generateDeviceCode();
    const label = (input.label || deviceCode).trim();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const occupied = input.vehicleId
        ? await client.query(
          `SELECT 1
           FROM gps_devices
           WHERE vehicle_id = $1
             AND status = 'active'
             AND live_source
           LIMIT 1`,
          [input.vehicleId],
        )
        : { rowCount: 0 };
      const liveSource = gpsInitialLiveSource({
        receiver: profile.receiver,
        hasVehicle: Boolean(input.vehicleId),
        vehicleHasLiveSource: (occupied.rowCount ?? 0) > 0,
      });
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO gps_devices (
           partner_id, vehicle_id, device_code, label, imei, receiver, tracker_model,
           manufacturer, link_technology, serial_number, sim_phone, sim_operator, sim_apn,
           installation_status, live_source
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id`,
        [
          input.partnerId,
          input.vehicleId,
          deviceCode,
          label,
          profile.imei,
          profile.receiver,
          profile.trackerModel,
          profile.manufacturer,
          profile.linkTechnology,
          profile.serialNumber,
          profile.simPhone,
          profile.simOperator,
          profile.simApn,
          profile.installationStatus,
          liveSource,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) {
        throw new Error("gps device was not created");
      }
      await client.query(
        `INSERT INTO gps_device_credentials (device_id, token_hash) VALUES ($1, $2)`,
        [id, hashDeviceToken(token)],
      );
      await client.query(
        `INSERT INTO gps_device_status (device_id, firmware) VALUES ($1, $2)`,
        [id, input.firmware ?? null],
      );
      await client.query(
        `INSERT INTO gps_device_assignments (device_id, partner_id, vehicle_id, assigned_by)
         VALUES ($1, $2, $3, $4)`,
        [id, input.partnerId, input.vehicleId, input.assignedBy],
      );
      if (profile.receiver === "teltonika") {
        await client.query(
          `INSERT INTO gps_immobilizer_status (device_id) VALUES ($1)`,
          [id],
        );
      }
      await client.query("COMMIT");
      return { id, token, deviceCode };
    } catch (error) {
      await client.query("ROLLBACK");
      lastError = error;
      const constraint = typeof error === "object" && error && "constraint" in error
        ? String((error as { constraint?: unknown }).constraint ?? "")
        : "";
      if (!input.deviceCode && constraint.includes("device_code")) {
        continue;
      }
      throw error;
    } finally {
      client.release();
    }
  }
  throw lastError instanceof Error ? lastError : new Error("gps device code collision");
}

export async function rotateGpsDeviceToken(deviceId: string) {
  const token = generateDeviceToken();
  const result = await query(
    `UPDATE gps_device_credentials
     SET token_hash = $2,
         rotated_at = NOW(),
         revoked_at = NULL
     WHERE device_id = $1`,
    [deviceId, hashDeviceToken(token)],
  );
  if ((result.rowCount ?? 0) !== 1) {
    return null;
  }
  return token;
}

export async function revokeGpsDeviceToken(deviceId: string) {
  const result = await query(
    `UPDATE gps_device_credentials
     SET revoked_at = NOW()
     WHERE device_id = $1
       AND revoked_at IS NULL`,
    [deviceId],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function updateGpsImei(deviceId: string, imei: string | null) {
  await query(
    `UPDATE gps_devices SET imei = $2, updated_at = NOW() WHERE id = $1`,
    [deviceId, imei],
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
      `SELECT live_source
       FROM gps_devices
       WHERE id = $1
       FOR UPDATE`,
      [input.deviceId],
    );
    const row = current.rows[0];
    if (!row) {
      throw new Error("gps device was not assigned");
    }
    const occupied = input.vehicleId
      ? await client.query(
        `SELECT 1
         FROM gps_devices
         WHERE vehicle_id = $1
           AND id <> $2
           AND status = 'active'
           AND live_source
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
       SET partner_id = $2,
           vehicle_id = $3,
           live_source = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [input.deviceId, input.partnerId, input.vehicleId, liveSource],
    );
    if ((updated.rowCount ?? 0) !== 1) {
      throw new Error("gps device was not assigned");
    }
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
    `SELECT assignment.assigned_at,
            partner.name AS partner_name,
            partner.partner_code,
            vehicle.plate
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
    `UPDATE gps_devices SET status = $2, updated_at = NOW() WHERE id = $1`,
    [deviceId, status],
  );
}

export async function queueGpsCommand(input: {
  deviceId: string;
  partnerId: string;
  createdBy: "ops" | "partner";
  actorLabel: string;
  kind: string;
  payload: Record<string, unknown>;
  setting?: {
    wifiMode?: "on" | "off" | "auto";
    wifiSsid?: string;
    wifiMaxClients?: number;
  };
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE gps_commands
       SET status = 'cancelled',
           error = 'superseded',
           finished_at = NOW(),
           payload = payload - 'password'
       WHERE device_id = $1
         AND partner_id = $2
         AND status = 'queued'
         AND kind = $3`,
      [input.deviceId, input.partnerId, input.kind],
    );
    await client.query(
      `INSERT INTO gps_commands (device_id, partner_id, kind, payload, created_by, actor_label)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [
        input.deviceId,
        input.partnerId,
        input.kind,
        JSON.stringify(input.payload),
        input.createdBy,
        input.actorLabel,
      ],
    );
    if (input.setting?.wifiMode) {
      await client.query(
        `UPDATE gps_devices
         SET wifi_mode = $2,
             wifi_enabled = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [input.deviceId, input.setting.wifiMode, input.setting.wifiMode !== "off"],
      );
    }
    if (input.setting?.wifiSsid) {
      await client.query(
        `UPDATE gps_devices SET wifi_ssid = $2, updated_at = NOW() WHERE id = $1`,
        [input.deviceId, input.setting.wifiSsid],
      );
    }
    if (input.setting?.wifiMaxClients) {
      await client.query(
        `UPDATE gps_devices SET wifi_max_clients = $2, updated_at = NOW() WHERE id = $1`,
        [input.deviceId, input.setting.wifiMaxClients],
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

export async function queueGpsWifiShare(input: {
  deviceId: string;
  partnerId: string;
  createdBy: "ops" | "partner";
  actorLabel: string;
  mode: "on" | "off";
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const device = await client.query<{ partner_id: string }>(
      `SELECT partner_id FROM gps_devices WHERE id = $1 FOR UPDATE`,
      [input.deviceId],
    );
    if (device.rows[0]?.partner_id !== input.partnerId) {
      await client.query("ROLLBACK");
      return null;
    }
    const open = await client.query<{ id: string; status: string; mode: string | null }>(
      `SELECT id::text, status, payload->>'mode' AS mode
       FROM gps_commands
       WHERE device_id = $1
         AND kind = 'wifi_config'
         AND status IN ('queued', 'delivered')
         AND NOT (payload ? 'max_clients')
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [input.deviceId],
    );
    const current = open.rows[0];
    if (current?.mode === input.mode) {
      await client.query("COMMIT");
      return { id: current.id };
    }
    if (current?.status === "queued") {
      await client.query(
        `UPDATE gps_commands
         SET status = 'cancelled', error = 'superseded', finished_at = NOW()
         WHERE id = $1`,
        [current.id],
      );
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO gps_commands (device_id, partner_id, kind, payload, created_by, actor_label)
       VALUES ($1, $2, 'wifi_config', $3::jsonb, $4, $5)
       RETURNING id::text`,
      [
        input.deviceId,
        input.partnerId,
        JSON.stringify(wifiSharePayload(input.mode)),
        input.createdBy,
        input.actorLabel.slice(0, 80),
      ],
    );
    await client.query("COMMIT");
    const id = inserted.rows[0]?.id;
    return id ? { id } : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function queueGpsLowBattery(input: {
  deviceId: string;
  partnerId: string;
  actorLabel: string;
  action: "keep_on" | "save_power";
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const device = await client.query<{ partner_id: string }>(
      `SELECT partner_id FROM gps_devices WHERE id = $1 FOR UPDATE`,
      [input.deviceId],
    );
    if (device.rows[0]?.partner_id !== input.partnerId) {
      await client.query("ROLLBACK");
      return null;
    }
    const open = await client.query<{ id: string; action: string | null }>(
      `SELECT id::text, payload->>'action' AS action
       FROM gps_commands
       WHERE device_id = $1
         AND kind = 'low_battery_action'
         AND status = 'queued'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [input.deviceId],
    );
    const current = open.rows[0];
    if (current?.action === input.action) {
      await client.query("COMMIT");
      return { id: current.id };
    }
    if (current) {
      await client.query(
        `UPDATE gps_commands
         SET status = 'cancelled', error = 'superseded', finished_at = NOW()
         WHERE id = $1`,
        [current.id],
      );
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO gps_commands (device_id, partner_id, kind, payload, created_by, actor_label)
       VALUES ($1, $2, 'low_battery_action', $3::jsonb, 'partner', $4)
       RETURNING id::text`,
      [
        input.deviceId,
        input.partnerId,
        JSON.stringify(lowBatteryActionPayload(input.action)),
        input.actorLabel.slice(0, 80),
      ],
    );
    await client.query("COMMIT");
    const id = inserted.rows[0]?.id;
    return id ? { id } : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPartnerLowBattery(partnerId: string) {
  const result = await query<{
    id: string;
    device_code: string;
    plate: string | null;
    battery_percent: number | null;
    low_battery_state: "grace" | "keep_on" | "saving" | "normal" | null;
    low_battery_grace_remaining_seconds: number | null;
    low_battery_episode_at: Date | null;
    wifi_enabled: boolean | null;
  }>(
    `SELECT device.id,
            device.device_code,
            vehicle.plate,
            status.battery_percent,
            status.low_battery_state,
            status.low_battery_grace_remaining_seconds,
            status.low_battery_episode_at,
            status.wifi_enabled
     FROM gps_devices device
     JOIN gps_device_status status ON status.device_id = device.id
     LEFT JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
     WHERE device.partner_id = $1
       AND status.low_battery_state IN ('grace', 'keep_on', 'saving')
     ORDER BY status.low_battery_grace_remaining_seconds NULLS LAST, device.device_code`,
    [partnerId],
  );
  return result.rows.map((row) => ({
    deviceId: row.id,
    deviceCode: row.device_code,
    plate: row.plate,
    batteryPercent: row.battery_percent,
    lowBatteryState: row.low_battery_state,
    lowBatteryGraceRemainingSeconds: row.low_battery_grace_remaining_seconds,
    episodeAt: row.low_battery_episode_at ? row.low_battery_episode_at.toISOString() : null,
    wifiEnabled: row.wifi_enabled,
  }));
}

const GPS_DEVICE_USE_SQL = `
  EXISTS (SELECT 1 FROM gps_positions position WHERE position.device_id = $1)
  OR EXISTS (
    SELECT 1 FROM gps_device_status status
    WHERE status.device_id = $1
      AND (
        status.last_heartbeat_at IS NOT NULL
        OR status.last_seen_at IS NOT NULL
        OR status.last_contiguous_seq > 0
        OR status.recorded_at IS NOT NULL
        OR status.firmware IS NOT NULL
        OR status.latitude IS NOT NULL
        OR status.gnss_fix IS NOT NULL
        OR status.camera_available IS NOT NULL
        OR status.camera_ready IS NOT NULL
      )
  )
  OR EXISTS (
    SELECT 1 FROM gps_commands command
    WHERE command.device_id = $1
      AND (
        command.status IN ('delivered', 'acked', 'failed', 'expired')
        OR command.delivered_at IS NOT NULL
      )
  )
  OR EXISTS (
    SELECT 1 FROM gps_camera_sessions session
    WHERE session.device_id = $1
  )
`;

export type GpsDeviceDeleteResult = "deleted" | "missing" | "used" | "forbidden";

export async function deleteUnusedGpsDevice(deviceId: string): Promise<Exclude<GpsDeviceDeleteResult, "forbidden">> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT id FROM gps_devices WHERE id = $1 FOR UPDATE`,
      [deviceId],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return "missing";
    }
    const used = await client.query<{ used: boolean }>(
      `SELECT (${GPS_DEVICE_USE_SQL}) AS used`,
      [deviceId],
    );
    if (used.rows[0]?.used) {
      await client.query("ROLLBACK");
      return "used";
    }
    await client.query(`DELETE FROM gps_devices WHERE id = $1`, [deviceId]);
    await client.query("COMMIT");
    return "deleted";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteGpsDeviceForActor(actorId: string, deviceId: string): Promise<GpsDeviceDeleteResult> {
  if (!canDeleteGpsDevice(actorId)) {
    return "forbidden";
  }
  return deleteUnusedGpsDevice(deviceId);
}

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function numberOrNull(value: string | null) {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
