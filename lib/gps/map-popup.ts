import { type GpsPresence } from "@/lib/gps/presence";

export const GPS_MOTION_HOLD_MS = 180_000;

export type GpsMotion = "moving" | "stopped" | "still" | "unknown";

export type GpsMotionMemory = {
  speedMps: number;
  at: number;
};

export function gpsSpeedIsMoving(speedMps: number | null, wasMoving = false) {
  void speedMps;
  void wasMoving;
  return false;
}

export function gpsResolveMotion(input: {
  speedMps: number | null;
  sampledAt: number | null;
  memory: GpsMotionMemory | null;
  now: number;
  holdMs?: number;
}): { motion: GpsMotion; memory: GpsMotionMemory | null } {
  void input;
  return { motion: "unknown", memory: null };
}

/** Fresh coordinates are still arriving. Older than this, the stream counts as interrupted. */
export const GPS_MAP_FRESH_MS = 2 * 60 * 1000;

/** After the server's last successful fix, the pin stays red until this age, then black. */
export const GPS_MAP_SIGNAL_LOST_MS = 30 * 60 * 1000;

export function gpsMapMarkerState(input: {
  receivedAt: string | null;
  nowMs: number;
  motion: GpsMotion;
}): GpsMarkerState {
  const received = input.receivedAt ? Date.parse(input.receivedAt) : Number.NaN;
  if (!Number.isFinite(received)) return "offline";
  const age = input.nowMs - received;
  if (age < -5 * 60 * 1000 || age > GPS_MAP_SIGNAL_LOST_MS) return "offline";
  if (age > GPS_MAP_FRESH_MS) return "still";
  if (input.motion === "moving") return "moving";
  if (input.motion === "still") return "still";
  if (input.motion === "stopped") return "stopped";
  return "unknown";
}

export function gpsPresenceMarker(presence: GpsPresence, motion: GpsMotion): GpsMarkerState {
  if (presence !== "online") {
    return "offline";
  }
  if (motion === "moving") {
    return "moving";
  }
  if (motion === "stopped") {
    return "stopped";
  }
  if (motion === "still") {
    return "still";
  }
  return "unknown";
}

export type GpsIgnition = "on" | "off" | null;

export type GpsMarkerState = "moving" | "stopped" | "still" | "idle" | "offline" | "ignition-off" | "unknown";

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
  void speedMps;
  void wasMoving;
  if (presence !== "online") {
    return "offline";
  }
  if (ignition === "off") {
    return "ignition-off";
  }
  return "unknown";
}

export function gpsPlaybackMarkerState(speedMps: number | null, gap: boolean, wasMoving = false): GpsMarkerState {
  if (gap) {
    return "unknown";
  }
  return gpsMarkerState("online", speedMps, null, wasMoving);
}
