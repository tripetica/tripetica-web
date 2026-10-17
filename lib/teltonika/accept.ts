import { pointError, type GpsPoint, type GpsPointError } from "@/lib/gps/contract";
import { type TeltonikaRecord } from "@/lib/teltonika/codec";

export const TELTONIKA_IGNITION_IO = 239;
export const TELTONIKA_DIN1_IO = 1;

export type GpsReceiver = "esp32" | "teltonika";

export function gpsReceiver(value: unknown): GpsReceiver | null {
  if (value === undefined || value === null || value === "" || value === "esp32") return "esp32";
  if (value === "teltonika") return "teltonika";
  return null;
}

export function teltonikaSeq(timestampMs: number, occurrence: number) {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 1) return 0;
  if (!Number.isSafeInteger(occurrence) || occurrence < 0 || occurrence > 9) return 0;
  const seq = timestampMs * 10 + occurrence;
  return Number.isSafeInteger(seq) && seq > 0 ? seq : 0;
}

export function teltonikaSequences(records: readonly TeltonikaRecord[]) {
  const seen = new Map<number, number>();
  return records.map((record) => {
    const occurrence = seen.get(record.timestampMs) ?? 0;
    seen.set(record.timestampMs, occurrence + 1);
    return teltonikaSeq(record.timestampMs, occurrence);
  });
}

export function teltonikaPoint(record: TeltonikaRecord, seq: number, now: Date): { point: GpsPoint } | { error: GpsPointError } {
  const point: GpsPoint = {
    seq,
    gnssTime: new Date(record.timestampMs),
    lat: record.latitude,
    lon: record.longitude,
    speedMps: record.speedKmh / 3.6,
    headingDeg: record.headingDeg,
    altitudeM: record.altitudeM,
    fixMode: "avl",
    satellites: record.satellites,
    hdop: null,
    pdop: null,
    vdop: null,
  };
  const error = pointError(point, now);
  if (error) return { error };
  return { point };
}

export function teltonikaIgnition(record: TeltonikaRecord) {
  const item = record.io.find((io) => io.id === TELTONIKA_IGNITION_IO);
  if (!item || (item.value !== 0 && item.value !== 1)) return null;
  return item.value === 1 ? "on" : "off";
}

/** DIN1 wire. AVL ID 1. This is not ignition IO 239 and not the red power feed. */
export function teltonikaDin1(record: TeltonikaRecord) {
  const item = record.io.find((io) => io.id === TELTONIKA_DIN1_IO);
  if (!item || (item.value !== 0 && item.value !== 1)) return null;
  return item.value === 1 ? "on" as const : "off" as const;
}

export function teltonikaImeiAllowed(input: {
  imei: string;
  receiver: string | null;
  status: string | null;
  trackerModel: string | null;
}) {
  return /^[0-9]{14,16}$/.test(input.imei)
    && input.receiver === "teltonika"
    && input.status === "active"
    && (input.trackerModel === "fmb920" || input.trackerModel === "fmc920");
}
