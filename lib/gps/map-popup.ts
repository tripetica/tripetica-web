import { type GpsPresence } from "@/lib/gps/presence";

export const GPS_MOVING_MPS = 0.5;
export const GPS_MOVING_CLEAR_MPS = 0.3;

export function gpsSpeedIsMoving(speedMps: number | null, wasMoving = false) {
  if (speedMps === null || !Number.isFinite(speedMps)) {
    return false;
  }
  return speedMps >= (wasMoving ? GPS_MOVING_CLEAR_MPS : GPS_MOVING_MPS);
}

export type GpsIgnition = "on" | "off" | null;

export type GpsMarkerState = "moving" | "stopped" | "idle" | "ignition-off";

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
  if (gpsSpeedIsMoving(speedMps, wasMoving)) {
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
