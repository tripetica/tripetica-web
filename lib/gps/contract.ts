export const DEVICE_API_VERSION = 1;
export const DEVICE_API_PREFIX = "/api/device/v1";
export const GPS_MAX_BATCH = 100;
export const GPS_MAX_BODY_BYTES = 256 * 1024;
export const GPS_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const GPS_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const GPS_MAX_SPEED_MPS = 90;
export const GPS_ROUTE_MAX_POINTS = 800;
export const GPS_ROUTE_MAX_SPAN_MS = 31 * 24 * 60 * 60 * 1000;
export const GPS_COMMAND_RETRY_MS = 15 * 60 * 1000;
export const GPS_TOKEN_PATTERN = /^tdev_[A-Za-z0-9_-]{43}$/;

export const GPS_DEVICE_CODE_PATTERN = /^TPT-[0-9A-F]{12}$/;
export const GPS_WIFI_MAX_CLIENTS_MIN = 1;
export const GPS_WIFI_MAX_CLIENTS_MAX = 8;
export const GPS_TELEMETRY_INTERVALS = [5, 10, 15, 30, 60, 120] as const;

export const GPS_COMMAND_KINDS = [
  "wifi.configure",
  "wifi.disable",
  "reboot",
  "modem_reset",
  "gnss_restart",
  "ppp_reconnect",
  "wifi_on",
  "wifi_off",
  "wifi_auto",
  "set_ssid",
  "set_password",
  "set_telemetry",
  "status",
  "set_max_wifi_clients",
  "wifi_config",
  "low_battery_action",
] as const;
export type GpsCommandKind = (typeof GPS_COMMAND_KINDS)[number];

export type GpsPointError =
  | "invalid_seq"
  | "invalid_time"
  | "future_time"
  | "stale_time"
  | "invalid_coordinate"
  | "invalid_speed"
  | "invalid_heading"
  | "invalid_altitude"
  | "invalid_quality";

export type GpsPoint = {
  seq: number;
  gnssTime: Date;
  lat: number;
  lon: number;
  speedMps: number | null;
  headingDeg: number | null;
  altitudeM: number | null;
  fixMode: string | null;
  satellites: number | null;
  hdop: number | null;
  pdop: number | null;
  vdop: number | null;
};

export type GpsHeartbeat = {
  firmware: string | null;
  rssi: number | null;
  network: string | null;
  operatorName: string | null;
  wifiEnabled: boolean | null;
  wifiSsid: string | null;
  wifiClients: number | null;
  gnssFix: boolean | null;
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
  battery: GpsDeviceBattery;
  lowBattery?: GpsLowBatteryReport;
};

export const GPS_LOW_BATTERY_STATES = ["normal", "grace", "keep_on", "saving"] as const;
export type GpsLowBatteryState = (typeof GPS_LOW_BATTERY_STATES)[number];

export type GpsLowBatteryReport = {
  state: GpsBatteryField<GpsLowBatteryState>;
  remaining: GpsBatteryField<number>;
};

export const GPS_LOW_BATTERY_UNCHANGED: GpsLowBatteryReport = {
  state: { kind: "absent" },
  remaining: { kind: "absent" },
};

export type GpsBatteryField<T> =
  | { kind: "absent" }
  | { kind: "clear" }
  | { kind: "keep" }
  | { kind: "set"; value: T };

export type GpsDeviceBattery = {
  percent: GpsBatteryField<number>;
  voltage: GpsBatteryField<number>;
  chargingInferred: GpsBatteryField<boolean>;
};

export const GPS_CELL_VOLTAGE_MIN = 2;
export const GPS_CELL_VOLTAGE_MAX = 5.5;

export const GPS_BATTERY_UNCHANGED: GpsDeviceBattery = {
  percent: { kind: "absent" },
  voltage: { kind: "absent" },
  chargingInferred: { kind: "absent" },
};

export function pointError(point: GpsPoint, now: Date): GpsPointError | null {
  if (!Number.isSafeInteger(point.seq) || point.seq < 1) {
    return "invalid_seq";
  }
  const time = point.gnssTime.getTime();
  if (!Number.isFinite(time)) {
    return "invalid_time";
  }
  if (time > now.getTime() + GPS_FUTURE_SKEW_MS) {
    return "future_time";
  }
  if (time < now.getTime() - GPS_MAX_AGE_MS) {
    return "stale_time";
  }
  if (
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lon) ||
    point.lat < -90 ||
    point.lat > 90 ||
    point.lon < -180 ||
    point.lon > 180 ||
    (point.lat === 0 && point.lon === 0)
  ) {
    return "invalid_coordinate";
  }
  if (
    point.speedMps !== null &&
    (!Number.isFinite(point.speedMps) || point.speedMps < 0 || point.speedMps > GPS_MAX_SPEED_MPS)
  ) {
    return "invalid_speed";
  }
  if (
    point.headingDeg !== null &&
    (!Number.isFinite(point.headingDeg) || point.headingDeg < 0 || point.headingDeg > 360)
  ) {
    return "invalid_heading";
  }
  if (
    point.altitudeM !== null &&
    (!Number.isFinite(point.altitudeM) || point.altitudeM < -500 || point.altitudeM > 20000)
  ) {
    return "invalid_altitude";
  }
  if (!qualityOk(point)) {
    return "invalid_quality";
  }
  return null;
}

function qualityOk(point: GpsPoint) {
  if (point.satellites !== null && (!Number.isInteger(point.satellites) || point.satellites < 0 || point.satellites > 80)) {
    return false;
  }
  for (const value of [point.hdop, point.pdop, point.vdop]) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 99)) {
      return false;
    }
  }
  if (point.fixMode !== null && !/^[a-z0-9_-]{1,16}$/i.test(point.fixMode)) {
    return false;
  }
  return true;
}

export function parseTelemetryBody(body: unknown, now: Date): {
  points: GpsPoint[];
  rejected: { seq: number; error: GpsPointError }[];
  battery: GpsDeviceBattery;
} | null {
  if (!isRecord(body) || !Array.isArray(body.points) || body.points.length < 1 || body.points.length > GPS_MAX_BATCH) {
    return null;
  }
  const points: GpsPoint[] = [];
  const rejected: { seq: number; error: GpsPointError }[] = [];
  for (const item of body.points) {
    const parsed = parsePoint(item);
    if (!parsed) {
      const seq = isRecord(item) && typeof item.seq === "number" ? item.seq : 0;
      rejected.push({ seq: Number.isSafeInteger(seq) ? seq : 0, error: "invalid_seq" });
      continue;
    }
    const error = pointError(parsed, now);
    if (error) {
      rejected.push({ seq: parsed.seq, error });
      continue;
    }
    points.push(parsed);
  }
  points.sort((left, right) => left.seq - right.seq);
  return { points, rejected, battery: parseDeviceBattery(body) };
}

function parsePoint(value: unknown): GpsPoint | null {
  if (!isRecord(value)) {
    return null;
  }
  const seq = value.seq;
  const gnssTime = typeof value.gnss_time === "string" ? new Date(value.gnss_time) : null;
  const lat = value.lat;
  const lon = value.lon;
  if (typeof seq !== "number" || !gnssTime || typeof lat !== "number" || typeof lon !== "number") {
    return null;
  }
  return {
    seq,
    gnssTime,
    lat,
    lon,
    speedMps: optionalNumber(value.speed_mps),
    headingDeg: optionalNumber(value.heading_deg),
    altitudeM: optionalNumber(value.altitude_m),
    fixMode: optionalText(value.fix_mode, 16),
    satellites: optionalInteger(value.satellites),
    hdop: optionalNumber(value.hdop),
    pdop: optionalNumber(value.pdop),
    vdop: optionalNumber(value.vdop),
  };
}

export function parseHeartbeatBody(body: unknown): GpsHeartbeat | null {
  if (!isRecord(body)) {
    return null;
  }
  const wifi = isRecord(body.wifi) ? body.wifi : null;
  const gnss = isRecord(body.gnss) ? body.gnss : null;
  const firmware = boundedText(body.firmware, 40);
  const network = boundedText(body.network, 32);
  const operatorName = boundedText(body.operator, 40);
  const flatSsid = body.wifi_ssid === undefined ? null : boundedText(body.wifi_ssid, 32);
  const nestedSsid = wifi ? boundedText(wifi.ssid, 32) : null;
  const wifiSsid = flatSsid === undefined || nestedSsid === undefined ? undefined : (flatSsid ?? nestedSsid);
  if (firmware === undefined || network === undefined || operatorName === undefined || wifiSsid === undefined) {
    return null;
  }
  const simStatus = boundedText(body.sim, 40);
  const lteRegistration = boundedText(body.lte_registration, 40);
  const pppStatus = boundedText(body.ppp, 40);
  const naptStatus = boundedText(body.napt, 40);
  const ipAddress = boundedText(body.ip, 45);
  const gnssResponse = boundedText(body.gnss_response, 500);
  const wifiPolicy = boundedText(body.wifi_policy, 40);
  const apStatus = boundedText(body.ap_status, 40);
  const lastRecoveryReason = boundedText(body.last_recovery_reason, 80);
  const resetReason = boundedText(body.reset_reason, 80);
  const powerSource = boundedText(body.power_source, 40);
  const accState = boundedText(body.acc, 40);
  const powerMode = boundedText(body.power_mode, 40);
  const lastModemRecoveryAt = optionalTimestamp(body.last_modem_recovery);
  const lastGnssRecoveryAt = optionalTimestamp(body.last_gnss_recovery);
  const technical = [
    simStatus,
    lteRegistration,
    pppStatus,
    naptStatus,
    ipAddress,
    gnssResponse,
    wifiPolicy,
    apStatus,
    lastRecoveryReason,
    resetReason,
    powerSource,
    accState,
    powerMode,
    lastModemRecoveryAt,
    lastGnssRecoveryAt,
  ];
  if (technical.some((value) => value === undefined)) {
    return null;
  }
  const heartbeat: GpsHeartbeat = {
    firmware,
    rssi: optionalInteger(body.rssi),
    network,
    operatorName,
    wifiEnabled: typeof body.wifi_enabled === "boolean"
      ? body.wifi_enabled
      : wifi && typeof wifi.enabled === "boolean" ? wifi.enabled : null,
    wifiSsid,
    wifiClients: body.wifi_connected_clients === undefined
      ? (wifi ? optionalInteger(wifi.clients) : null)
      : optionalInteger(body.wifi_connected_clients),
    gnssFix: gnss && typeof gnss.fix === "boolean" ? gnss.fix : null,
    uptimeSeconds: optionalInteger(body.uptime_s),
    simStatus: present(simStatus),
    lteRegistration: present(lteRegistration),
    pppStatus: present(pppStatus),
    naptStatus: present(naptStatus),
    ipAddress: present(ipAddress),
    gnssResponse: present(gnssResponse),
    wifiPolicy: present(wifiPolicy),
    apStatus: present(apStatus),
    reportedMaxClients: body.wifi_max_clients === undefined
      ? optionalInteger(body.max_clients)
      : optionalInteger(body.wifi_max_clients),
    lastRecoveryReason: present(lastRecoveryReason),
    lastModemRecoveryAt: present(lastModemRecoveryAt),
    lastGnssRecoveryAt: present(lastGnssRecoveryAt),
    resetReason: present(resetReason),
    powerSource: present(powerSource),
    vehicleBatteryVoltage: optionalNumber(body.vehicle_battery_voltage),
    accState: present(accState),
    powerMode: present(powerMode),
    cameraAvailable: typeof body.camera_available === "boolean" ? body.camera_available : null,
    cameraReady: typeof body.camera_ready === "boolean" ? body.camera_ready : null,
    battery: parseDeviceBattery(body),
    lowBattery: parseLowBatteryReport(body),
  };
  if (heartbeat.rssi !== null && (!Number.isFinite(heartbeat.rssi) || heartbeat.rssi < -150 || heartbeat.rssi > 0)) {
    return null;
  }
  if (
    heartbeat.wifiClients !== null &&
    (!Number.isInteger(heartbeat.wifiClients) || heartbeat.wifiClients < 0 || heartbeat.wifiClients > 64)
  ) {
    return null;
  }
  if (
    heartbeat.uptimeSeconds !== null &&
    (!Number.isInteger(heartbeat.uptimeSeconds) || heartbeat.uptimeSeconds < 0 || heartbeat.uptimeSeconds > 10_000_000)
  ) {
    return null;
  }
  if (
    heartbeat.reportedMaxClients !== null &&
    (!Number.isInteger(heartbeat.reportedMaxClients) || heartbeat.reportedMaxClients < 0 || heartbeat.reportedMaxClients > 64)
  ) {
    return null;
  }
  if (
    heartbeat.vehicleBatteryVoltage !== null &&
    (!Number.isFinite(heartbeat.vehicleBatteryVoltage) || heartbeat.vehicleBatteryVoltage < 0 || heartbeat.vehicleBatteryVoltage > 60)
  ) {
    return null;
  }
  return heartbeat;
}

export function parseCommandResultBody(body: unknown): { ok: boolean; error: string | null; detail: Record<string, unknown> | null } | null {
  if (!isRecord(body) || typeof body.ok !== "boolean") {
    return null;
  }
  const error = body.error === null || body.error === undefined
    ? null
    : boundedText(body.error, 200);
  if (error === undefined) {
    return null;
  }
  const detail = isRecord(body.detail) ? body.detail : null;
  return { ok: body.ok, error, detail };
}

export function wifiPasswordError(password: string) {
  if (password.length < 8 || password.length > 63) {
    return "wifi_password" as const;
  }
  if (![...password].every((char) => {
    const code = char.charCodeAt(0);
    return code >= 32 && code <= 126;
  })) {
    return "wifi_password" as const;
  }
  return null;
}

export function normalizeDeviceCode(value: string) {
  const code = value.trim().toUpperCase();
  return GPS_DEVICE_CODE_PATTERN.test(code) ? code : null;
}

export function wifiMaxClientsError(value: number) {
  if (!Number.isInteger(value) || value < GPS_WIFI_MAX_CLIENTS_MIN || value > GPS_WIFI_MAX_CLIENTS_MAX) {
    return "max_clients" as const;
  }
  return null;
}

export function telemetryIntervalError(value: number) {
  if (!(GPS_TELEMETRY_INTERVALS as readonly number[]).includes(value)) {
    return "telemetry_interval" as const;
  }
  return null;
}

export function wifiSsidError(ssid: string) {
  const trimmed = ssid.trim();
  if (trimmed.length < 1 || trimmed.length > 32) {
    return "wifi_ssid" as const;
  }
  if ([...trimmed].some((char) => char.charCodeAt(0) < 32)) {
    return "wifi_ssid" as const;
  }
  return null;
}

export function routeSampleStep(total: number, maxPoints = GPS_ROUTE_MAX_POINTS) {
  if (!Number.isFinite(total) || total <= maxPoints) {
    return 1;
  }
  return Math.ceil(total / maxPoints);
}

export function publicCommandPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return {};
  }
  const copy = { ...payload };
  delete copy.password;
  return copy;
}

function present<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("invalid heartbeat field");
  }
  return value;
}

function optionalTimestamp(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return undefined;
  }
  return new Date(value).toISOString();
}

export function parseLowBatteryReport(body: Record<string, unknown>): GpsLowBatteryReport {
  return {
    state: readLowBatteryState(body.low_battery_state),
    remaining: readGraceRemaining(body.low_battery_grace_remaining_seconds),
  };
}

function readLowBatteryState(value: unknown): GpsBatteryField<GpsLowBatteryState> {
  if (value === undefined) return { kind: "absent" };
  if (value === "normal" || value === "grace" || value === "keep_on" || value === "saving") {
    return { kind: "set", value };
  }
  return { kind: "keep" };
}

function readGraceRemaining(value: unknown): GpsBatteryField<number> {
  if (value === undefined) return { kind: "absent" };
  if (value === null) return { kind: "clear" };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 7200) {
    return { kind: "keep" };
  }
  return { kind: "set", value };
}

export function parseDeviceBattery(body: Record<string, unknown>): GpsDeviceBattery {
  return {
    percent: readBatteryPercent(body.battery_percent),
    voltage: readCellVoltage(body.battery_voltage),
    chargingInferred: readChargingInferred(body.charging_inferred),
  };
}

function readBatteryPercent(value: unknown): GpsBatteryField<number> {
  if (value === undefined || value === null) return { kind: "absent" };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    return { kind: "keep" };
  }
  return { kind: "set", value };
}

function readCellVoltage(value: unknown): GpsBatteryField<number> {
  if (value === undefined) return { kind: "absent" };
  if (value === null) return { kind: "clear" };
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < GPS_CELL_VOLTAGE_MIN ||
    value > GPS_CELL_VOLTAGE_MAX
  ) {
    return { kind: "keep" };
  }
  return { kind: "set", value };
}

function readChargingInferred(value: unknown): GpsBatteryField<boolean> {
  if (value === undefined) return { kind: "absent" };
  if (value === null) return { kind: "clear" };
  if (typeof value !== "boolean") return { kind: "keep" };
  return { kind: "set", value };
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return typeof value === "number" ? value : Number.NaN;
}

function optionalInteger(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return typeof value === "number" && Number.isInteger(value) ? value : Number.NaN;
}

function boundedText(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    return undefined;
  }
  return trimmed;
}

function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return "x".repeat(max + 1);
  }
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max + 1) : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
