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
  gnssFix?: boolean | null;
  satellites?: number | null;
};

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

export function gpsFleetShowAll(vehicleIds: readonly string[]): GpsFleetSelection {
  if (vehicleIds.length === 1) {
    return { selectedId: vehicleIds[0] ?? null, popupId: null };
  }
  return { selectedId: null, popupId: null };
}

export function gpsFleetHistoryReady(vehicleCount: number, selectedId: string | null) {
  return vehicleCount <= 1 || selectedId !== null;
}

export type GpsFleetPoint = GpsFleetVehicle & {
  latitude: number;
  longitude: number;
};

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
    });
  }
  return vehicles;
}

function numberOrNull(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}
