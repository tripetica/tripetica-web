export const MAINTENANCE_MAX_SPEED_MPS = 90;
export const MAINTENANCE_GAP_MS = 15 * 60 * 1000;
export const MAINTENANCE_FUTURE_MS = 5 * 60 * 1000;
export const MAINTENANCE_JITTER_MPS = 1;
export const MAINTENANCE_JITTER_METERS = 40;
export const MAINTENANCE_MAX_KM = 10_000_000;
export const MAINTENANCE_POINT_LIMIT = 400;

export const MAINTENANCE_APPROACH_STEPS = [500, 400, 300, 200, 100] as const;

export type MaintenanceLocale = "tr" | "en" | "ru";
export type MaintenanceLine = "remaining" | "due" | "overdue";
export type MaintenanceEventKind = "setup" | "service" | "correction" | "edit";
export type MaintenanceDistanceSource = "physical" | "mobile";
export type MaintenanceError =
  | "invalid"
  | "interval"
  | "future"
  | "order"
  | "exists"
  | "forbidden"
  | "conflict"
  | "failed"
  | "missing";

export type MaintenanceIgnition = "on" | "off";

export type MaintenanceTrackPoint = {
  id: string;
  at: number;
  latitude: number;
  longitude: number;
  ignition?: MaintenanceIgnition | null;
};

export type MaintenanceCursor = {
  at: number;
  latitude: number | null;
  longitude: number | null;
  pointId: string | null;
  ignition?: MaintenanceIgnition | null;
};

export type MaintenanceHistoryItem = {
  id: string;
  kind: MaintenanceEventKind;
  odometerKm: number;
  serviceOn: string | null;
  intervalKm: number | null;
  actorEmail: string | null;
  createdAt: string;
};

export type MaintenanceNoticeItem = {
  thresholdKm: number;
  createdAt: string;
  driverTitle: string | null;
  driverBody: string | null;
};

export type MaintenanceSnapshot =
  | {
      started: false;
      vehicleId: string;
      today: string;
    }
  | {
      started: true;
      vehicleId: string;
      today: string;
      startKm: number;
      verifiedKm: number;
      verifiedAt: string;
      estimatedKm: number;
      lastServiceKm: number;
      lastServiceOn: string;
      intervalKm: number;
      nextServiceKm: number;
      remainingKm: number;
      line: MaintenanceLine;
      gap: boolean;
      history: MaintenanceHistoryItem[];
      notices: MaintenanceNoticeItem[];
    };

export type MaintenanceActionResult =
  | { ok: true; snapshot: MaintenanceSnapshot }
  | { ok: false; error: MaintenanceError };

export function maintenanceLockKey(vehicleId: string) {
  return `maintenance:${vehicleId}`;
}

export function maintenanceDistanceSource(hasActivePhysicalDevice: boolean): MaintenanceDistanceSource {
  return hasActivePhysicalDevice ? "physical" : "mobile";
}

export function maintenancePositionSql(source: MaintenanceDistanceSource) {
  const table = source === "physical" ? "gps_positions" : "gps_mobile_positions";
  const ignition = source === "physical" ? ", ignition" : "";
  return `SELECT id::text AS id, recorded_at, latitude::text AS latitude, longitude::text AS longitude${ignition}
     FROM ${table}
    WHERE partner_id = $1
      AND vehicle_id = $2
      AND recorded_at > $3
    ORDER BY recorded_at ASC
   LIMIT ${MAINTENANCE_POINT_LIMIT}`;
}

export function istanbulMaintenanceDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatMaintenanceDate(isoDate: string, locale: MaintenanceLocale) {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  if (!year || !month || !day) return isoDate;
  if (locale === "en") return `${month}/${day}/${year}`;
  return `${day}.${month}.${year}`;
}

export function formatMaintenanceDateTime(iso: string, locale: MaintenanceLocale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale === "ru" ? "ru-RU" : "tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function parseMaintenanceKm(raw: string) {
  const text = raw.trim().replace(/\s+/g, "");
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value > MAINTENANCE_MAX_KM) return null;
  return value;
}

export function parseMaintenanceDate(raw: string, today: string): { ok: true; date: string } | { ok: false; error: "invalid" | "future" } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, error: "invalid" };
  const [year, month, day] = raw.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return { ok: false, error: "invalid" };
  }
  if (raw > today) return { ok: false, error: "future" };
  return { ok: true, date: raw };
}

export function validateMaintenanceSetup(input: {
  startKm: string;
  previousKm: string;
  previousOn: string;
  intervalKm: string;
  today: string;
}) {
  const startKm = parseMaintenanceKm(input.startKm);
  const previousKm = parseMaintenanceKm(input.previousKm);
  const intervalKm = parseMaintenanceKm(input.intervalKm);
  const previousOn = parseMaintenanceDate(input.previousOn, input.today);
  if (startKm === null || previousKm === null || intervalKm === null || !previousOn.ok) {
    if (intervalKm === 0) return { ok: false as const, error: "interval" as const };
    if (!previousOn.ok && previousOn.error === "future") return { ok: false as const, error: "future" as const };
    return { ok: false as const, error: "invalid" as const };
  }
  if (intervalKm <= 0) return { ok: false as const, error: "interval" as const };
  if (previousKm > startKm) return { ok: false as const, error: "order" as const };
  return { ok: true as const, startKm, previousKm, previousOn: previousOn.date, intervalKm };
}

export function validateMaintenanceEdit(input: {
  lastServiceKm: string;
  lastServiceOn: string;
  intervalKm: string;
  today: string;
}) {
  const lastServiceKm = parseMaintenanceKm(input.lastServiceKm);
  const intervalKm = parseMaintenanceKm(input.intervalKm);
  const lastServiceOn = parseMaintenanceDate(input.lastServiceOn, input.today);
  if (lastServiceKm === null || intervalKm === null || !lastServiceOn.ok) {
    if (intervalKm === 0) return { ok: false as const, error: "interval" as const };
    if (!lastServiceOn.ok && lastServiceOn.error === "future") return { ok: false as const, error: "future" as const };
    return { ok: false as const, error: "invalid" as const };
  }
  if (intervalKm <= 0) return { ok: false as const, error: "interval" as const };
  return { ok: true as const, lastServiceKm, lastServiceOn: lastServiceOn.date, intervalKm };
}

export function maintenanceHaversineMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const radius = 6_371_000;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pointIsUsable(point: MaintenanceTrackPoint) {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || !Number.isFinite(point.at)) return false;
  if (point.latitude < -90 || point.latitude > 90 || point.longitude < -180 || point.longitude > 180) return false;
  if (point.latitude === 0 && point.longitude === 0) return false;
  return true;
}

function reportedIgnition(point: MaintenanceTrackPoint): MaintenanceIgnition | null {
  return point.ignition === "on" || point.ignition === "off" ? point.ignition : null;
}

export function foldMaintenanceDistance(input: {
  cursor: MaintenanceCursor | null;
  points: MaintenanceTrackPoint[];
  nowMs: number;
  maxSpeedMps?: number;
  gapMs?: number;
  useIgnition?: boolean;
}) {
  const maxSpeed = input.maxSpeedMps ?? MAINTENANCE_MAX_SPEED_MPS;
  const gapMs = input.gapMs ?? MAINTENANCE_GAP_MS;
  const useIgnition = input.useIgnition === true;
  let cursor = input.cursor;
  let addedMeters = 0;
  let gap = false;
  for (const point of input.points) {
    if (!pointIsUsable(point)) continue;
    if (point.at > input.nowMs + MAINTENANCE_FUTURE_MS) continue;
    if (cursor && (point.at < cursor.at || point.id === cursor.pointId)) continue;
    const reported = useIgnition ? reportedIgnition(point) : null;
    if (!cursor || cursor.latitude === null || cursor.longitude === null) {
      cursor = { at: point.at, latitude: point.latitude, longitude: point.longitude, pointId: point.id, ignition: reported };
      continue;
    }
    const previous = useIgnition && (cursor.ignition === "on" || cursor.ignition === "off") ? cursor.ignition : null;
    const ignition = reported ?? previous;
    const elapsedMs = point.at - cursor.at;
    const meters = maintenanceHaversineMeters(
      { latitude: cursor.latitude, longitude: cursor.longitude },
      point,
    );
    const move = (nextIgnition: MaintenanceIgnition | null) => {
      cursor = { at: point.at, latitude: point.latitude, longitude: point.longitude, pointId: point.id, ignition: nextIgnition };
    };
    if (meters < 1) {
      move(ignition);
      continue;
    }
    if (elapsedMs > gapMs) {
      gap = true;
      move(ignition);
      continue;
    }
    if (previous === "off") {
      move(ignition);
      continue;
    }
    const elapsedSeconds = elapsedMs / 1000;
    const speed = elapsedSeconds > 0 ? meters / elapsedSeconds : Number.POSITIVE_INFINITY;
    if (speed > maxSpeed || (speed < MAINTENANCE_JITTER_MPS && meters < MAINTENANCE_JITTER_METERS)) {
      move(ignition);
      continue;
    }
    addedMeters += meters;
    move(ignition);
  }
  return { addedMeters, cursor, gap };
}

export function displayMaintenanceKm(verifiedKm: number, distanceM: number) {
  return verifiedKm + Math.floor(Math.max(0, distanceM) / 1000);
}

export function maintenanceLine(remainingKm: number): MaintenanceLine {
  if (remainingKm > 0) return "remaining";
  if (remainingKm === 0) return "due";
  return "overdue";
}

export function maintenanceFigures(input: {
  verifiedKm: number;
  distanceM: number;
  lastServiceKm: number;
  intervalKm: number;
}) {
  const estimatedKm = displayMaintenanceKm(input.verifiedKm, input.distanceM);
  const nextServiceKm = input.lastServiceKm + input.intervalKm;
  const remainingKm = nextServiceKm - estimatedKm;
  return {
    estimatedKm,
    nextServiceKm,
    remainingKm,
    line: maintenanceLine(remainingKm),
  };
}

export function maintenanceAlertThreshold(remainingKm: number) {
  if (!Number.isFinite(remainingKm)) return null;
  if (remainingKm > 500) return null;
  if (remainingKm > 400) return 500;
  if (remainingKm > 300) return 400;
  if (remainingKm > 200) return 300;
  if (remainingKm > 100) return 200;
  if (remainingKm > 0) return 100;
  if (remainingKm === 0) return 0;
  const overdue = Math.floor(-remainingKm / 100) * 100;
  if (overdue < 100) return 0;
  return -overdue;
}

export function maintenanceNoticeDue(remainingKm: number, sent: ReadonlySet<number>) {
  const threshold = maintenanceAlertThreshold(remainingKm);
  if (threshold === null || sent.has(threshold)) return null;
  return threshold;
}

export function maintenancePartnerRecipients(emails: string[]) {
  const unique = new Set<string>();
  for (const email of emails) {
    const value = email.trim().toLowerCase();
    if (value) unique.add(value);
  }
  return [...unique];
}

export function maintenanceNormalizeEmail(email: string | null | undefined) {
  const value = email?.trim().toLowerCase() ?? "";
  return value || null;
}

/** One vehicle and one threshold. A shared address receives the driver copy only. */
export function maintenanceDeliveryPlan(input: {
  partnerEmails: readonly string[];
  driverEmail: string | null;
}) {
  const partnerEmails = maintenancePartnerRecipients([...input.partnerEmails]);
  const driverEmail = maintenanceNormalizeEmail(input.driverEmail);
  if (!driverEmail) {
    return { partnerEmails, driverEmail: null, samePerson: false };
  }
  return {
    partnerEmails: partnerEmails.filter((email) => email !== driverEmail),
    driverEmail,
    samePerson: partnerEmails.includes(driverEmail),
  };
}
