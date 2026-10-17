import { type GpsRecentFix } from "@/lib/gps/live";

export const GPS_FLEET_FOLLOW_ZOOM = 15;
export const GPS_FLEET_GLIDE_MS = 800;

export type GpsFleetVehicle = {
  id: string;
  plate: string | null;
  deviceCode: string;
  latitude: number | null;
  longitude: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  recordedAt: string | null;
  lastHeartbeatAt: string | null;
  receivedAt?: string | null;
  gnssFix?: boolean | null;
  satellites?: number | null;
  recent?: GpsRecentFix[];
  source?: "device" | "mobile";
  vehicleId?: string | null;
  driverName?: string | null;
  accuracyM?: number | null;
  partnerId?: string | null;
  partnerName?: string | null;
  trackerModel?: string | null;
  manufacturer?: "esp32" | "teltonika" | null;
  din1State?: "on" | "off" | null;
  brand?: string | null;
  model?: string | null;
};

export function gpsFleetItemKey(vehicle: { id: string; source?: string | null }) {
  return `${vehicle.source === "mobile" ? "mobile" : "device"}:${vehicle.id}`;
}

export function gpsFleetStoredMarker<T>(
  markers: { get(key: string): T | undefined },
  pinId: string,
  markerKey?: string | null,
): T | undefined {
  if (markerKey) {
    const keyed = markers.get(markerKey);
    if (keyed !== undefined) return keyed;
  }
  return markers.get(pinId);
}

export type GpsFleetSelection = {
  selectedId: string | null;
  popupId: string | null;
};

export function gpsFleetOpening(vehicleIds: readonly string[]): GpsFleetSelection {
  if (vehicleIds.length === 1) {
    return { selectedId: vehicleIds[0] ?? null, popupId: null };
  }
  return { selectedId: null, popupId: null };
}

export function gpsFleetMarkerClick(state: GpsFleetSelection, vehicleId: string): GpsFleetSelection {
  if (state.selectedId === vehicleId && state.popupId === vehicleId) {
    return { selectedId: vehicleId, popupId: null };
  }
  return { selectedId: vehicleId, popupId: vehicleId };
}

export function gpsFleetPopupClosed(state: GpsFleetSelection): GpsFleetSelection {
  return { selectedId: state.selectedId, popupId: null };
}

export function gpsFleetHistoryReady(vehicleCount: number, selectedId: string | null) {
  return vehicleCount <= 1 || selectedId !== null;
}

export function partnerGpsFocus(input: {
  devices: readonly { id: string; vehicleId: string | null }[];
  mobile: readonly { id: string; vehicleId: string | null }[];
  requestedId: string | null;
}): { deviceId: string | null; mobileId: string | null } {
  const requestedDevice = input.devices.find((device) => device.id === input.requestedId);
  if (requestedDevice) return { deviceId: requestedDevice.id, mobileId: null };
  const requestedMobile = input.mobile.find((vehicle) => vehicle.id === input.requestedId);
  if (requestedMobile) return { deviceId: null, mobileId: requestedMobile.id };

  const vehicleIds = new Set<string>();
  for (const device of input.devices) {
    if (device.vehicleId) vehicleIds.add(device.vehicleId);
  }
  for (const vehicle of input.mobile) {
    if (vehicle.vehicleId) vehicleIds.add(vehicle.vehicleId);
  }
  const unassigned = [
    ...input.devices.filter((device) => !device.vehicleId).map((device) => ({ kind: "device" as const, id: device.id })),
    ...input.mobile.filter((vehicle) => !vehicle.vehicleId).map((vehicle) => ({ kind: "mobile" as const, id: vehicle.id })),
  ];
  if (vehicleIds.size + unassigned.length !== 1) return { deviceId: null, mobileId: null };
  if (vehicleIds.size === 1) {
    const vehicleId = [...vehicleIds][0];
    const device = input.devices.find((item) => item.vehicleId === vehicleId);
    if (device) return { deviceId: device.id, mobileId: null };
    const mobile = input.mobile.find((item) => item.vehicleId === vehicleId);
    return { deviceId: null, mobileId: mobile?.id ?? null };
  }
  const only = unassigned[0];
  if (!only) return { deviceId: null, mobileId: null };
  return only.kind === "device"
    ? { deviceId: only.id, mobileId: null }
    : { deviceId: null, mobileId: only.id };
}

export type GpsFleetPoint = GpsFleetVehicle & {
  latitude: number;
  longitude: number;
};

export function gpsMarkerIdentity(input: {
  plate: string | null | undefined;
  deviceCode?: string | null;
  source?: string | null;
  fallback: string;
}) {
  const plate = input.plate?.trim();
  if (plate) return plate;
  if (input.source !== "mobile") {
    const code = input.deviceCode?.trim();
    if (code) return code;
  }
  return input.fallback;
}

export function gpsFleetPoint(
  latitude: number | null,
  longitude: number | null,
): { latitude: number; longitude: number } | null {
  if (latitude === null || longitude === null) {
    return null;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

export function gpsFleetPlotted(vehicles: readonly GpsFleetVehicle[]): GpsFleetPoint[] {
  const plotted: GpsFleetPoint[] = [];
  for (const vehicle of vehicles) {
    const point = gpsFleetPoint(vehicle.latitude, vehicle.longitude);
    if (!point) {
      continue;
    }
    plotted.push({ ...vehicle, latitude: point.latitude, longitude: point.longitude });
  }
  return plotted;
}

export function gpsFleetUnlocated(vehicles: readonly GpsFleetVehicle[]) {
  const plotted = new Set(gpsFleetPlotted(vehicles).map((vehicle) => vehicle.id));
  return vehicles.filter((vehicle) => !plotted.has(vehicle.id));
}

export function gpsFleetFrame(points: readonly { latitude: number; longitude: number }[]) {
  if (points.length === 0) {
    return { kind: "empty" as const };
  }
  if (points.length === 1) {
    return { kind: "single" as const, point: points[0], zoom: GPS_FLEET_FOLLOW_ZOOM };
  }
  return { kind: "bounds" as const, points };
}

export function gpsFleetPadding(viewportWidth: number): [number, number] {
  return viewportWidth <= 720 ? [16, 16] : [24, 24];
}

export function gpsFleetIdsChanged(previous: readonly string[], next: readonly string[]) {
  if (previous.length !== next.length) {
    return true;
  }
  const left = [...previous].sort();
  const right = [...next].sort();
  return left.some((id, index) => id !== right[index]);
}

export function gpsFleetKeepSelection(
  selectedId: string | null,
  vehicles: readonly GpsFleetVehicle[],
) {
  if (!selectedId) {
    return null;
  }
  const vehicle = vehicles.find((item) => item.id === selectedId);
  if (!vehicle || !gpsFleetPoint(vehicle.latitude, vehicle.longitude)) {
    return null;
  }
  return selectedId;
}

export function readGpsFleet(body: unknown): GpsFleetVehicle[] | null {
  if (!body || typeof body !== "object" || !("vehicles" in body) || !Array.isArray(body.vehicles)) {
    return null;
  }
  const vehicles: GpsFleetVehicle[] = [];
  for (const item of body.vehicles) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.deviceCode !== "string") {
      return null;
    }
    const point = gpsFleetPoint(numberOrNull(row.latitude), numberOrNull(row.longitude));
    vehicles.push({
      id: row.id,
      plate: typeof row.plate === "string" ? row.plate : null,
      deviceCode: row.deviceCode,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      speedMps: numberOrNull(row.speedMps),
      headingDeg: numberOrNull(row.headingDeg),
      recordedAt: typeof row.recordedAt === "string" ? row.recordedAt : null,
      lastHeartbeatAt: typeof row.lastHeartbeatAt === "string" ? row.lastHeartbeatAt : null,
      gnssFix: row.gnssFix === true ? true : row.gnssFix === false ? false : null,
      satellites: numberOrNull(row.satellites),
      recent: readRecent(row.recent),
      source: row.source === "mobile" ? "mobile" : "device",
      vehicleId: typeof row.vehicleId === "string" ? row.vehicleId : null,
      driverName: typeof row.driverName === "string" ? row.driverName : null,
      accuracyM: numberOrNull(row.accuracyM),
      partnerId: typeof row.partnerId === "string" ? row.partnerId : null,
      partnerName: typeof row.partnerName === "string" ? row.partnerName : null,
      trackerModel: typeof row.trackerModel === "string" ? row.trackerModel : null,
      manufacturer: row.manufacturer === "esp32" || row.manufacturer === "teltonika" ? row.manufacturer : null,
      din1State: row.din1State === "on" || row.din1State === "off" ? row.din1State : null,
      brand: optionalText(row, "brand"),
      model: optionalText(row, "model"),
    });
  }
  return vehicles;
}

export function mergeGpsFleetIdentity(
  previous: readonly GpsFleetVehicle[] | undefined,
  next: readonly GpsFleetVehicle[],
): GpsFleetVehicle[] {
  const prior = new Map((previous ?? []).map((vehicle) => [gpsFleetItemKey(vehicle), vehicle]));
  return next.map((vehicle) => {
    const earlier = prior.get(gpsFleetItemKey(vehicle));
    if (!earlier) return { ...vehicle };
    return {
      ...vehicle,
      vehicleId: vehicle.vehicleId || earlier.vehicleId || null,
      brand: vehicle.brand !== undefined ? vehicle.brand : (earlier.brand ?? null),
      model: vehicle.model !== undefined ? vehicle.model : (earlier.model ?? null),
    };
  });
}

function optionalText(row: Record<string, unknown>, key: "brand" | "model") {
  if (!(key in row)) return undefined;
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRecent(value: unknown): GpsRecentFix[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const fixes: GpsRecentFix[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const row = item as Record<string, unknown>;
    if (typeof row.at !== "number" || typeof row.latitude !== "number" || typeof row.longitude !== "number") return undefined;
    if (row.speedMps !== null && typeof row.speedMps !== "number") return undefined;
    fixes.push({
      at: row.at,
      latitude: row.latitude,
      longitude: row.longitude,
      speedMps: row.speedMps === null ? null : row.speedMps,
    });
  }
  return fixes;
}

function numberOrNull(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}
