import "server-only";

import { getPool } from "@/lib/db/postgres";
import { chooseLivePoint } from "@/lib/gps/backfill";
import { type GpsPoint, type GpsPointError } from "@/lib/gps/contract";

type IngestOk = {
  http: 200;
  accepted: number[];
  duplicate: number[];
  rejected: { seq: number; error: GpsPointError }[];
  ackedThrough: number;
  liveAdvanced: boolean;
};

type IngestDenied = {
  http: 403;
  error: "disabled";
};

export async function ingestTelemetry(
  deviceId: string,
  points: GpsPoint[],
  rejected: { seq: number; error: GpsPointError }[],
): Promise<IngestOk | IngestDenied> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      partner_id: string | null;
      vehicle_id: string | null;
      status: string;
    }>(
      `SELECT id, partner_id, vehicle_id, status
       FROM gps_devices
       WHERE id = $1
         AND deleted_at IS NULL
         AND receiver = 'teltonika'
       FOR UPDATE`,
      [deviceId],
    );
    const device = locked.rows[0];
    if (!device || device.status !== "active") {
      await client.query("ROLLBACK");
      return { http: 403, error: "disabled" };
    }
    const accepted: number[] = [];
    const acceptedPoints: GpsPoint[] = [];
    const duplicate: number[] = [];
    const known = new Set<number>();
    if (points.length > 0) {
      const existing = await client.query<{ seq: string }>(
        `SELECT seq::text AS seq
         FROM gps_positions
         WHERE device_id = $1
           AND seq = ANY($2::bigint[])`,
        [device.id, points.map((point) => point.seq)],
      );
      for (const row of existing.rows) {
        known.add(Number(row.seq));
      }
      for (const point of points) {
        if (known.has(point.seq)) {
          duplicate.push(point.seq);
          continue;
        }
        const inserted = await client.query(
          `INSERT INTO gps_positions (
             device_id, partner_id, vehicle_id, seq, recorded_at,
             latitude, longitude, altitude_m, speed_mps, heading_deg,
             satellites, hdop, pdop, vdop, fix_mode, ignition
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16
           )
           ON CONFLICT (device_id, seq) DO NOTHING`,
          [
            device.id,
            device.partner_id,
            device.vehicle_id,
            point.seq,
            point.gnssTime.toISOString(),
            point.lat,
            point.lon,
            point.altitudeM,
            point.speedMps,
            point.headingDeg,
            point.satellites,
            point.hdop,
            point.pdop,
            point.vdop,
            point.fixMode,
            point.ignition === "on" || point.ignition === "off" ? point.ignition : null,
          ],
        );
        if ((inserted.rowCount ?? 0) === 0) {
          duplicate.push(point.seq);
          known.add(point.seq);
          continue;
        }
        known.add(point.seq);
        accepted.push(point.seq);
        acceptedPoints.push(point);
      }
    }
    const newest = chooseLivePoint(acceptedPoints);
    const cursorRow = await client.query<{ last_contiguous_seq: string }>(
      `SELECT last_contiguous_seq::text AS last_contiguous_seq
       FROM gps_device_status
       WHERE device_id = $1
       FOR UPDATE`,
      [device.id],
    );
    let cursor = Number(cursorRow.rows[0]?.last_contiguous_seq ?? 0);
    for (let step = 0; step < 2000; step += 1) {
      const next = cursor + 1;
      if (!known.has(next)) {
        const found = await client.query(
          `SELECT 1 FROM gps_positions WHERE device_id = $1 AND seq = $2`,
          [device.id, next],
        );
        if ((found.rowCount ?? 0) === 0) {
          break;
        }
      }
      cursor = next;
      known.add(next);
    }
    await client.query(
      `UPDATE gps_device_status
       SET last_seen_at = NOW(),
           last_contiguous_seq = $2,
           updated_at = NOW()
       WHERE device_id = $1`,
      [device.id, cursor],
    );
    let liveAdvanced = false;
    if (newest) {
      const advanced = await client.query(
        `UPDATE gps_device_status
         SET latitude = $2,
             longitude = $3,
             speed_mps = $4,
             heading_deg = $5,
             altitude_m = $6,
             satellites = $7,
             hdop = $8,
             pdop = $9,
             vdop = $10,
             fix_mode = $11,
             gnss_fix = TRUE,
             recorded_at = $12
         WHERE device_id = $1
           AND (recorded_at IS NULL OR recorded_at <= $12)`,
        [
          device.id,
          newest.lat,
          newest.lon,
          newest.speedMps,
          newest.headingDeg,
          newest.altitudeM,
          newest.satellites,
          newest.hdop,
          newest.pdop,
          newest.vdop,
          newest.fixMode,
          newest.gnssTime.toISOString(),
        ],
      );
      liveAdvanced = (advanced.rowCount ?? 0) > 0;
    }
    await client.query("COMMIT");
    return { http: 200, accepted, duplicate, rejected, ackedThrough: cursor, liveAdvanced };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
