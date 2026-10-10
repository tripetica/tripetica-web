import "server-only";

import { query } from "@/lib/db/postgres";
import { gpsFleetPoint, type GpsFleetVehicle } from "@/lib/gps/fleet";
import { listMobileRoute, listMobileSessionEvents } from "@/lib/gps/mobile-store";
import { listGpsRecentFixes, type GpsDeviceListItem } from "@/lib/gps/queries";
import { gpsIsLiveMapSource } from "@/lib/gps/registration";

export async function loadOpsMapFleet(devices: readonly GpsDeviceListItem[]): Promise<GpsFleetVehicle[]> {
  const physical = devices.filter((device) => device.partnerId && gpsIsLiveMapSource(device));
  const [drivers, recent, mobile] = await Promise.all([
    listDefaultDriverNames(),
    listGpsRecentFixes(physical.map((device) => device.id)),
    listAllMobileFleet(),
  ]);
  return [
    ...physical.map((device) => {
      const point = gpsFleetPoint(device.latitude, device.longitude);
      return {
        id: device.id,
        plate: device.plate,
        deviceCode: device.deviceCode,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        speedMps: device.speedMps,
        headingDeg: device.headingDeg,
        recordedAt: device.recordedAt,
        lastHeartbeatAt: device.lastHeartbeatAt,
        receivedAt: device.lastHeartbeatAt,
        gnssFix: device.gnssFix,
        satellites: device.satellites,
        recent: recent.get(device.id) ?? [],
        source: "device" as const,
        driverName: device.vehicleId ? drivers.get(device.vehicleId) ?? null : null,
        partnerId: device.partnerId,
        partnerName: device.partnerName,
        trackerModel: device.trackerModel,
        manufacturer: device.manufacturer,
      };
    }),
    ...mobile,
  ];
}

export async function opsMobilePartnerId(sessionId: string) {
  const result = await query<{ partner_id: string }>(
    `SELECT partner_id FROM gps_mobile_sessions WHERE id = $1`,
    [sessionId],
  );
  return result.rows[0]?.partner_id ?? null;
}

export async function loadOpsMobileHistory(input: {
  sessionId: string;
  route?: { from: Date; to: Date } | null;
  events?: { from: Date; to: Date } | null;
}) {
  const partnerId = await opsMobilePartnerId(input.sessionId);
  if (!partnerId) return { route: [], events: [] };
  const [route, events] = await Promise.all([
    input.route
      ? listMobileRoute({ sessionId: input.sessionId, partnerId, from: input.route.from, to: input.route.to })
      : Promise.resolve([]),
    input.events
      ? listMobileSessionEvents(input.sessionId, partnerId, input.events)
      : Promise.resolve([]),
  ]);
  return { route, events };
}

async function listDefaultDriverNames() {
  const result = await query<{ vehicle_id: string; driver_name: string }>(
    `SELECT defaults.vehicle_id,
            trim(driver.first_name || ' ' || driver.last_name) AS driver_name
       FROM partner_fleet_defaults defaults
       JOIN partner_drivers driver ON driver.id = defaults.driver_id
      WHERE driver.deleted_at IS NULL`,
  );
  return new Map(result.rows.map((row) => [row.vehicle_id, row.driver_name]));
}

async function listAllMobileFleet(): Promise<GpsFleetVehicle[]> {
  const result = await query<{
    id: string;
    partner_id: string;
    partner_name: string;
    driver_id: string;
    driver_name: string;
    plate: string | null;
    latitude: number | null;
    longitude: number | null;
    speed_mps: string | null;
    heading_deg: string | null;
    recorded_at: Date | null;
    received_at: Date | null;
    last_stream_at: Date | null;
    accuracy_m: string | null;
  }>(
    `SELECT DISTINCT ON (d.id)
            session.id,
            d.partner_id,
            partner.name AS partner_name,
            d.id AS driver_id,
            trim(d.first_name || ' ' || d.last_name) AS driver_name,
            vehicle.plate,
            position.latitude,
            position.longitude,
            position.speed_mps::text AS speed_mps,
            position.heading_deg::text AS heading_deg,
            position.recorded_at,
            position.received_at,
            session.last_stream_at,
            position.accuracy_m::text AS accuracy_m
       FROM partner_drivers d
       JOIN partners partner ON partner.id = d.partner_id AND partner.deleted_at IS NULL
       JOIN gps_mobile_positions position ON position.driver_id = d.id AND position.partner_id = d.partner_id
       JOIN gps_mobile_sessions session ON session.id = position.session_id
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = position.vehicle_id
      WHERE d.deleted_at IS NULL
        AND d.status = 'active'
        AND d.service_mobile_gps_enabled
        AND position.latitude BETWEEN -90 AND 90
        AND position.longitude BETWEEN -180 AND 180
      ORDER BY d.id, position.recorded_at DESC`,
  );
  const recent = await query<{
    driver_id: string;
    recorded_at: Date;
    latitude: number;
    longitude: number;
    speed_mps: string | null;
  }>(
    `SELECT driver_id, recorded_at, latitude, longitude, speed_mps::text
       FROM (
         SELECT position.driver_id, position.recorded_at, position.latitude, position.longitude, position.speed_mps,
                row_number() OVER (PARTITION BY position.driver_id ORDER BY position.recorded_at DESC) AS n
           FROM gps_mobile_positions position
           JOIN partner_drivers driver ON driver.id = position.driver_id
          WHERE driver.deleted_at IS NULL
            AND driver.status = 'active'
            AND driver.service_mobile_gps_enabled
            AND position.recorded_at > NOW() - INTERVAL '20 minutes'
       ) recent
      WHERE n <= 40
      ORDER BY driver_id, recorded_at`,
  );
  const recentByDriver = new Map<string, { at: number; latitude: number; longitude: number; speedMps: number | null }[]>();
  for (const row of recent.rows) {
    const list = recentByDriver.get(row.driver_id) ?? [];
    list.push({
      at: row.recorded_at.getTime(),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      speedMps: row.speed_mps == null ? null : Number(row.speed_mps),
    });
    recentByDriver.set(row.driver_id, list);
  }
  return result.rows.flatMap((row) => {
    const point = gpsFleetPoint(row.latitude, row.longitude);
    if (!point) return [];
    const recordedAt = row.recorded_at?.toISOString() ?? null;
    const receivedAt = row.received_at?.toISOString() ?? recordedAt;
    const streamAt = row.last_stream_at?.toISOString() ?? receivedAt;
    return [{
      id: row.id,
      plate: row.plate,
      deviceCode: row.driver_name,
      latitude: point.latitude,
      longitude: point.longitude,
      speedMps: row.speed_mps == null ? null : Number(row.speed_mps),
      headingDeg: row.heading_deg == null ? null : Number(row.heading_deg),
      recordedAt,
      receivedAt,
      lastHeartbeatAt: streamAt,
      recent: recentByDriver.get(row.driver_id) ?? [],
      gnssFix: true,
      source: "mobile" as const,
      driverName: row.driver_name,
      accuracyM: row.accuracy_m == null ? null : Number(row.accuracy_m),
      partnerId: row.partner_id,
      partnerName: row.partner_name,
    }];
  });
}
