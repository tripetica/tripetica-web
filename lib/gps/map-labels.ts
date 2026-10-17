import { gpsPopupText } from "@/lib/gps/map-popup";

export type GpsMapLabelPrefs = {
  plate: boolean;
  driver: boolean;
};

export const GPS_MAP_LABEL_DEFAULTS: GpsMapLabelPrefs = {
  plate: false,
  driver: false,
};

export function gpsMapLabelStorageKey(viewerId: string) {
  return `tripetica.gps.map-labels.${viewerId}`;
}

export function readGpsMapLabelPrefs(raw: string | null): GpsMapLabelPrefs {
  if (!raw) return { ...GPS_MAP_LABEL_DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<GpsMapLabelPrefs>;
    return {
      plate: parsed.plate === true,
      driver: parsed.driver === true,
    };
  } catch {
    return { ...GPS_MAP_LABEL_DEFAULTS };
  }
}

/** One bubble per vehicle. Plate is the first line, the matched driver is the second. */
export function gpsMapLabelLines(
  prefs: GpsMapLabelPrefs,
  fields: { plate?: string | null; driver?: string | null },
) {
  const lines: string[] = [];
  if (prefs.plate) {
    const plate = gpsPopupText(fields.plate);
    if (plate) lines.push(plate);
  }
  if (prefs.driver) {
    const driver = gpsPopupText(fields.driver);
    if (driver) lines.push(driver);
  }
  return lines;
}

export function gpsMapLabelHtml(lines: readonly string[]) {
  return lines.map(escapeLabel).join("<br>");
}

const LABEL_BASE_OFFSET: [number, number] = [0, -16];

/** Nearby labels shift sideways. The vehicle coordinate itself stays put. */
export function gpsMapLabelOffsets(
  pins: readonly { id: string; latitude: number; longitude: number }[],
) {
  const offsets = new Map<string, [number, number]>();
  for (const pin of pins) {
    const group = pins
      .filter((other) => Math.abs(other.latitude - pin.latitude) < 0.0004 && Math.abs(other.longitude - pin.longitude) < 0.0004)
      .sort((left, right) => left.id.localeCompare(right.id));
    if (group.length < 2) {
      offsets.set(pin.id, LABEL_BASE_OFFSET);
      continue;
    }
    const index = group.findIndex((item) => item.id === pin.id);
    offsets.set(pin.id, [(index - (group.length - 1) / 2) * 28, -16 - (index % 2) * 18]);
  }
  return offsets;
}

function escapeLabel(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}
