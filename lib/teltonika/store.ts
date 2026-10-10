import { getPool } from "@/lib/db/postgres";
import { ingestTelemetry } from "@/lib/gps/ingest";
import {
  teltonikaIgnition,
  teltonikaImeiAllowed,
  teltonikaPoint,
  teltonikaSequences,
} from "@/lib/teltonika/accept";
import { dout1Readings } from "@/lib/teltonika/immobilizer";
import { type TeltonikaPacket } from "@/lib/teltonika/codec";

export async function authorizeTeltonikaImei(imei: string) {
  const result = await getPool().query<{ receiver: string; status: string; tracker_model: string | null }>(
    `SELECT receiver, status, tracker_model
     FROM gps_devices
     WHERE imei = $1`,
    [imei],
  );
  const row = result.rows[0];
  return teltonikaImeiAllowed({
    imei,
    receiver: row?.receiver ?? null,
    status: row?.status ?? null,
    trackerModel: row?.tracker_model ?? null,
  });
}

export async function storeTeltonikaPacket(imei: string, packet: TeltonikaPacket, now = new Date()) {
  const found = await getPool().query<{ id: string; receiver: string; status: string; tracker_model: string | null }>(
    `SELECT id, receiver, status, tracker_model
     FROM gps_devices
     WHERE imei = $1`,
    [imei],
  );
  const device = found.rows[0];
  if (!device || !teltonikaImeiAllowed({
    imei,
    receiver: device.receiver,
    status: device.status,
    trackerModel: device.tracker_model,
  })) {
    return { ack: 0 };
  }
  const sequences = teltonikaSequences(packet.records);
  const points = [];
  let ignition: "on" | "off" | null = null;
  let gnssFix = false;
  for (let index = 0; index < packet.records.length; index += 1) {
    const record = packet.records[index];
    const seq = sequences[index] ?? 0;
    if (!record || seq < 1) continue;
    const ignitionReading = teltonikaIgnition(record);
    if (ignitionReading) ignition = ignitionReading;
    const mapped = teltonikaPoint(record, seq, now);
    if ("point" in mapped) {
      points.push(mapped.point);
      gnssFix = true;
    }
  }
  if (points.length > 0) {
    const stored = await ingestTelemetry(device.id, points, []);
    if (stored.http !== 200) return { ack: 0 };
    await getPool().query(
      `UPDATE gps_devices AS device
       SET installation_status = 'installed',
           live_source = NOT EXISTS (
             SELECT 1
             FROM gps_devices other
             WHERE other.vehicle_id = device.vehicle_id
               AND device.vehicle_id IS NOT NULL
               AND other.id <> device.id
               AND other.status = 'active'
               AND other.live_source
           ),
           updated_at = NOW()
       WHERE device.id = $1
         AND device.receiver = 'teltonika'
         AND device.installation_status = 'pending'`,
      [device.id],
    );
  }
  await getPool().query(
    `UPDATE gps_device_status
     SET last_seen_at = NOW(),
         last_heartbeat_at = NOW(),
         gnss_fix = $2,
         acc_state = CASE WHEN $3::text IS NULL THEN acc_state ELSE $3 END,
         firmware = COALESCE(firmware, 'FMB920'),
         updated_at = NOW()
     WHERE device_id = $1`,
    [device.id, gnssFix, ignition],
  );
  const dout = dout1Readings(packet.records);
  if (dout) {
    await getPool().query(
      `INSERT INTO gps_immobilizer_status (device_id, output_state, output_observed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (device_id) DO UPDATE
       SET output_state = EXCLUDED.output_state,
           output_observed_at = EXCLUDED.output_observed_at,
           updated_at = NOW()`,
      [device.id, dout],
    );
  }
  return { ack: packet.records.length };
}
