import {
  MAINTENANCE_FUTURE_MS,
  MAINTENANCE_GAP_MS,
  MAINTENANCE_JITTER_METERS,
  MAINTENANCE_JITTER_MPS,
  MAINTENANCE_MAX_SPEED_MPS,
  foldMaintenanceDistance,
  maintenanceHaversineMeters,
  type MaintenanceIgnition,
} from "@/lib/gps/maintenance";

export const DRIVE_POINT_LIMIT = 20_000;
export const DRIVE_STATIONARY_END_MS = 15 * 60 * 1000;

export type DriveLocale = "tr" | "en" | "ru";

export type DriveVehicleInfo = {
  plate: string | null;
  brand: string | null;
  model: string | null;
  driverName: string | null;
};

export type DriveTrackPoint = {
  id: string;
  at: number;
  latitude: number;
  longitude: number;
  speedMps?: number | null;
  ignition?: MaintenanceIgnition | null;
};

export type DriveRoutePoint = {
  at: number;
  latitude: number;
  longitude: number;
  speedMps: number | null;
};

export type DriveTripClose = "stationary" | "ignition" | "gap" | "end";

export type DriveTrip = {
  startedAt: number;
  endedAt: number;
  meters: number;
  movingMs: number;
  stoppedMs: number;
  maxSpeedMps: number | null;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  route: DriveRoutePoint[];
  ignitionOnMs: number;
  ignitionOffMs: number;
  ignitionUnknownMs: number;
  hasExplicitIgnition: boolean;
  closedBy: DriveTripClose;
};

export type DriveReport = {
  meters: number;
  movingMs: number;
  stoppedMs: number;
  totalMs: number;
  trips: DriveTrip[];
  maxSpeedMps: number | null;
  gap: boolean;
  truncated: boolean;
  useIgnition: boolean;
  hasExplicitIgnition: boolean;
  countedUnknownIgnition: boolean;
  ignitionOnMs: number;
  ignitionOffMs: number;
  ignitionUnknownMs: number;
  hasFix: boolean;
  fixCount: number;
};

export function formatDriveKilometers(meters: number, locale: DriveLocale) {
  const text = new Intl.NumberFormat(locale === "en" ? "en-GB" : locale === "ru" ? "ru-RU" : "tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.max(0, meters) / 1000);
  return `${text} km`;
}

export function formatDriveDuration(ms: number, locale: DriveLocale) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (locale === "en") {
    if (hours > 0 && minutes === 0) return hours === 1 ? "1 hour" : `${hours} hours`;
    if (hours > 0) return `${hours} h ${minutes} min`;
    if (minutes > 0) return `${minutes} min`;
    return `${totalSeconds} s`;
  }
  if (locale === "ru") {
    if (hours > 0 && minutes === 0) return hours === 1 ? "1 час" : `${hours} ч`;
    if (hours > 0) return `${hours} ч ${minutes} мин`;
    if (minutes > 0) return `${minutes} мин`;
    return `${totalSeconds} с`;
  }
  if (hours > 0 && minutes === 0) return hours === 1 ? "1 saat" : `${hours} saat`;
  if (hours > 0) return `${hours} sa ${minutes} dk`;
  if (minutes > 0) return `${minutes} dk`;
  return `${totalSeconds} sn`;
}

export function formatDriveDay(utcMs: number, locale: DriveLocale) {
  const parts = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale === "ru" ? "ru-RU" : "tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = part("weekday");
  const titled = weekday ? weekday.charAt(0).toLocaleUpperCase(locale === "en" ? "en-GB" : locale === "ru" ? "ru-RU" : "tr-TR") + weekday.slice(1) : "";
  return `${part("day")} ${part("month")} ${part("year")} — ${titled}`;
}

export function formatDriveClock(utcMs: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}`;
}

function usable(point: DriveTrackPoint) {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || !Number.isFinite(point.at)) return false;
  if (point.latitude < -90 || point.latitude > 90 || point.longitude < -180 || point.longitude > 180) return false;
  if (point.latitude === 0 && point.longitude === 0) return false;
  return true;
}

function reported(point: DriveTrackPoint, useIgnition: boolean): MaintenanceIgnition | null {
  if (!useIgnition) return null;
  return point.ignition === "on" || point.ignition === "off" ? point.ignition : null;
}

type OpenTrip = {
  startedAt: number;
  endedAt: number;
  meters: number;
  movingMs: number;
  stoppedMs: number;
  maxSpeedMps: number | null;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  route: DriveRoutePoint[];
  ignitionOnMs: number;
  ignitionOffMs: number;
  ignitionUnknownMs: number;
  hasExplicitIgnition: boolean;
  pendingStopMs: number;
  pendingOnMs: number;
  pendingOffMs: number;
  pendingUnknownMs: number;
  pending: DriveRoutePoint[];
  stillSince: number | null;
};

function routePoint(point: { at: number; latitude: number; longitude: number; speedMps?: number | null }): DriveRoutePoint {
  const speed = point.speedMps;
  return {
    at: point.at,
    latitude: point.latitude,
    longitude: point.longitude,
    speedMps: typeof speed === "number" && Number.isFinite(speed) ? speed : null,
  };
}

function rememberSpeed(target: { maxSpeedMps: number | null }, speed: number | null | undefined) {
  if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0 || speed > MAINTENANCE_MAX_SPEED_MPS) return;
  target.maxSpeedMps = target.maxSpeedMps === null ? speed : Math.max(target.maxSpeedMps, speed);
}

export function analyzeDriveTrack(input: {
  points: DriveTrackPoint[];
  nowMs: number;
  useIgnition: boolean;
  truncated?: boolean;
}): DriveReport {
  const points = [...input.points].sort((left, right) => left.at - right.at || left.id.localeCompare(right.id));
  const folded = foldMaintenanceDistance({
    cursor: null,
    points,
    nowMs: input.nowMs,
    useIgnition: input.useIgnition,
  });
  let cursor: { at: number; latitude: number; longitude: number; pointId: string; ignition: MaintenanceIgnition | null; speedMps: number | null } | null = null;
  let ignitionOnMs = 0;
  let ignitionOffMs = 0;
  let ignitionUnknownMs = 0;
  let countedUnknownIgnition = false;
  let hasExplicitIgnition = false;
  let hasFix = false;
  let fixCount = 0;
  let gap = false;
  let open: OpenTrip | null = null;
  const trips: DriveTrip[] = [];

  const publish = (closedBy: DriveTripClose) => {
    if (!open) return;
    if (closedBy !== "stationary") {
      open.stoppedMs += open.pendingStopMs;
      open.ignitionOnMs += open.pendingOnMs;
      open.ignitionOffMs += open.pendingOffMs;
      open.ignitionUnknownMs += open.pendingUnknownMs;
      open.route.push(...open.pending);
      if (open.pending.length > 0) {
        const last = open.pending[open.pending.length - 1];
        open.endedAt = last.at;
        open.endLatitude = last.latitude;
        open.endLongitude = last.longitude;
      }
    }
    if (open.meters > 0) {
      trips.push({
        startedAt: open.startedAt,
        endedAt: open.endedAt,
        meters: open.meters,
        movingMs: open.movingMs,
        stoppedMs: open.stoppedMs,
        maxSpeedMps: open.maxSpeedMps,
        startLatitude: open.startLatitude,
        startLongitude: open.startLongitude,
        endLatitude: open.endLatitude,
        endLongitude: open.endLongitude,
        route: open.route,
        ignitionOnMs: open.ignitionOnMs,
        ignitionOffMs: open.ignitionOffMs,
        ignitionUnknownMs: open.ignitionUnknownMs,
        hasExplicitIgnition: open.hasExplicitIgnition,
        closedBy,
      });
    }
    open = null;
  };

  const begin = (): OpenTrip | null => {
    if (!cursor) return null;
    const trip: OpenTrip = {
      startedAt: cursor.at,
      endedAt: cursor.at,
      meters: 0,
      movingMs: 0,
      stoppedMs: 0,
      maxSpeedMps: null,
      startLatitude: cursor.latitude,
      startLongitude: cursor.longitude,
      endLatitude: cursor.latitude,
      endLongitude: cursor.longitude,
      route: [routePoint(cursor)],
      ignitionOnMs: 0,
      ignitionOffMs: 0,
      ignitionUnknownMs: 0,
      hasExplicitIgnition: cursor.ignition === "on" || cursor.ignition === "off",
      pendingStopMs: 0,
      pendingOnMs: 0,
      pendingOffMs: 0,
      pendingUnknownMs: 0,
      pending: [],
      stillSince: null,
    };
    rememberSpeed(trip, cursor.speedMps);
    open = trip;
    return trip;
  };

  for (const point of points) {
    if (!usable(point)) continue;
    if (point.at > input.nowMs + MAINTENANCE_FUTURE_MS) continue;
    const explicit = reported(point, input.useIgnition);
    if (explicit) hasExplicitIgnition = true;
    if (!cursor) {
      hasFix = true;
      fixCount += 1;
      cursor = { at: point.at, latitude: point.latitude, longitude: point.longitude, pointId: point.id, ignition: explicit, speedMps: point.speedMps ?? null };
      continue;
    }
    if (point.at < cursor.at || point.id === cursor.pointId) continue;
    hasFix = true;
    fixCount += 1;
    const previous = input.useIgnition && (cursor.ignition === "on" || cursor.ignition === "off") ? cursor.ignition : null;
    const ignition = explicit ?? previous;
    const elapsedMs = point.at - cursor.at;
    const meters = maintenanceHaversineMeters(cursor, point);
    const place = () => {
      cursor = { at: point.at, latitude: point.latitude, longitude: point.longitude, pointId: point.id, ignition, speedMps: point.speedMps ?? null };
    };
    const countIgnition = (target: OpenTrip | null, keep: boolean) => {
      if (!input.useIgnition) return;
      if (previous === "on") ignitionOnMs += elapsedMs;
      else if (previous === "off") ignitionOffMs += elapsedMs;
      else ignitionUnknownMs += elapsedMs;
      if (!keep || !target) return;
      if (previous === "on") target.ignitionOnMs += elapsedMs;
      else if (previous === "off") target.ignitionOffMs += elapsedMs;
      else target.ignitionUnknownMs += elapsedMs;
      if (explicit) target.hasExplicitIgnition = true;
    };
    const holdIgnition = () => {
      if (!open || !input.useIgnition) return;
      if (previous === "on") open.pendingOnMs += elapsedMs;
      else if (previous === "off") open.pendingOffMs += elapsedMs;
      else open.pendingUnknownMs += elapsedMs;
      if (explicit) open.hasExplicitIgnition = true;
    };
    const hold = () => {
      if (input.useIgnition) {
        if (previous === "on") ignitionOnMs += elapsedMs;
        else if (previous === "off") ignitionOffMs += elapsedMs;
        else ignitionUnknownMs += elapsedMs;
      }
      if (!open) {
        place();
        return;
      }
      if (open.stillSince === null) open.stillSince = cursor?.at ?? point.at;
      open.pendingStopMs += elapsedMs;
      open.pending.push(routePoint(point));
      holdIgnition();
      if (open.pendingStopMs >= DRIVE_STATIONARY_END_MS) {
        publish("stationary");
        place();
        return;
      }
      if (explicit === "off") publish("ignition");
      place();
    };
    if (meters < 1) {
      hold();
      continue;
    }
    if (elapsedMs > MAINTENANCE_GAP_MS) {
      gap = true;
      publish("gap");
      place();
      continue;
    }
    if (previous === "off") {
      publish("ignition");
      place();
      continue;
    }
    const elapsedSeconds = elapsedMs / 1000;
    const segmentSpeed = elapsedSeconds > 0 ? meters / elapsedSeconds : Number.POSITIVE_INFINITY;
    if (segmentSpeed > MAINTENANCE_MAX_SPEED_MPS || (segmentSpeed < MAINTENANCE_JITTER_MPS && meters < MAINTENANCE_JITTER_METERS)) {
      hold();
      continue;
    }
    const trip = open ?? begin();
    if (!trip) {
      place();
      continue;
    }
    if (trip.pendingStopMs > 0) {
      trip.stoppedMs += trip.pendingStopMs;
      trip.ignitionOnMs += trip.pendingOnMs;
      trip.ignitionOffMs += trip.pendingOffMs;
      trip.ignitionUnknownMs += trip.pendingUnknownMs;
      trip.route.push(...trip.pending);
      trip.pendingStopMs = 0;
      trip.pendingOnMs = 0;
      trip.pendingOffMs = 0;
      trip.pendingUnknownMs = 0;
      trip.pending = [];
      trip.stillSince = null;
    }
    if (previous === null && input.useIgnition) countedUnknownIgnition = true;
    trip.meters += meters;
    trip.movingMs += elapsedMs;
    trip.endedAt = point.at;
    trip.endLatitude = point.latitude;
    trip.endLongitude = point.longitude;
    trip.route.push(routePoint(point));
    rememberSpeed(trip, point.speedMps);
    countIgnition(trip, true);
    if (explicit === "off") publish("ignition");
    place();
  }
  publish("end");
  const movingMs = trips.reduce((sum, trip) => sum + trip.movingMs, 0);
  const stoppedMs = trips.reduce((sum, trip) => sum + trip.stoppedMs, 0);
  const maxSpeedMps = trips.reduce<number | null>((max, trip) => {
    if (trip.maxSpeedMps === null) return max;
    return max === null ? trip.maxSpeedMps : Math.max(max, trip.maxSpeedMps);
  }, null);
  return {
    meters: folded.addedMeters,
    movingMs,
    stoppedMs,
    totalMs: trips.reduce((sum, trip) => sum + Math.max(0, trip.endedAt - trip.startedAt), 0),
    trips,
    maxSpeedMps,
    gap: gap || folded.gap,
    truncated: input.truncated === true,
    useIgnition: input.useIgnition,
    hasExplicitIgnition,
    countedUnknownIgnition,
    ignitionOnMs,
    ignitionOffMs,
    ignitionUnknownMs,
    hasFix,
    fixCount,
  };
}
