import { getPool } from "@/lib/db/postgres";
import { ingestTelemetry } from "@/lib/gps/ingest";
import { teltonikaDin1, teltonikaIgnition, teltonikaImeiAllowed, teltonikaNewestCoordinate, teltonikaPoint, teltonikaSequences } from "@/lib/teltonika/accept";
import { dout1Readings } from "@/lib/teltonika/immobilizer";
import { greenDrivingEventError, teltonikaGreenDriving, type GreenDrivingReading } from "@/lib/teltonika/green-driving";
import { type TeltonikaPacket } from "@/lib/teltonika/codec";
import { teltonikaDiagnostic, teltonikaErrorCode } from "@/lib/teltonika/diagnostics";

export async function authorizeTeltonikaImei(imei: string) {
  const result = await getPool().query<{ receiver: string; status: string; tracker_model: string | null }>(
    `SELECT receiver, status, tracker_model
     FROM gps_devices
     WHERE imei = $1
       AND deleted_at IS NULL`,
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
  const client = await getPool().connect();
  let stage = "begin";
  const diagnostics: { stage: string; code: string }[] = [];
  try {
    await client.query("BEGIN");
    stage = "device_lock";
    const found = await client.query<{
      id: string;
      receiver: string;
      status: string;
      tracker_model: string | null;
      partner_id: string | null;
      vehicle_id: string | null;
      assigned_at: Date | null;
    }>(
      `SELECT id, receiver, status, tracker_model, partner_id, vehicle_id,
         (SELECT MAX(assigned_at) FROM gps_device_assignments WHERE device_id = gps_devices.id) AS assigned_at
       FROM gps_devices
       WHERE imei = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [imei],
    );
    const device = found.rows[0];
    if (!device || !teltonikaImeiAllowed({
      imei,
      receiver: device.receiver,
      status: device.status,
      trackerModel: device.tracker_model,
    })) {
      await client.query("ROLLBACK");
      return { ack: 0 };
    }
    const sequences = teltonikaSequences(packet.records);
    const points = [];
    const green: GreenDrivingReading[] = [];
    let ignition: "on" | "off" | null = null;
    let din1: "on" | "off" | null = null;
    let gnssFix = false;
    for (let index = 0; index < packet.records.length; index += 1) {
      const record = packet.records[index];
      if (!record) continue;
      const event = teltonikaGreenDriving(record);
      if (event) {
        const reason = greenDrivingEventError(event, now, device.assigned_at);
        if (reason) diagnostics.push({ stage: "green_rejected", code: reason });
        else green.push(event);
      } else if (record.eventId === 253 || record.io.some((io) => io.id === 253)) {
        diagnostics.push({ stage: "green_rejected", code: "invalid_or_missing_type" });
      }
      const seq = sequences[index] ?? 0;
      if (!record || seq < 1) continue;
      const ignitionReading = teltonikaIgnition(record);
      if (ignitionReading) ignition = ignitionReading;
      const din1Reading = teltonikaDin1(record);
      if (din1Reading) din1 = din1Reading;
      const mapped = teltonikaPoint(record, seq, now);
      if ("point" in mapped) {
        points.push(din1Reading ? { ...mapped.point, ignition: din1Reading } : mapped.point);
        gnssFix = true;
      }
    }
    const liveHint = teltonikaNewestCoordinate(packet.records);
    if (points.length > 0) {
      stage = "positions";
      const stored = await ingestTelemetry(device.id, points, [], client);
      if (stored.http !== 200) {
        await client.query("ROLLBACK");
        return { ack: 0 };
      }
      stage = "installation_status";
      await client.query(
        `UPDATE gps_devices AS device
         SET installation_status = 'installed',
             live_source = NOT EXISTS (
               SELECT 1
               FROM gps_devices other
               WHERE other.vehicle_id = device.vehicle_id
                 AND device.vehicle_id IS NOT NULL
                 AND other.id <> device.id
                 AND other.deleted_at IS NULL
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
    stage = "device_status";
    await client.query(
      `UPDATE gps_device_status
       SET last_seen_at = NOW(),
           last_heartbeat_at = NOW(),
           gnss_fix = $2,
           acc_state = CASE WHEN $3::text IS NULL THEN acc_state ELSE $3 END,
           din1_state = CASE WHEN $4::text IS NULL THEN din1_state ELSE $4 END,
           firmware = COALESCE(firmware, 'FMB920'),
           green_driving_parser_at = COALESCE(green_driving_parser_at, NOW()),
           latitude = CASE WHEN $5::float8 IS NOT NULL AND (recorded_at IS NULL OR $10::timestamptz >= recorded_at) THEN $5 ELSE latitude END,
           longitude = CASE WHEN $6::float8 IS NOT NULL AND (recorded_at IS NULL OR $10::timestamptz >= recorded_at) THEN $6 ELSE longitude END,
           speed_mps = CASE WHEN $7::float8 IS NOT NULL AND (recorded_at IS NULL OR $10::timestamptz >= recorded_at) THEN $7 ELSE speed_mps END,
           heading_deg = CASE WHEN $8::float8 IS NOT NULL AND (recorded_at IS NULL OR $10::timestamptz >= recorded_at) THEN $8 ELSE heading_deg END,
           satellites = CASE WHEN $9::int IS NOT NULL AND (recorded_at IS NULL OR $10::timestamptz >= recorded_at) THEN $9 ELSE satellites END,
           recorded_at = CASE WHEN $10::timestamptz IS NOT NULL AND (recorded_at IS NULL OR $10 >= recorded_at) THEN $10 ELSE recorded_at END,
           updated_at = NOW()
       WHERE device_id = $1`,
      [
        device.id,
        gnssFix || Boolean(liveHint),
        ignition,
        din1,
        liveHint?.latitude ?? null,
        liveHint?.longitude ?? null,
        liveHint?.speedMps ?? null,
        liveHint?.headingDeg ?? null,
        liveHint?.satellites ?? null,
        liveHint?.recordedAt.toISOString() ?? null,
      ],
    );
    if (device.partner_id && device.vehicle_id) {
      for (const event of green) {
        stage = "green_insert";
        const inserted = await client.query(
          `INSERT INTO gps_green_driving_events (
             device_id, partner_id, vehicle_id, recorded_at, kind, raw_value, latitude, longitude
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (device_id, recorded_at, kind) DO NOTHING
           RETURNING id`,
          [
            device.id,
            device.partner_id,
            device.vehicle_id,
            new Date(event.recordedAtMs).toISOString(),
            event.kind,
            event.rawValue,
            event.latitude,
            event.longitude,
          ],
        );
        if ((inserted.rowCount ?? 0) > 0) {
          diagnostics.push({ stage: "green_stored", code: event.kind });
          continue;
        }
        // Preserve distinct observations without changing the legacy row or its unique key.
        stage = "green_variant";
        const variant = await client.query(
          `INSERT INTO gps_green_driving_event_variants
             (device_id, partner_id, vehicle_id, recorded_at, kind, raw_value, latitude, longitude)
           SELECT $1, $2, $3, $4, $5, $6, $7, $8
           WHERE EXISTS (
             SELECT 1 FROM gps_green_driving_events
             WHERE device_id = $1 AND recorded_at = $4 AND kind = $5
               AND (raw_value, latitude, longitude) IS DISTINCT FROM ($6::integer, $7::numeric, $8::numeric)
           )
           ON CONFLICT DO NOTHING RETURNING id`,
          [device.id, device.partner_id, device.vehicle_id, new Date(event.recordedAtMs).toISOString(),
            event.kind, event.rawValue, event.latitude, event.longitude],
        );
        diagnostics.push({ stage: (variant.rowCount ?? 0) > 0 ? "green_variant_stored" : "green_duplicate", code: event.kind });
      }
    } else if (green.length > 0) {
      diagnostics.push({ stage: "green_rejected", code: "unassigned_device" });
    }
    const dout = dout1Readings(packet.records);
    if (dout) {
      stage = "dout_status";
      await client.query(
        `INSERT INTO gps_immobilizer_status (device_id, output_state, output_observed_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (device_id) DO UPDATE
         SET output_state = EXCLUDED.output_state,
             output_observed_at = EXCLUDED.output_observed_at,
             updated_at = NOW()`,
        [device.id, dout],
      );
    }
    stage = "commit";
    await client.query("COMMIT");
    for (const item of diagnostics) teltonikaDiagnostic(imei, item.stage, item.code);
    teltonikaDiagnostic(imei, "packet_committed", "ok", packet.records.length);
    return { ack: packet.records.length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    teltonikaDiagnostic(imei, stage, teltonikaErrorCode(error));
    throw error;
  } finally {
    client.release();
  }
}
