import { type GpsPresence } from "@/lib/gps/presence";

export const GPS_MOTION_HOLD_MS = 180_000;

export type GpsMotion = "moving" | "stopped" | "unknown";

export type GpsMotionMemory = {
  speedMps: number;
  at: number;
};

export function gpsSpeedIsMoving(speedMps: number | null, wasMoving = false) {
  if (speedMps === null || !Number.isFinite(speedMps) || speedMps < 0) {
    return wasMoving;
  }
  return speedMps > 0;
}

export function gpsResolveMotion(input: {
  speedMps: number | null;
  sampledAt: number | null;
  memory: GpsMotionMemory | null;
  now: number;
  holdMs?: number;
}): { motion: GpsMotion; memory: GpsMotionMemory | null } {
  const holdMs = input.holdMs ?? GPS_MOTION_HOLD_MS;
  const speed = input.speedMps;
  const known = speed !== null && Number.isFinite(speed) && speed >= 0;
  const age = input.sampledAt === null ? null : input.now - input.sampledAt;
  const fresh = known && age !== null && age >= -60_000 && age <= holdMs;
  if (known && speed === 0) {
    return { motion: "stopped", memory: { speedMps: 0, at: input.sampledAt ?? input.now } };
  }
  if (fresh && speed !== null && speed > 0) {
    return { motion: "moving", memory: { speedMps: speed, at: input.sampledAt ?? input.now } };
  }
  const memory = input.memory;
  if (memory && memory.speedMps === 0) {
    return { motion: "stopped", memory };
  }
  if (memory && memory.speedMps > 0 && input.now - memory.at <= holdMs) {
    return { motion: "moving", memory };
  }
  return { motion: "unknown", memory: null };
}

export function gpsPresenceMarker(presence: GpsPresence, motion: GpsMotion): GpsMarkerState {
  if (presence !== "online") {
    return "idle";
  }
  if (motion === "moving") {
    return "moving";
  }
  if (motion === "stopped") {
    return "stopped";
  }
  return "unknown";
}

export type GpsIgnition = "on" | "off" | null;

export type GpsMarkerState = "moving" | "stopped" | "idle" | "ignition-off" | "unknown";

export type GpsPopupPrefs = {
  speed: boolean;
  clock: boolean;
  coordinates: boolean;
  address: boolean;
};

export const GPS_POPUP_DEFAULTS: GpsPopupPrefs = {
  speed: true,
  clock: true,
  coordinates: true,
  address: false,
};

export function gpsPopupStorageKey(viewerId: string) {
  return `tripetica.gps.popup.${viewerId}`;
}

const POPUP_PLACEHOLDER = /^(?:—|-|unavailable)$/i;

export function gpsPopupText(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || POPUP_PLACEHOLDER.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function gpsPopupRows(
  prefs: GpsPopupPrefs,
  fields: {
    plate: string;
    speed: string | null;
    clock: string | null;
    coordinates: string | null;
    address: string | null;
  },
) {
  const rows: string[] = [];
  const plate = gpsPopupText(fields.plate);
  if (plate) {
    rows.push(plate);
  }
  if (prefs.speed) {
    const speed = gpsPopupText(fields.speed);
    if (speed) rows.push(speed);
  }
  if (prefs.clock) {
    const clock = gpsPopupText(fields.clock);
    if (clock) rows.push(clock);
  }
  if (prefs.coordinates) {
    const coordinates = gpsPopupText(fields.coordinates);
    if (coordinates) rows.push(coordinates);
  }
  if (prefs.address) {
    const address = gpsPopupText(fields.address);
    if (address) rows.push(address);
  }
  return rows;
}

export function readGpsPopupPrefs(raw: string | null): GpsPopupPrefs {
  if (!raw) {
    return { ...GPS_POPUP_DEFAULTS };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<GpsPopupPrefs>;
    return {
      speed: parsed.speed !== false,
      clock: parsed.clock !== false,
      coordinates: parsed.coordinates !== false,
      address: parsed.address === true,
    };
  } catch {
    return { ...GPS_POPUP_DEFAULTS };
  }
}

export function gpsMarkerState(
  presence: GpsPresence,
  speedMps: number | null,
  ignition: GpsIgnition = null,
  wasMoving = false,
): GpsMarkerState {
  if (presence !== "online") {
    return "idle";
  }
  if (ignition === "off") {
    return "ignition-off";
  }
  if (speedMps === null || !Number.isFinite(speedMps) || speedMps < 0) {
    return wasMoving ? "moving" : "unknown";
  }
  if (speedMps > 0) {
    return "moving";
  }
  return "stopped";
}

export function gpsPlaybackMarkerState(speedMps: number | null, gap: boolean, wasMoving = false): GpsMarkerState {
  if (gap) {
    return "idle";
  }
  return gpsMarkerState("online", speedMps, null, wasMoving);
}
