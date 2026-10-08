import "server-only";

import { getPool } from "@/lib/db/postgres";
import { type GpsAtsPanel } from "@/lib/gps/ats-panel-state";
import { planAtsControl } from "@/lib/gps/ats-policy";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";

export type { GpsAtsPanel };

type DeviceRow = {
  id: string;
  vehicle_id: string | null;
  status: string;
  partner_id: string | null;
  plate: string | null;
  vehicle_partner_id: string | null;
  deleted_at: Date | null;
  company_id: string | null;
  short_name: string | null;
  company_status: string | null;
  integration_status: string | null;
  enabled: boolean | null;
  source_device_id: string | null;
  source_device_code: string | null;
};

type SubmissionRow = {
  status: string;
  sonuc_kodu: number | null;
  sonuc_mesaji: string | null;
  last_error: string | null;
  submitted_at: Date | null;
};

function environment(): GpsAtsPanel["environment"] {
  const runtime = resolveUetdsMinistryRuntime();
  if (runtime === "test" || runtime === "live") {
    return runtime;
  }
  return "unavailable";
}

export async function loadGpsAtsPanel(deviceId: string): Promise<GpsAtsPanel | null> {
  if (!deviceId) {
    return null;
  }
  const result = await getPool().query<DeviceRow>(
    `SELECT device.id,
            device.vehicle_id,
            device.status,
            device.partner_id,
            vehicle.plate,
            vehicle.partner_id AS vehicle_partner_id,
            vehicle.deleted_at,
            company.id AS company_id,
            company.short_name,
            company.status AS company_status,
            company.integration_status,
            settings.enabled,
            settings.source_device_id,
            source.device_code AS source_device_code
     FROM gps_devices device
     LEFT JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
     LEFT JOIN uetds_companies company ON company.id = vehicle.uetds_company_id
     LEFT JOIN gps_ats_settings settings ON settings.vehicle_id = device.vehicle_id
     LEFT JOIN gps_devices source ON source.id = settings.source_device_id
     WHERE device.id = $1`,
    [deviceId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const latest = await getPool().query<SubmissionRow>(
    `SELECT status, sonuc_kodu, sonuc_mesaji, last_error, submitted_at
     FROM gps_ats_submissions
     WHERE device_id = $1
     ORDER BY queued_at DESC
     LIMIT 1`,
    [deviceId],
  );
  const success = await getPool().query<{ submitted_at: Date | null }>(
    `SELECT submitted_at
     FROM gps_ats_submissions
     WHERE device_id = $1 AND status = 'succeeded'
     ORDER BY submitted_at DESC NULLS LAST
     LIMIT 1`,
    [deviceId],
  );
  const last = latest.rows[0] ?? null;
  const enabled = row.enabled === true;
  const sourceIsThisDevice = row.source_device_id === row.id;
  let blockedReason: GpsAtsPanel["blockedReason"] = "none";
  if (!row.vehicle_id || row.deleted_at) {
    blockedReason = "no_vehicle";
  } else if (!row.company_id || row.company_status !== "active" || row.integration_status !== "ready") {
    blockedReason = "no_company";
  } else if (enabled && row.source_device_id && !sourceIsThisDevice) {
    blockedReason = "other_source";
  }
  const response = last
    ? [last.sonuc_kodu === null ? null : String(last.sonuc_kodu), last.sonuc_mesaji].filter(Boolean).join(" · ")
    : "";
  return {
    deviceId: row.id,
    vehicleId: row.vehicle_id,
    companyName: row.short_name,
    enabled,
    sourceDeviceCode: row.source_device_code,
    sourceIsThisDevice,
    blockedReason,
    environment: environment(),
    lastSuccessAt: success.rows[0]?.submitted_at?.toISOString() ?? null,
    lastResponse: response || null,
    lastError: last && last.status !== "succeeded" ? (last.last_error || last.sonuc_mesaji || null) : null,
    warning: enabled && (last?.status ?? "none") !== "succeeded",
  };
}

export async function applyGpsAtsControl(input: {
  deviceId: string;
  enable: boolean;
  actorUserId: string;
  actorAllowed: boolean;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<DeviceRow>(
      `SELECT device.id,
              device.vehicle_id,
              device.status,
              device.partner_id,
              vehicle.plate,
              vehicle.partner_id AS vehicle_partner_id,
              vehicle.deleted_at,
              company.id AS company_id,
              company.short_name,
              company.status AS company_status,
              company.integration_status,
              settings.enabled,
              settings.source_device_id,
              source.device_code AS source_device_code
       FROM gps_devices device
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
       LEFT JOIN uetds_companies company ON company.id = vehicle.uetds_company_id
       LEFT JOIN gps_ats_settings settings ON settings.vehicle_id = device.vehicle_id
       LEFT JOIN gps_devices source ON source.id = settings.source_device_id
       WHERE device.id = $1
       FOR UPDATE OF device`,
      [input.deviceId],
    );
    const row = locked.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "device" };
    }
    if (row.vehicle_id) {
      const setting = await client.query<{ enabled: boolean; source_device_id: string | null }>(
        `SELECT enabled, source_device_id
         FROM gps_ats_settings
         WHERE vehicle_id = $1
         FOR UPDATE`,
        [row.vehicle_id],
      );
      row.enabled = setting.rows[0]?.enabled ?? null;
      row.source_device_id = setting.rows[0]?.source_device_id ?? null;
    }
    const plan = planAtsControl({
      actorAllowed: input.actorAllowed,
      enable: input.enable,
      device: {
        id: row.id,
        vehicleId: row.vehicle_id,
        status: row.status,
        partnerId: row.partner_id,
      },
      vehicle: row.vehicle_id && row.vehicle_partner_id ? {
        id: row.vehicle_id,
        partnerId: row.vehicle_partner_id,
        deleted: Boolean(row.deleted_at),
        companyId: row.company_id,
      } : null,
      companyReady: row.company_status === "active" && row.integration_status === "ready",
      current: row.enabled === null ? null : {
        enabled: row.enabled === true,
        sourceDeviceId: row.source_device_id,
      },
    });
    if (!plan.ok) {
      await client.query("ROLLBACK");
      return plan;
    }
    if (plan.action === "unchanged" || !row.vehicle_id) {
      await client.query("COMMIT");
      return { ok: true as const, action: plan.action };
    }
    await client.query(
      `INSERT INTO gps_ats_settings (vehicle_id, source_device_id, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (vehicle_id) DO UPDATE
       SET source_device_id = EXCLUDED.source_device_id,
           enabled = EXCLUDED.enabled,
           updated_at = NOW()`,
      [row.vehicle_id, plan.sourceDeviceId, plan.action === "enable"],
    );
    await client.query(
      `INSERT INTO gps_ats_control_events (vehicle_id, device_id, action, actor_user_id)
       VALUES ($1, $2, $3, $4)`,
      [row.vehicle_id, row.id, plan.action, input.actorUserId],
    );
    await client.query("COMMIT");
    return { ok: true as const, action: plan.action };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
