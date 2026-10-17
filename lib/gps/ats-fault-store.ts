import "server-only";

import { getPool } from "@/lib/db/postgres";
import { type AtsFaultKind } from "@/lib/gps/ats-fault";

export type FaultContext = {
  deviceId: string;
  deviceCode: string;
  imei: string | null;
  vehicleId: string | null;
  plate: string | null;
  partnerId: string | null;
  partnerName: string | null;
  companyId: string | null;
  companyName: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  lastSeenAt: string | null;
  lastGnssAt: string | null;
};

export type FaultRow = {
  id: string;
  vehicleId: string;
  plate: string;
  plateKey: string;
  deviceId: string | null;
  imei: string | null;
  companyId: string | null;
  companyName: string | null;
  driverName: string | null;
  driverPhone: string | null;
  startedAt: string;
  kind: AtsFaultKind;
  description: string;
  ministryStatus: string;
  ministryAcceptedAt: string | null;
  ministryReference: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type AttemptRow = {
  id: string;
  faultId: string;
  attemptedAt: string;
  finishedAt: string | null;
  outcome: string;
  sonucKodu: number | null;
  sonucMesaji: string;
  referenceText: string | null;
};

function iso(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function loadFaultContext(deviceId: string): Promise<FaultContext | null> {
  const result = await getPool().query<{
    id: string;
    device_code: string;
    imei: string | null;
    vehicle_id: string | null;
    plate: string | null;
    partner_id: string | null;
    partner_name: string | null;
    company_id: string | null;
    company_name: string | null;
    driver_id: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    last_seen_at: Date | null;
    recorded_at: Date | null;
  }>(
    `SELECT device.id, device.device_code, device.imei, device.vehicle_id, vehicle.plate,
            device.partner_id, partner.name AS partner_name,
            vehicle.uetds_company_id AS company_id, company.short_name AS company_name,
            driver.id AS driver_id, driver.first_name, driver.last_name, driver.phone,
            status.last_seen_at, status.recorded_at
     FROM gps_devices device
     LEFT JOIN partners partner ON partner.id = device.partner_id
     LEFT JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
     LEFT JOIN uetds_companies company ON company.id = vehicle.uetds_company_id
     LEFT JOIN partner_fleet_defaults fleet ON fleet.vehicle_id = vehicle.id
     LEFT JOIN partner_drivers driver ON driver.id = fleet.driver_id AND driver.deleted_at IS NULL
     LEFT JOIN gps_device_status status ON status.device_id = device.id
     WHERE device.id = $1`,
    [deviceId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const driverName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return {
    deviceId: row.id,
    deviceCode: row.device_code,
    imei: row.imei,
    vehicleId: row.vehicle_id,
    plate: row.plate,
    partnerId: row.partner_id,
    partnerName: row.partner_name,
    companyId: row.company_id,
    companyName: row.company_name,
    driverId: row.driver_id,
    driverName: driverName || null,
    driverPhone: row.phone?.trim() || null,
    lastSeenAt: iso(row.last_seen_at),
    lastGnssAt: iso(row.recorded_at),
  };
}

const FAULT_SELECT = `
  SELECT fault.id, fault.vehicle_id, fault.plate, fault.plate_key, fault.device_id, fault.imei,
         fault.company_id, company.short_name AS company_name,
         fault.driver_name, fault.driver_phone, fault.started_at, fault.kind, fault.description,
         fault.ministry_status, fault.ministry_accepted_at, fault.ministry_reference,
         fault.resolved_at, fault.created_at
  FROM gps_ats_faults fault
  LEFT JOIN uetds_companies company ON company.id = fault.company_id
`;

function mapFault(row: {
  id: string;
  vehicle_id: string;
  plate: string;
  plate_key: string;
  device_id: string | null;
  imei: string | null;
  company_id: string | null;
  company_name: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  started_at: Date;
  kind: AtsFaultKind;
  description: string;
  ministry_status: string;
  ministry_accepted_at: Date | null;
  ministry_reference: string | null;
  resolved_at: Date | null;
  created_at: Date;
}): FaultRow {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    plate: row.plate,
    plateKey: row.plate_key,
    deviceId: row.device_id,
    imei: row.imei,
    companyId: row.company_id,
    companyName: row.company_name,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    startedAt: row.started_at.toISOString(),
    kind: row.kind,
    description: row.description,
    ministryStatus: row.ministry_status,
    ministryAcceptedAt: iso(row.ministry_accepted_at),
    ministryReference: row.ministry_reference,
    resolvedAt: iso(row.resolved_at),
    createdAt: row.created_at.toISOString(),
  };
}

export async function listFaults(input: { vehicleId?: string; limit?: number }) {
  const limit = input.limit ?? 100;
  const result = input.vehicleId
    ? await getPool().query(`${FAULT_SELECT} WHERE fault.vehicle_id = $1 ORDER BY fault.started_at DESC LIMIT $2`, [input.vehicleId, limit])
    : await getPool().query(`${FAULT_SELECT} ORDER BY fault.started_at DESC LIMIT $1`, [limit]);
  return result.rows.map((row) => mapFault(row));
}

export async function listAcceptedStamps(vehicleId: string, plateKey: string) {
  const result = await getPool().query<{ accepted_at: Date }>(
    `SELECT ministry_accepted_at AS accepted_at
     FROM gps_ats_faults
     WHERE ministry_status = 'accepted'
       AND ministry_accepted_at IS NOT NULL
       AND (vehicle_id = $1 OR plate_key = $2)`,
    [vehicleId, plateKey],
  );
  return result.rows.map((row) => ({ acceptedAtMs: row.accepted_at.getTime() }));
}

export async function insertFault(input: {
  vehicleId: string;
  plate: string;
  plateKey: string;
  deviceId: string;
  imei: string | null;
  partnerId: string | null;
  companyId: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  startedAt: Date;
  kind: AtsFaultKind;
  description: string;
  actorId: string;
  ministryStatus?: string;
}) {
  const result = await getPool().query<{ id: string }>(
    `INSERT INTO gps_ats_faults (
       vehicle_id, plate, plate_key, device_id, imei, partner_id, company_id,
       driver_id, driver_name, driver_phone, started_at, kind, description,
       ministry_status, created_by_ops_user_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      input.vehicleId, input.plate, input.plateKey, input.deviceId, input.imei, input.partnerId, input.companyId,
      input.driverId, input.driverName, input.driverPhone, input.startedAt.toISOString(), input.kind, input.description,
      input.ministryStatus ?? "local", input.actorId,
    ],
  );
  return result.rows[0]?.id ?? null;
}

export async function readFault(id: string) {
  const result = await getPool().query(`${FAULT_SELECT} WHERE fault.id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapFault(row) : null;
}

export async function listAttempts(faultId: string): Promise<AttemptRow[]> {
  const result = await getPool().query<{
    id: string;
    fault_id: string;
    attempted_at: Date;
    finished_at: Date | null;
    outcome: string;
    sonuc_kodu: number | null;
    sonuc_mesaji: string | null;
    reference_text: string | null;
  }>(
    `SELECT id, fault_id, attempted_at, finished_at, outcome, sonuc_kodu, sonuc_mesaji, reference_text
     FROM gps_ats_fault_attempts
     WHERE fault_id = $1
     ORDER BY attempted_at ASC`,
    [faultId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    faultId: row.fault_id,
    attemptedAt: row.attempted_at.toISOString(),
    finishedAt: iso(row.finished_at),
    outcome: row.outcome,
    sonucKodu: row.sonuc_kodu,
    sonucMesaji: row.sonuc_mesaji ?? "",
    referenceText: row.reference_text,
  }));
}

export async function listRecentAttempts(limit = 80) {
  const result = await getPool().query<{
    id: string;
    fault_id: string;
    plate: string;
    attempted_at: Date;
    outcome: string;
    sonuc_kodu: number | null;
    sonuc_mesaji: string | null;
    reference_text: string | null;
  }>(
    `SELECT attempt.id, attempt.fault_id, fault.plate, attempt.attempted_at, attempt.outcome,
            attempt.sonuc_kodu, attempt.sonuc_mesaji, attempt.reference_text
     FROM gps_ats_fault_attempts attempt
     JOIN gps_ats_faults fault ON fault.id = attempt.fault_id
     ORDER BY attempt.attempted_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function beginMinistryAttempt(faultId: string, actorId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE gps_ats_fault_attempts
       SET outcome = 'unknown', finished_at = NOW(),
           sonuc_mesaji = COALESCE(sonuc_mesaji, 'Gönderim sonucu alınamadı.')
       WHERE fault_id = $1 AND outcome = 'sending' AND attempted_at < NOW() - INTERVAL '90 seconds'`,
      [faultId],
    );
    const open = await client.query(
      `SELECT id FROM gps_ats_fault_attempts WHERE fault_id = $1 AND outcome = 'sending'`,
      [faultId],
    );
    if ((open.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "sending" };
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO gps_ats_fault_attempts (fault_id, outcome, actor_ops_user_id)
       VALUES ($1, 'sending', $2)
       RETURNING id`,
      [faultId, actorId],
    );
    await client.query("COMMIT");
    return { ok: true as const, attemptId: inserted.rows[0]!.id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function finishMinistryAttempt(input: {
  faultId: string;
  attemptId: string;
  outcome: "accepted" | "rejected" | "unknown" | "withheld";
  sonucKodu: number | null;
  sonucMesaji: string;
  referenceText: string | null;
  rawSafe: string;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE gps_ats_fault_attempts
       SET outcome = $2, finished_at = NOW(), sonuc_kodu = $3, sonuc_mesaji = $4,
           reference_text = $5, raw_safe = $6
       WHERE id = $1 AND outcome = 'sending'`,
      [input.attemptId, input.outcome, input.sonucKodu, input.sonucMesaji.slice(0, 500), input.referenceText, input.rawSafe.slice(0, 4000)],
    );
    if (input.outcome === "accepted") {
      await client.query(
        `UPDATE gps_ats_faults
         SET ministry_status = 'accepted',
             ministry_accepted_at = COALESCE(ministry_accepted_at, NOW()),
             ministry_reference = COALESCE($2, ministry_reference),
             updated_at = NOW()
         WHERE id = $1`,
        [input.faultId, input.referenceText],
      );
    } else {
      await client.query(
        `UPDATE gps_ats_faults
         SET ministry_status = $2, updated_at = NOW()
         WHERE id = $1 AND ministry_status <> 'accepted'`,
        [input.faultId, input.outcome],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markFaultLimited(faultId: string, actorId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO gps_ats_fault_attempts (fault_id, outcome, finished_at, sonuc_mesaji, actor_ops_user_id)
       VALUES ($1, 'limit_blocked', NOW(), '30 günlük bildirim sınırı doldu. Bakanlığa gönderilmedi.', $2)`,
      [faultId, actorId],
    );
    await client.query(
      `UPDATE gps_ats_faults
       SET ministry_status = 'limit_blocked', updated_at = NOW()
       WHERE id = $1 AND ministry_status <> 'accepted'`,
      [faultId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function resolveFault(faultId: string, actorId: string, resolvedAt: Date) {
  const result = await getPool().query(
    `UPDATE gps_ats_faults
     SET resolved_at = $2, resolved_by_ops_user_id = $3, updated_at = NOW()
     WHERE id = $1 AND resolved_at IS NULL`,
    [faultId, resolvedAt.toISOString(), actorId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function hasOpenAcceptedFault(vehicleId: string) {
  const result = await getPool().query(
    `SELECT 1 FROM gps_ats_faults
     WHERE vehicle_id = $1 AND ministry_status = 'accepted' AND resolved_at IS NULL
     LIMIT 1`,
    [vehicleId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function claimAlertDelivery(input: {
  channel: "panel" | "push" | "email";
  kind: "gnss_outage" | "ats_error" | "repair_reminder" | "repair_overdue";
  sourceKey: string;
  slot: string;
  status: "sent" | "failed" | "skipped";
  detail: string;
  plate: string;
  title: string;
  body: string;
  href: string;
}) {
  const result = await getPool().query(
    `INSERT INTO gps_ats_alert_deliveries
       (channel, kind, source_key, slot, status, detail, plate, title, body, href)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (channel, kind, source_key, slot) DO NOTHING
     RETURNING id`,
    [input.channel, input.kind, input.sourceKey, input.slot, input.status, input.detail.slice(0, 300), input.plate, input.title, input.body, input.href],
  );
  return Boolean(result.rows[0]);
}

export async function listPanelAlerts(limit = 40) {
  const result = await getPool().query<{
    id: string;
    kind: string;
    plate: string | null;
    title: string | null;
    body: string | null;
    href: string | null;
    created_at: Date;
    status: string;
  }>(
    `SELECT id, kind, plate, title, body, href, created_at, status
     FROM gps_ats_alert_deliveries
     WHERE channel = 'panel' AND false_alarm = FALSE AND kind <> 'ats_error'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function lastSuccessfulAtsAt(vehicleId: string) {
  const result = await getPool().query<{ submitted_at: Date | null }>(
    `SELECT submitted_at FROM gps_ats_submissions
     WHERE vehicle_id = $1 AND status = 'succeeded'
     ORDER BY submitted_at DESC NULLS LAST
     LIMIT 1`,
    [vehicleId],
  );
  return iso(result.rows[0]?.submitted_at ?? null);
}

export async function sentReminderSlots(faultId: string) {
  const result = await getPool().query<{ slot: string }>(
    `SELECT slot FROM gps_ats_alert_deliveries
     WHERE source_key = $1 AND kind IN ('repair_reminder', 'repair_overdue') AND channel = 'panel'`,
    [faultId],
  );
  return result.rows.map((row) => row.slot);
}
