export const TELTONIKA_GREEN_TYPE_IO = 253;
export const TELTONIKA_GREEN_VALUE_IO = 254;

export type GreenDrivingKind = "acceleration" | "braking" | "cornering";

export type DriveGreenStatus = "unsupported" | "inactive" | "empty" | "recorded";

export type DriveGreenView = {
  status: DriveGreenStatus;
  events: {
    at: number;
    kind: GreenDrivingKind;
    rawValue: number | null;
  }[];
};

export type GreenDrivingReading = {
  kind: GreenDrivingKind;
  rawValue: number | null;
  recordedAtMs: number;
  latitude: number;
  longitude: number;
};

type GreenIo = { id: number; value: number | null };

/** AVL 253: 1 acceleration, 2 braking, 3 cornering. Other values are not events. */
export function teltonikaGreenDriving(record: {
  timestampMs: number;
  latitude: number;
  longitude: number;
  io: readonly GreenIo[];
}): GreenDrivingReading | null {
  const type = record.io.find((item) => item.id === TELTONIKA_GREEN_TYPE_IO && greenKind(item.value));
  const kind = greenKind(type?.value);
  if (!kind) return null;
  const value = record.io.find((item) => item.id === TELTONIKA_GREEN_VALUE_IO && greenRawValue(item.value) !== null)?.value;
  return {
    kind,
    rawValue: greenRawValue(value),
    recordedAtMs: record.timestampMs,
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

/**
 * Teltonika GNSS source: acceleration and braking are g×100.
 * Cornering is rad/s×100. The raw AVL integer is not rewritten.
 */
export function formatGreenDrivingValue(kind: GreenDrivingKind, rawValue: number | null, locale: "tr" | "en" | "ru") {
  if (rawValue === null) return null;
  const text = new Intl.NumberFormat(locale === "en" ? "en-GB" : locale === "ru" ? "ru-RU" : "tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rawValue / 100);
  return `${text} ${kind === "cornering" ? "rad/s" : "g"}`;
}

function greenKind(value: number | null | undefined): GreenDrivingKind | null {
  if (value === 1) return "acceleration";
  if (value === 2) return "braking";
  if (value === 3) return "cornering";
  return null;
}

function greenRawValue(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 65535) return null;
  return value;
}

export function greenDrivingEventError(event: GreenDrivingReading, now: Date, assignedAt: Date | null) {
  if (!Number.isSafeInteger(event.recordedAtMs) || event.recordedAtMs < 1) return "invalid_time";
  if (event.recordedAtMs > now.getTime() + 5 * 60_000) return "future_time";
  if (event.recordedAtMs < now.getTime() - 24 * 60 * 60_000) return "stale_event";
  if (assignedAt && event.recordedAtMs < assignedAt.getTime()) return "before_assignment";
  if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)
    || Math.abs(event.latitude) > 90 || Math.abs(event.longitude) > 180
    || (event.latitude === 0 && event.longitude === 0)) return "invalid_coordinate";
  return null;
}
