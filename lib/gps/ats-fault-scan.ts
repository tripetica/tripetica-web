import "server-only";

import { getPool } from "@/lib/db/postgres";
import {
  ATS_ACTIVE_NOTIFICATION_STATUSES,
  selectActiveAtsTrips,
} from "@/lib/gps/ats-window";
import {
  classifyGpsSubscription,
  gnssCheckpointDecision,
  gnssOutageMail,
  planGnssSuspicion,
  repairReminderDecision,
  repairReminderMail,
} from "@/lib/gps/ats-fault";
import { deliverFaultAlert } from "@/lib/gps/ats-fault-notify";
import {
  hasOpenAcceptedFault,
  listFaults,
  sentReminderSlots,
} from "@/lib/gps/ats-fault-store";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { uetdsTripTimestamp } from "@/lib/uetds/list-policy";

const HREF = "/tr/ops/gps?tab=devices&devices=faults";

export async function scanGpsAtsFaultAlerts(now = new Date()) {
  const dry = process.env.ATS_FAULT_ALERTS === "dry";
  const runtime = resolveUetdsMinistryRuntime();
  const summary = { gnss: 0, reminders: 0, dry };
  if (!runtime) return summary;
  const nowMs = now.getTime();
  await scanTrips(runtime, nowMs, dry, summary);
  await scanReminders(nowMs, dry, summary);
  return summary;
}

async function scanTrips(
  runtime: "test" | "live",
  nowMs: number,
  dry: boolean,
  summary: { gnss: number },
) {
  const trips = await getPool().query<{
    id: string;
    status: string;
    vehicle_id: string;
    company_id: string;
    plate: string | null;
    start_date: string | null;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
  }>(
    `SELECT id, status, vehicle_id, company_id,
            snapshot->'vehicle'->>'plate' AS plate,
            snapshot->'trip'->>'startDate' AS start_date,
            snapshot->'trip'->>'startTime' AS start_time,
            snapshot->'trip'->>'endDate' AS end_date,
            snapshot->'trip'->>'endTime' AS end_time
     FROM uetds_notifications
     WHERE ministry_env = $1
       AND ministry_reference IS NOT NULL
       AND vehicle_id IS NOT NULL
       AND company_id IS NOT NULL
       AND status = ANY($2::text[])`,
    [runtime, ATS_ACTIVE_NOTIFICATION_STATUSES],
  );
  const byVehicle = new Map<string, typeof trips.rows>();
  for (const row of trips.rows) {
    const list = byVehicle.get(row.vehicle_id) ?? [];
    list.push(row);
    byVehicle.set(row.vehicle_id, list);
  }
  for (const [vehicleId, rows] of byVehicle) {
    const plate = rows.find((row) => row.plate)?.plate ?? "";
    const companyId = rows[0]?.company_id;
    if (!companyId || !plate) continue;
    const subscriptionRow = await loadSubscription(vehicleId);
    const subscription = classifyGpsSubscription(subscriptionRow ?? {
      source: null,
      gpsAtsEnabled: null,
      mobileEnabled: null,
    });
    const openGnss = await getPool().query<{ id: string; source_key: string }>(
      `SELECT id, source_key FROM gps_ats_outages
       WHERE vehicle_id = $1 AND kind = 'gnss' AND closed_at IS NULL`,
      [vehicleId],
    );
    if (subscription.kind === "uncertain") {
      console.error(`[gps-ats-fault] subscription unresolved vehicle=${vehicleId} plate=${plate} reason=${subscription.reason}`);
      continue;
    }
    if (subscription.kind === "excluded") {
      for (const outage of openGnss.rows) {
        await closeOutage(outage.id, "subscription_excluded");
      }
      continue;
    }
    const active = selectActiveAtsTrips({
      trips: rows.map((row) => ({
        id: row.id,
        status: row.status,
        vehicleId: row.vehicle_id,
        companyId: row.company_id,
        plate: row.plate,
        startDate: row.start_date ?? "",
        startTime: row.start_time ?? "",
        endDate: row.end_date ?? "",
        endTime: row.end_time ?? "",
      })),
      vehicleId,
      companyId,
      plate,
      nowMs,
    });
    if (!active.ok) {
      if (active.reason === "no_trip") {
        for (const outage of openGnss.rows) {
          await closeOutage(outage.id, "trip_ended");
        }
      }
      continue;
    }
    const device = await getPool().query<{
      id: string;
      recorded_at: Date | null;
      last_seen_at: Date | null;
      last_heartbeat_at: Date | null;
    }>(
      `SELECT device.id, status.recorded_at, status.last_seen_at, status.last_heartbeat_at
       FROM gps_devices device
       LEFT JOIN gps_device_status status ON status.device_id = device.id
       WHERE device.vehicle_id = $1
         AND device.status = 'active'
         AND device.live_source IS TRUE
       ORDER BY status.recorded_at DESC NULLS LAST
       LIMIT 1`,
      [vehicleId],
    );
    const fix = device.rows[0];
    const lastGnssMs = fix?.recorded_at?.getTime() ?? null;
    const lastLinkMs = fix?.last_seen_at?.getTime() ?? fix?.last_heartbeat_at?.getTime() ?? null;
    const ats = await getPool().query<{ submitted_at: Date | null }>(
      `SELECT submitted_at FROM gps_ats_submissions
       WHERE vehicle_id = $1 AND status = 'succeeded'
       ORDER BY submitted_at DESC NULLS LAST
       LIMIT 1`,
      [vehicleId],
    );
    const driver = await driverFor(vehicleId);
    const reported = await hasOpenAcceptedFault(vehicleId);
    const evaluated: Array<{
      tripId: string;
      tripStartMs: number;
      decision: ReturnType<typeof gnssCheckpointDecision>;
      plan: ReturnType<typeof planGnssSuspicion>;
    }> = [];
    for (const tripId of active.notificationIds) {
      const row = rows.find((item) => item.id === tripId);
      if (!row) continue;
      const tripStartMs = uetdsTripTimestamp(row.start_date ?? "", row.start_time ?? "");
      const tripEndMs = uetdsTripTimestamp(row.end_date ?? "", row.end_time ?? "");
      if (tripStartMs == null || tripEndMs == null) {
        console.error(`[gps-ats-fault] trip window unresolved vehicle=${vehicleId} trip=${tripId}`);
        continue;
      }
      const decision = gnssCheckpointDecision({ tripStartMs, tripEndMs, lastGnssMs, nowMs });
      evaluated.push({
        tripId,
        tripStartMs,
        decision,
        plan: planGnssSuspicion({
          subscription,
          activeTrip: true,
          openAcceptedFault: reported,
          decision,
        }),
      });
    }
    if (reported) {
      for (const outage of openGnss.rows) await closeOutage(outage.id, "fault_reported");
    } else if (evaluated.some((item) => item.decision.reason === "fresh")) {
      for (const outage of openGnss.rows) await closeOutage(outage.id, "gnss_restored");
    }
    for (const item of evaluated) {
      if (!item.plan.alert || item.plan.checkpointMs == null) continue;
      const mail = gnssOutageMail({
        plate,
        driverName: driver.name,
        driverPhone: driver.phone,
        tripStartMs: item.tripStartMs,
        checkpointMs: item.plan.checkpointMs,
        lastGnssMs,
        lastLinkMs,
        lastAtsMs: ats.rows[0]?.submitted_at?.getTime() ?? null,
        ageMs: item.decision.ageMs,
        href: HREF,
      });
      const sourceKey = `${vehicleId}:${item.tripId}:${fix?.id ?? "none"}`;
      const result = await deliverFaultAlert({
        kind: "gnss_outage",
        sourceKey,
        slot: String(item.plan.checkpointMs),
        plate,
        title: mail.subject,
        body: mail.text,
        href: HREF,
        dry,
      });
      if (result.delivered) summary.gnss += 1;
      if (!dry) {
        await touchOutage({
          vehicleId,
          plate,
          deviceId: fix?.id ?? null,
          tripId: item.tripId,
          tripStartMs: item.tripStartMs,
          lastGnssMs,
          lastLinkMs,
          lastAtsMs: ats.rows[0]?.submitted_at?.getTime() ?? null,
          sourceKey,
        });
      }
    }
  }
}

async function loadSubscription(vehicleId: string) {
  const result = await getPool().query<{
    ats_ministry_source: string | null;
    service_gps_ats_enabled: boolean | null;
    service_mobile_gps_enabled: boolean | null;
    explicitly_disabled: boolean;
  }>(
    `SELECT vehicle.ats_ministry_source,
            vehicle.service_gps_ats_enabled,
            vehicle.service_mobile_gps_enabled,
            EXISTS (
              SELECT 1 FROM gps_ats_settings settings
              WHERE settings.vehicle_id = vehicle.id AND settings.enabled = FALSE
            ) AS explicitly_disabled
     FROM partner_vehicles vehicle
     WHERE vehicle.id = $1 AND vehicle.deleted_at IS NULL`,
    [vehicleId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    source: row.ats_ministry_source,
    gpsAtsEnabled: row.service_gps_ats_enabled,
    mobileEnabled: row.service_mobile_gps_enabled,
    explicitlyDisabled: row.explicitly_disabled,
  };
}

async function scanReminders(nowMs: number, dry: boolean, summary: { reminders: number }) {
  const faults = await listFaults({ limit: 200 });
  for (const fault of faults) {
    if (fault.ministryStatus !== "accepted" || fault.resolvedAt) continue;
    const slots = await sentReminderSlots(fault.id);
    const decision = repairReminderDecision({
      startedAtMs: Date.parse(fault.startedAt),
      nowMs,
      resolved: false,
      sent48: slots.includes("48h"),
      sentHourKeys: slots.filter((slot) => slot.startsWith("hour:")).map((slot) => slot.slice(5)),
    });
    if (!decision) continue;
    const mail = repairReminderMail({
      plate: fault.plate,
      driverName: fault.driverName,
      driverPhone: fault.driverPhone,
      startedAtMs: Date.parse(fault.startedAt),
      acceptedAtMs: fault.ministryAcceptedAt ? Date.parse(fault.ministryAcceptedAt) : null,
      nowMs,
      overdue: decision.overdue,
      href: HREF,
    });
    const result = await deliverFaultAlert({
      kind: decision.kind,
      sourceKey: fault.id,
      slot: decision.slot,
      plate: fault.plate,
      title: mail.subject,
      body: mail.text,
      href: HREF,
      dry,
    });
    if (result.delivered) summary.reminders += 1;
  }
}

async function driverFor(vehicleId: string) {
  const result = await getPool().query<{ first_name: string; last_name: string; phone: string | null }>(
    `SELECT driver.first_name, driver.last_name, driver.phone
     FROM partner_fleet_defaults fleet
     JOIN partner_drivers driver ON driver.id = fleet.driver_id AND driver.deleted_at IS NULL
     WHERE fleet.vehicle_id = $1`,
    [vehicleId],
  );
  const row = result.rows[0];
  if (!row) return { name: null, phone: null };
  return { name: `${row.first_name} ${row.last_name}`.trim(), phone: row.phone?.trim() || null };
}

async function closeOutage(id: string, reason: string) {
  await getPool().query(
    `UPDATE gps_ats_outages SET closed_at = NOW(), close_reason = $2, updated_at = NOW() WHERE id = $1`,
    [id, reason],
  );
}

async function touchOutage(input: {
  vehicleId: string;
  plate: string;
  deviceId: string | null;
  tripId: string;
  tripStartMs: number;
  lastGnssMs: number | null;
  lastLinkMs: number | null;
  lastAtsMs: number | null;
  sourceKey: string;
}) {
  await getPool().query(
    `INSERT INTO gps_ats_outages (
       vehicle_id, plate, device_id, trip_notification_id, trip_started_at, kind, opened_at,
       last_gnss_at, last_heartbeat_at, last_ats_success_at, source_key
     ) VALUES ($1,$2,$3,$4,$5,'gnss',NOW(),$6,$7,$8,$9)
     ON CONFLICT (kind, source_key) WHERE closed_at IS NULL DO UPDATE
     SET last_gnss_at = EXCLUDED.last_gnss_at,
         last_heartbeat_at = EXCLUDED.last_heartbeat_at,
         last_ats_success_at = EXCLUDED.last_ats_success_at,
         updated_at = NOW()`,
    [
      input.vehicleId,
      input.plate,
      input.deviceId,
      input.tripId,
      new Date(input.tripStartMs).toISOString(),
      input.lastGnssMs == null ? null : new Date(input.lastGnssMs).toISOString(),
      input.lastLinkMs == null ? null : new Date(input.lastLinkMs).toISOString(),
      input.lastAtsMs == null ? null : new Date(input.lastAtsMs).toISOString(),
      input.sourceKey,
    ],
  );
}
