import { parseTeltonikaGetparam, teltonikaParamNumber } from "@/lib/teltonika/config-read";

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
    corneringUnit?: "g" | "rad/s";
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

/** First verified accelerometer-source write, 15 Nov 2026 17:03 Europe/Istanbul. */
export const ACCELEROMETER_CORNERING_FROM_MS = Date.parse("2026-11-15T14:03:00.000Z");

/**
 * Acceleration and braking are always g×100.
 * Cornering is rad/s×100 for a GNSS source and g×100 for an accelerometer source.
 * Events recorded before the verified source change stay rad/s.
 */
export function greenDrivingSource(response: string | null): "gps" | "accelerometer" | null {
  if (!response) return null;
  const source = teltonikaParamNumber(parseTeltonikaGetparam(response)["11007"]);
  if (source === 1) return "accelerometer";
  if (source === 0) return "gps";
  return null;
}

export function corneringDisplayUnit(input: {
  recordedAtMs: number;
  source: "gps" | "accelerometer" | null;
}) {
  if (input.source === "accelerometer" && input.recordedAtMs >= ACCELEROMETER_CORNERING_FROM_MS) return "g" as const;
  return "rad/s" as const;
}

export function formatGreenDrivingValue(
  kind: GreenDrivingKind,
  rawValue: number | null,
  locale: "tr" | "en" | "ru",
  corneringUnit?: "g" | "rad/s",
) {
  if (rawValue === null) return null;
  const text = new Intl.NumberFormat(locale === "en" ? "en-GB" : locale === "ru" ? "ru-RU" : "tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rawValue / 100);
  const unit = kind === "cornering" ? corneringUnit ?? "rad/s" : "g";
  return `${text} ${unit}`;
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
