import "server-only";

import { query } from "@/lib/db/postgres";
import { DRIVE_POINT_LIMIT, type DriveTrackPoint } from "@/lib/gps/drive";
import { corneringDisplayUnit, greenDrivingSource, type GreenDrivingKind } from "@/lib/teltonika/green-driving";

export type VehicleGreenDriving = {
  parserReady: boolean;
  events: {
    at: number;
    kind: GreenDrivingKind;
    rawValue: number | null;
    latitude: number;
    longitude: number;
    corneringUnit: "g" | "rad/s";
  }[];
};

export async function listPartnerVehicleIdentity(partnerId: string) {
  const result = await query<{ id: string; brand: string | null; model: string | null }>(
    `SELECT id, brand, model
       FROM partner_vehicles
      WHERE partner_can_access_vehicle($1, id)
        AND deleted_at IS NULL`,
    [partnerId],
  );
  return new Map(result.rows.map((row) => [row.id, { brand: row.brand, model: row.model }]));
}

export async function readDriveVehicle(partnerId: string, vehicleId: string) {
  const result = await query<{ brand: string | null; model: string | null }>(
    `SELECT brand, model
       FROM partner_vehicles
      WHERE id = $1
        AND partner_can_access_vehicle($2, id)`,
    [vehicleId, partnerId],
  );
  return {
    brand: result.rows[0]?.brand ?? null,
    model: result.rows[0]?.model ?? null,
  };
}

export async function listVehicleGreenDriving(input: {
  partnerId: string;
  vehicleId: string;
  from: Date;
  to: Date;
}): Promise<VehicleGreenDriving> {
  if (!(await canAccessVehicle(input.partnerId, input.vehicleId))) {
    return { parserReady: false, events: [] };
  }
  const ready = await query(
    `SELECT 1
       FROM gps_device_status status
       JOIN gps_devices device ON device.id = status.device_id
      WHERE device.vehicle_id = $2
        AND partner_can_access_gps_device($1, device.id)
        AND device.receiver = 'teltonika'
        AND status.green_driving_parser_at IS NOT NULL
      LIMIT 1`,
    [input.partnerId, input.vehicleId],
  );
  const result = await query<{
    recorded_at: Date;
    kind: string;
    raw_value: number | null;
    latitude: string;
    longitude: string;
  }>(
    `SELECT recorded_at, kind, raw_value, latitude::text AS latitude, longitude::text AS longitude
       FROM (
         SELECT id, recorded_at, kind, raw_value, latitude, longitude, vehicle_id FROM gps_green_driving_events
         UNION ALL
         SELECT id, recorded_at, kind, raw_value, latitude, longitude, vehicle_id FROM gps_green_driving_event_variants
       ) AS events
      WHERE vehicle_id = $1
        AND recorded_at >= $2
        AND recorded_at < $3
      ORDER BY recorded_at DESC, id DESC
      LIMIT 200`,
    [input.vehicleId, input.from.toISOString(), input.to.toISOString()],
  );
  const source = await readGreenDrivingSource(input.vehicleId);
  return {
    parserReady: (ready.rowCount ?? 0) > 0,
    events: result.rows.flatMap((row) => {
      if (row.kind !== "acceleration" && row.kind !== "braking" && row.kind !== "cornering") return [];
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      const at = row.recorded_at.getTime();
      return [{
        at,
        kind: row.kind,
        rawValue: row.raw_value,
        latitude,
        longitude,
        corneringUnit: corneringDisplayUnit({ recordedAtMs: at, source }),
      }];
    }),
  };
}

async function readGreenDrivingSource(vehicleId: string) {
  try {
    const result = await query<{ response_text: string | null }>(
      `SELECT reads.response_text
         FROM gps_teltonika_config_reads reads
         JOIN gps_devices device ON device.id = reads.device_id
        WHERE device.vehicle_id = $1
          AND reads.phase = 'answered'
          AND reads.command_text LIKE 'getparam %'
          AND reads.response_text LIKE '%11007%'
        ORDER BY reads.finished_at DESC NULLS LAST
        LIMIT 1`,
      [vehicleId],
    );
    return greenDrivingSource(result.rows[0]?.response_text ?? null);
  } catch {
    return null;
  }
}

export async function listPhysicalDrivePoints(input: {
  partnerId: string;
  vehicleId: string;
  from: Date;
  to: Date;
}): Promise<{ points: DriveTrackPoint[]; truncated: boolean }> {
  if (!(await canAccessVehicle(input.partnerId, input.vehicleId))) {
    return { points: [], truncated: false };
  }
  const result = await query<{
    id: string;
    recorded_at: Date;
    latitude: string;
    longitude: string;
    speed_mps: string | null;
    ignition: string | null;
  }>(
    `SELECT id::text AS id, recorded_at, latitude::text AS latitude, longitude::text AS longitude,
            speed_mps::text AS speed_mps, ignition
       FROM gps_positions
      WHERE vehicle_id = $1
        AND recorded_at >= $2
        AND recorded_at < $3
      ORDER BY recorded_at ASC, seq ASC
      LIMIT $4`,
    [input.vehicleId, input.from.toISOString(), input.to.toISOString(), DRIVE_POINT_LIMIT + 1],
  );
  const truncated = result.rows.length > DRIVE_POINT_LIMIT;
  const rows = truncated ? result.rows.slice(0, DRIVE_POINT_LIMIT) : result.rows;
  return {
    truncated,
    points: rows.flatMap((row) => {
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      const speed = row.speed_mps === null ? null : Number(row.speed_mps);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [{
        id: row.id,
        at: row.recorded_at.getTime(),
        latitude,
        longitude,
        speedMps: speed !== null && Number.isFinite(speed) ? speed : null,
        ignition: row.ignition === "on" || row.ignition === "off" ? row.ignition : null,
      }];
    }),
  };
}

async function canAccessVehicle(partnerId: string, vehicleId: string) {
  const result = await query<{ allowed: boolean }>(
    `SELECT partner_can_access_vehicle($1, $2) AS allowed`,
    [partnerId, vehicleId],
  );
  return Boolean(result.rows[0]?.allowed);
}
