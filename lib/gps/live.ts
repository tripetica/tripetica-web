export const GPS_LIVE_POLL_MS = 5000;

export type GpsRecentFix = {
  at: number;
  latitude: number;
  longitude: number;
  speedMps: number | null;
};

export type GpsLiveSnapshot = {
  seq: number;
  recordedAt: string | null;
  recent?: GpsRecentFix[];
  latitude: number | null;
  longitude: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  satellites: number | null;
  gnssFix: boolean | null;
  lastHeartbeatAt: string | null;
  firmware: string | null;
  rssi: number | null;
  operatorName: string | null;
  network: string | null;
  uptimeSeconds: number | null;
  simStatus: string | null;
  lteRegistration: string | null;
  pppStatus: string | null;
  naptStatus: string | null;
  ipAddress: string | null;
  gnssResponse: string | null;
  wifiPolicy: string | null;
  apStatus: string | null;
  wifiClients: number | null;
  reportedMaxClients: number | null;
  lastRecoveryReason: string | null;
  lastModemRecoveryAt: string | null;
  lastGnssRecoveryAt: string | null;
  resetReason: string | null;
  powerSource: string | null;
  vehicleBatteryVoltage: number | null;
  accState: string | null;
  din1State: "on" | "off" | null;
  manufacturer: "esp32" | "teltonika";
  powerMode: string | null;
  batteryPercent: number | null;
  wifiEnabled: boolean | null;
  wifiShareCommand: GpsWifiShareCommand | null;
  lowBatteryState: "normal" | "grace" | "keep_on" | "saving" | null;
  lowBatteryGraceRemainingSeconds: number | null;
};

export type GpsWifiShareCommand = {
  id: string;
  mode: "on" | "off";
  status: "queued" | "delivered" | "acked" | "failed" | "expired" | "cancelled";
};

export function gpsLiveTag(snapshot: GpsLiveSnapshot) {
  return [
    snapshot.seq,
    snapshot.recordedAt ?? "",
    snapshot.lastHeartbeatAt ?? "",
    snapshot.latitude ?? "",
    snapshot.longitude ?? "",
    snapshot.speedMps ?? "",
    snapshot.headingDeg ?? "",
    snapshot.satellites ?? "",
    snapshot.gnssFix === null ? "" : snapshot.gnssFix ? "1" : "0",
    snapshot.firmware ?? "",
    snapshot.rssi ?? "",
    snapshot.operatorName ?? "",
    snapshot.network ?? "",
    snapshot.uptimeSeconds ?? "",
    snapshot.simStatus ?? "",
    snapshot.lteRegistration ?? "",
    snapshot.pppStatus ?? "",
    snapshot.naptStatus ?? "",
    snapshot.ipAddress ?? "",
    snapshot.gnssResponse ?? "",
    snapshot.wifiPolicy ?? "",
    snapshot.apStatus ?? "",
    snapshot.wifiClients ?? "",
    snapshot.reportedMaxClients ?? "",
    snapshot.lastRecoveryReason ?? "",
    snapshot.lastModemRecoveryAt ?? "",
    snapshot.lastGnssRecoveryAt ?? "",
    snapshot.resetReason ?? "",
    snapshot.powerSource ?? "",
    snapshot.vehicleBatteryVoltage ?? "",
    snapshot.accState ?? "",
    snapshot.din1State ?? "",
    snapshot.manufacturer,
    snapshot.powerMode ?? "",
    snapshot.batteryPercent ?? "",
    snapshot.lowBatteryState ?? "",
    snapshot.lowBatteryGraceRemainingSeconds ?? "",
    snapshot.wifiEnabled === null ? "" : snapshot.wifiEnabled ? "1" : "0",
    snapshot.wifiShareCommand ? `${snapshot.wifiShareCommand.id}:${snapshot.wifiShareCommand.status}` : "",
    snapshot.recent?.length ?? 0,
    snapshot.recent?.at(-1)?.at ?? "",
  ].join("|");
}

export function gpsLiveEtag(snapshot: GpsLiveSnapshot) {
  return `W/"${gpsLiveTag(snapshot)}"`;
}

const PARTNER_OMITTED_LIVE_FIELDS = [
  "firmware",
  "rssi",
  "operatorName",
  "network",
  "uptimeSeconds",
  "simStatus",
  "lteRegistration",
  "pppStatus",
  "naptStatus",
  "ipAddress",
  "gnssResponse",
  "wifiPolicy",
  "apStatus",
  "reportedMaxClients",
  "lastRecoveryReason",
  "lastModemRecoveryAt",
  "lastGnssRecoveryAt",
  "resetReason",
  "powerSource",
  "vehicleBatteryVoltage",
  "accState",
  "powerMode",
] as const;

export function gpsPartnerLivePayload(snapshot: GpsLiveSnapshot) {
  const body: Record<string, unknown> = { ...snapshot };
  for (const key of PARTNER_OMITTED_LIVE_FIELDS) {
    delete body[key];
  }
  return body;
}

export function readGpsLiveSnapshot(value: unknown): GpsLiveSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const body = value as Record<string, unknown>;
  const seq = body.seq;
  if (typeof seq !== "number" || !Number.isInteger(seq) || seq < 0) {
    return null;
  }
  const recordedAt = optionalIso(body.recordedAt);
  const lastHeartbeatAt = optionalIso(body.lastHeartbeatAt);
  const latitude = optionalCoord(body.latitude, 90);
  const longitude = optionalCoord(body.longitude, 180);
  const speedMps = optionalFinite(body.speedMps);
  const headingDeg = optionalFinite(body.headingDeg);
  const satellites = optionalCount(body.satellites);
  const gnssFix = body.gnssFix === null || typeof body.gnssFix === "boolean" ? body.gnssFix : undefined;
  const firmware = optionalText(body.firmware);
  const operatorName = optionalText(body.operatorName);
  const network = optionalText(body.network);
  const simStatus = optionalText(body.simStatus);
  const lteRegistration = optionalText(body.lteRegistration);
  const pppStatus = optionalText(body.pppStatus);
  const naptStatus = optionalText(body.naptStatus);
  const ipAddress = optionalText(body.ipAddress);
  const gnssResponse = optionalText(body.gnssResponse);
  const wifiPolicy = optionalText(body.wifiPolicy);
  const apStatus = optionalText(body.apStatus);
  const lastRecoveryReason = optionalText(body.lastRecoveryReason);
  const resetReason = optionalText(body.resetReason);
  const powerSource = optionalText(body.powerSource);
  const accState = optionalText(body.accState);
  const powerMode = optionalText(body.powerMode);
  const rssi = optionalFinite(body.rssi);
  const uptimeSeconds = optionalCount(body.uptimeSeconds);
  const wifiClients = optionalCount(body.wifiClients);
  const reportedMaxClients = optionalCount(body.reportedMaxClients);
  const vehicleBatteryVoltage = optionalFinite(body.vehicleBatteryVoltage);
  const batteryPercent = optionalBatteryPercent(body.batteryPercent);
  const lowBatteryState = optionalLowBatteryState(body.lowBatteryState);
  const lowBatteryGraceRemainingSeconds = optionalGraceSeconds(body.lowBatteryGraceRemainingSeconds);
  const wifiEnabled = optionalFlag(body.wifiEnabled);
  const wifiShareCommand = readWifiShareCommand(body.wifiShareCommand);
  const lastModemRecoveryAt = optionalIso(body.lastModemRecoveryAt);
  const lastGnssRecoveryAt = optionalIso(body.lastGnssRecoveryAt);
  const recent = readRecentFixes(body.recent);
  if (
    recordedAt === undefined
    || lastHeartbeatAt === undefined
    || latitude === undefined
    || longitude === undefined
    || speedMps === undefined
    || headingDeg === undefined
    || satellites === undefined
    || gnssFix === undefined
    || batteryPercent === undefined
    || wifiEnabled === undefined
    || recent === undefined
    || [firmware, operatorName, network, simStatus, lteRegistration, pppStatus, naptStatus, ipAddress, gnssResponse, wifiPolicy, apStatus, lastRecoveryReason, resetReason, powerSource, accState, powerMode, rssi, uptimeSeconds, wifiClients, reportedMaxClients, vehicleBatteryVoltage, lastModemRecoveryAt, lastGnssRecoveryAt].some((item) => item === undefined)
  ) {
    return null;
  }
  return {
    seq,
    recordedAt,
    latitude,
    longitude,
    speedMps,
    headingDeg,
    satellites,
    gnssFix,
    lastHeartbeatAt,
    firmware: firmware ?? null,
    rssi: rssi ?? null,
    operatorName: operatorName ?? null,
    network: network ?? null,
    uptimeSeconds: uptimeSeconds ?? null,
    simStatus: simStatus ?? null,
    lteRegistration: lteRegistration ?? null,
    pppStatus: pppStatus ?? null,
    naptStatus: naptStatus ?? null,
    ipAddress: ipAddress ?? null,
    gnssResponse: gnssResponse ?? null,
    wifiPolicy: wifiPolicy ?? null,
    apStatus: apStatus ?? null,
    wifiClients: wifiClients ?? null,
    reportedMaxClients: reportedMaxClients ?? null,
    lastRecoveryReason: lastRecoveryReason ?? null,
    lastModemRecoveryAt: lastModemRecoveryAt ?? null,
    lastGnssRecoveryAt: lastGnssRecoveryAt ?? null,
    resetReason: resetReason ?? null,
    powerSource: powerSource ?? null,
    vehicleBatteryVoltage: vehicleBatteryVoltage ?? null,
    accState: accState ?? null,
    din1State: body.din1State === "on" || body.din1State === "off" ? body.din1State : null,
    manufacturer: body.manufacturer === "teltonika" ? "teltonika" : "esp32",
    powerMode: powerMode ?? null,
    batteryPercent,
    wifiEnabled,
    wifiShareCommand,
    lowBatteryState,
    lowBatteryGraceRemainingSeconds,
    recent,
  };
}

function readRecentFixes(value: unknown): GpsRecentFix[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500) return undefined;
  const fixes: GpsRecentFix[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const row = item as Record<string, unknown>;
    if (typeof row.at !== "number" || !Number.isFinite(row.at)) return undefined;
    if (typeof row.latitude !== "number" || !Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90) return undefined;
    if (typeof row.longitude !== "number" || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180) return undefined;
    if (row.speedMps !== null && (typeof row.speedMps !== "number" || !Number.isFinite(row.speedMps))) return undefined;
    fixes.push({
      at: row.at,
      latitude: row.latitude,
      longitude: row.longitude,
      speedMps: row.speedMps === null ? null : row.speedMps,
    });
  }
  return fixes;
}

function optionalIso(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return undefined;
  }
  return value;
}

function optionalFinite(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function optionalCoord(value: unknown, limit: number) {
  const parsed = optionalFinite(value);
  if (parsed === undefined || parsed === null) {
    return parsed;
  }
  if (Math.abs(parsed) > limit) {
    return undefined;
  }
  return parsed;
}

function optionalText(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return value;
}

function optionalFlag(value: unknown) {
  if (value === undefined || value === null) return null;
  return typeof value === "boolean" ? value : undefined;
}

function readWifiShareCommand(value: unknown): GpsWifiShareCommand | null {
  if (value === undefined || value === null || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const id = body.id;
  const mode = body.mode;
  const status = body.status;
  if (typeof id !== "string" || (mode !== "on" && mode !== "off")) return null;
  if (
    status !== "queued" &&
    status !== "delivered" &&
    status !== "acked" &&
    status !== "failed" &&
    status !== "expired" &&
    status !== "cancelled"
  ) {
    return null;
  }
  return { id, mode, status };
}

function optionalLowBatteryState(value: unknown) {
  if (value === undefined || value === null) return null;
  if (value === "normal" || value === "grace" || value === "keep_on" || value === "saving") return value;
  return null;
}

function optionalGraceSeconds(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 7200) return null;
  return value;
}

function optionalBatteryPercent(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) return undefined;
  return value;
}

function optionalCount(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return value;
}
