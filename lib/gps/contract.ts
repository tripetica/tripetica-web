export const GPS_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const GPS_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const GPS_MAX_SPEED_MPS = 90;
export const GPS_ROUTE_MAX_POINTS = 800;
export const GPS_ROUTE_MAX_SPAN_MS = 31 * 24 * 60 * 60 * 1000;

export const GPS_DEVICE_CODE_PATTERN = /^TPT-[0-9A-F]{12}$/;

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
  ignition?: "on" | "off" | null;
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

export function normalizeDeviceCode(value: string) {
  const code = value.trim().toUpperCase();
  return GPS_DEVICE_CODE_PATTERN.test(code) ? code : null;
}

export function routeSampleStep(total: number, maxPoints = GPS_ROUTE_MAX_POINTS) {
  if (!Number.isFinite(total) || total <= maxPoints) {
    return 1;
  }
  return Math.ceil(total / maxPoints);
}
