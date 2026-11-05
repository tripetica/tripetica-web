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
  accState: string | null;
  din1State: "on" | "off" | null;
  manufacturer: "teltonika";
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
    snapshot.accState ?? "",
    snapshot.din1State ?? "",
    snapshot.manufacturer,
    snapshot.recent?.length ?? 0,
    snapshot.recent?.at(-1)?.at ?? "",
  ].join("|");
}

export function gpsLiveEtag(snapshot: GpsLiveSnapshot) {
  return `W/"${gpsLiveTag(snapshot)}"`;
}

const PARTNER_OMITTED_LIVE_FIELDS = [
  "firmware",
  "operatorName",
  "accState",
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
  const accState = optionalText(body.accState);
  const rssi = optionalFinite(body.rssi);
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
    || recent === undefined
    || [firmware, operatorName, network, accState, rssi].some((item) => item === undefined)
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
    accState: accState ?? null,
    din1State: body.din1State === "on" || body.din1State === "off" ? body.din1State : null,
    manufacturer: "teltonika",
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

function optionalCount(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return value;
}
