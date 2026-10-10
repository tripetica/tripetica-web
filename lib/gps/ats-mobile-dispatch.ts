import "server-only";

import { getPool } from "@/lib/db/postgres";
import { atsPlate } from "@/lib/gps/ats-policy";
import { resolveAtsDistrict } from "@/lib/gps/ats-district";
import { ATS_ACTIVE_NOTIFICATION_STATUSES, atsPeriodSlot } from "@/lib/gps/ats-window";
import { mobileAtsBlockReason } from "@/lib/gps/ats-feed";
import { formatAtsKonumZamani } from "@/lib/uetds/ats-soap";
import { postAtsKonumBildir } from "@/lib/uetds/ats-post";
import { isUetdsDriverSubscriptionEntitled } from "@/lib/uetds/driver-subscription";
import { getDriverUetdsSubscription } from "@/lib/uetds/driver-subscription-store";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { uetdsTripTimestamp } from "@/lib/uetds/list-policy";

const SOON_MS = 2 * 60 * 60 * 1000;

type TripRow = {
  id: string;
  ministry_reference: string | null;
  driver_id: string | null;
  vehicle_id: string;
  notification_company_id: string | null;
  plate: string;
  company_id: string;
  company_status: string;
  integration_status: string;
  company_short_name: string | null;
  status: string;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  driver_status: string | null;
  driver_deleted: Date | null;
  service_mobile_gps_enabled: boolean | null;
  physical_live: boolean;
};

type MobileFix = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  recorded_at: Date;
  latitude: number;
  longitude: number;
};

type EligibleTrip = {
  row: TripRow;
  point: MobileFix;
  startMs: number;
};

function logTrip(input: {
  plate: string;
  ref: string | null;
  decision: "send" | "skip" | "failed";
  reason: string;
  gnss?: string;
}) {
  const gnss = input.gnss ? ` gnss=${input.gnss}` : "";
  console.info(
    `ATS mobile trip plate=${input.plate} ref=${input.ref ?? "-"} decision=${input.decision} reason=${input.reason}${gnss}`,
  );
}

/**
 * Ongoing U-ETDS trips on vehicles with no live device.
 * Phone fixes are used as stored. The physical device switch is not required.
 */
export async function dispatchMobileAts(now: Date, runtime: "test" | "live") {
  const pool = getPool();
  const trips = await pool.query<TripRow>(
    `SELECT notification.id,
            notification.ministry_reference,
            notification.driver_id,
            notification.company_id AS notification_company_id,
            vehicle.id AS vehicle_id,
            vehicle.plate,
            company.id AS company_id,
            company.status AS company_status,
            company.integration_status,
            company.short_name AS company_short_name,
            notification.status,
            notification.snapshot->'trip'->>'startDate' AS start_date,
            notification.snapshot->'trip'->>'startTime' AS start_time,
            notification.snapshot->'trip'->>'endDate' AS end_date,
            notification.snapshot->'trip'->>'endTime' AS end_time,
            driver.status AS driver_status,
            driver.deleted_at AS driver_deleted,
            driver.service_mobile_gps_enabled,
            EXISTS (
              SELECT 1
                FROM gps_devices device
               WHERE device.vehicle_id = vehicle.id
                 AND device.status = 'active'
                 AND device.live_source = TRUE
            ) AS physical_live
       FROM uetds_notifications notification
       JOIN partner_vehicles vehicle ON vehicle.id = notification.vehicle_id
       JOIN uetds_companies company ON company.id = vehicle.uetds_company_id
       LEFT JOIN partner_drivers driver ON driver.id = notification.driver_id
      WHERE notification.ministry_env = $1
        AND notification.ministry_reference IS NOT NULL
        AND notification.status = ANY($2::text[])
        AND vehicle.deleted_at IS NULL
        AND COALESCE(notification.snapshot->'trip'->>'startDate', '')
            >= to_char((NOW() AT TIME ZONE 'Europe/Istanbul')::date - 1, 'YYYY-MM-DD')`,
    [runtime, ATS_ACTIVE_NOTIFICATION_STATUSES],
  );
  const byVehicle = new Map<string, TripRow[]>();
  for (const row of trips.rows) {
    const list = byVehicle.get(row.vehicle_id) ?? [];
    list.push(row);
    byVehicle.set(row.vehicle_id, list);
  }
  const positions = byVehicle.size === 0
    ? { rows: [] as MobileFix[] }
    : await pool.query<MobileFix>(
      `SELECT DISTINCT ON (position.vehicle_id, position.driver_id)
              position.id,
              position.vehicle_id,
              position.driver_id,
              position.recorded_at,
              position.latitude,
              position.longitude
         FROM gps_mobile_positions position
        WHERE position.vehicle_id = ANY($1::uuid[])
        ORDER BY position.vehicle_id, position.driver_id, position.recorded_at DESC`,
      [[...byVehicle.keys()]],
    );
  const fixByDriver = new Map<string, MobileFix>();
  for (const point of positions.rows) {
    fixByDriver.set(`${point.vehicle_id}:${point.driver_id}`, point);
  }
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const rows of byVehicle.values()) {
    const outcome = await dispatchVehicleTrips(rows, fixByDriver, now, runtime);
    if (outcome === "sent") sent += 1;
    else if (outcome === "failed") failed += 1;
    else if (outcome === "skipped") skipped += 1;
  }
  return { sent, skipped, failed };
}

async function dispatchVehicleTrips(
  rows: TripRow[],
  fixByDriver: Map<string, MobileFix>,
  now: Date,
  runtime: "test" | "live",
): Promise<"sent" | "failed" | "skipped" | "idle"> {
  const vehicle = rows[0];
  if (!vehicle) return "idle";
  const plate = atsPlate(vehicle.plate, runtime);
  const nowMs = now.getTime();
  const eligible: EligibleTrip[] = [];
  let sawActive = false;
  const subscriptionCache = new Map<string, boolean>();
  for (const row of rows) {
    const startMs = uetdsTripTimestamp(row.start_date ?? "", row.start_time ?? "");
    const endMs = uetdsTripTimestamp(row.end_date ?? "", row.end_time ?? "");
    if (startMs == null || endMs == null || endMs < startMs) continue;
    if (nowMs < startMs) {
      if (startMs - nowMs <= SOON_MS) {
        logTrip({ plate: vehicle.plate, ref: row.ministry_reference, decision: "skip", reason: "trip_not_started" });
      }
      continue;
    }
    if (nowMs >= endMs) continue;
    sawActive = true;
    const reason = await activeTripReason(row, plate, fixByDriver, subscriptionCache, now, startMs, endMs);
    if (reason.kind === "skip") {
      logTrip({ plate: vehicle.plate, ref: row.ministry_reference, decision: "skip", reason: reason.reason });
      continue;
    }
    eligible.push({ row, point: reason.point, startMs });
  }
  if (eligible.length === 0) return sawActive ? "skipped" : "idle";
  eligible.sort((left, right) => right.point.recorded_at.getTime() - left.point.recorded_at.getTime() || right.startMs - left.startMs);
  const chosenPoint = eligible[0]?.point;
  if (!chosenPoint) return "skipped";
  const covered = eligible.filter((item) => item.point.id === chosenPoint.id);
  const held = eligible.filter((item) => item.point.id !== chosenPoint.id);
  for (const item of held) {
    logTrip({
      plate: vehicle.plate,
      ref: item.row.ministry_reference,
      decision: "skip",
      reason: "shared_slot_other_driver",
      gnss: item.point.recorded_at.toISOString(),
    });
  }
  const latitude = Number(chosenPoint.latitude);
  const longitude = Number(chosenPoint.longitude);
  const district = resolveAtsDistrict(latitude, longitude);
  if (!district.ok) {
    for (const item of covered) {
      logTrip({ plate: vehicle.plate, ref: item.row.ministry_reference, decision: "skip", reason: "district_unresolved" });
    }
    return "skipped";
  }
  const slot = atsPeriodSlot(nowMs);
  const pool = getPool();
  const physicalSlot = await pool.query(
    `SELECT id FROM gps_ats_submissions WHERE vehicle_id = $1 AND period_slot = $2 LIMIT 1`,
    [vehicle.vehicle_id, slot],
  );
  if (physicalSlot.rows.length > 0) {
    for (const item of covered) {
      logTrip({ plate: vehicle.plate, ref: item.row.ministry_reference, decision: "skip", reason: "duplicate_physical" });
    }
    return "skipped";
  }
  const chosen = covered.slice().sort((left, right) => right.startMs - left.startMs)[0];
  if (!chosen || !plate) return "skipped";
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO gps_mobile_ats_submissions (
       notification_id, mobile_position_id, ministry_env, status, gnss_time,
       vehicle_id, period_slot, ministry_reference, company_short_name, plate, trip_start, trip_end
     ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (vehicle_id, period_slot) WHERE period_slot IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      chosen.row.id,
      chosenPoint.id,
      runtime,
      chosenPoint.recorded_at,
      vehicle.vehicle_id,
      slot,
      chosen.row.ministry_reference,
      vehicle.company_short_name,
      plate,
      `${chosen.row.start_date ?? ""} ${chosen.row.start_time ?? ""}`.trim(),
      `${chosen.row.end_date ?? ""} ${chosen.row.end_time ?? ""}`.trim(),
    ],
  );
  const submissionId = inserted.rows[0]?.id;
  if (!submissionId) {
    for (const item of covered) {
      logTrip({ plate: vehicle.plate, ref: item.row.ministry_reference, decision: "skip", reason: "slot_already_sent" });
    }
    return "skipped";
  }
  const credentials = await loadUetdsMinistryCredentials(vehicle.company_id);
  if (!credentials || credentials.env !== runtime) {
    await finishMobile(submissionId, { sonucKodu: null, sonucMesaji: runtime === "live" ? "canlı kimlik yok" : "test kimliği yok" });
    for (const item of covered) {
      logTrip({ plate: vehicle.plate, ref: item.row.ministry_reference, decision: "failed", reason: "credentials" });
    }
    return "failed";
  }
  let sonucKodu: number | null = null;
  let sonucMesaji = "";
  try {
    const result = await postAtsKonumBildir({
      username: credentials.username,
      password: credentials.password,
      plate,
      latitude,
      longitude,
      ilKodu: district.ilKodu,
      ilceMernisKodu: district.ilceMernisKodu,
      konumZamani: formatAtsKonumZamani(chosenPoint.recorded_at),
    });
    sonucKodu = result.sonucKodu;
    sonucMesaji = result.sonucMesaji;
  } catch (error) {
    sonucMesaji = error instanceof Error ? error.message : "ats_dispatch_failed";
  }
  await finishMobile(submissionId, { sonucKodu, sonucMesaji });
  const decision = sonucKodu === 0 ? "send" : "failed";
  for (const item of covered) {
    logTrip({
      plate: vehicle.plate,
      ref: item.row.ministry_reference,
      decision,
      reason: sonucKodu === 0 ? "plate_position" : "ministry",
      gnss: chosenPoint.recorded_at.toISOString(),
    });
  }
  return sonucKodu === 0 ? "sent" : "failed";
}

async function activeTripReason(
  row: TripRow,
  plate: string | null,
  fixByDriver: Map<string, MobileFix>,
  subscriptionCache: Map<string, boolean>,
  now: Date,
  startMs: number,
  endMs: number,
): Promise<{ kind: "skip"; reason: string } | { kind: "ready"; point: MobileFix }> {
  if (row.physical_live) return { kind: "skip", reason: "physical_device" };
  if (row.notification_company_id !== row.company_id) return { kind: "skip", reason: "company_mismatch" };
  if (row.company_status !== "active" || row.integration_status !== "ready") {
    return { kind: "skip", reason: "company_not_ready" };
  }
  if (!plate) return { kind: "skip", reason: "plate" };
  if (!row.driver_id || row.driver_deleted || row.driver_status !== "active") {
    return { kind: "skip", reason: "driver_inactive" };
  }
  if (row.service_mobile_gps_enabled !== true) return { kind: "skip", reason: "mobile_service_off" };
  let subscriptionOpen = subscriptionCache.get(row.driver_id);
  if (subscriptionOpen === undefined) {
    try {
      const subscription = await getDriverUetdsSubscription(row.driver_id);
      subscriptionOpen = isUetdsDriverSubscriptionEntitled({
        enrolled: subscription.enrolled,
        periods: subscription.periods,
        now,
      });
    } catch {
      subscriptionOpen = false;
      subscriptionCache.set(row.driver_id, false);
      return { kind: "skip", reason: "subscription_lookup" };
    }
    subscriptionCache.set(row.driver_id, subscriptionOpen);
  }
  const point = fixByDriver.get(`${row.vehicle_id}:${row.driver_id}`) ?? null;
  const block = mobileAtsBlockReason({
    physicalDeviceOnVehicle: false,
    mobileEnabled: true,
    subscriptionOpen,
    measuredAt: point?.recorded_at.toISOString() ?? null,
    nowMs: now.getTime(),
    tripStartMs: startMs,
    tripEndMs: endMs,
    vehicleMatches: true,
    driverMatches: true,
    companyMatches: true,
  });
  if (block || !point) return { kind: "skip", reason: block ?? "fix_missing" };
  return { kind: "ready", point };
}

async function finishMobile(
  submissionId: string,
  result: { sonucKodu: number | null; sonucMesaji: string },
) {
  const status = result.sonucKodu === 0 ? "succeeded" : "failed";
  await getPool().query(
    `UPDATE gps_mobile_ats_submissions
        SET status = $2,
            attempt_count = attempt_count + 1,
            sonuc_kodu = $3,
            sonuc_mesaji = $4,
            last_error = $5,
            submitted_at = CASE WHEN $2 = 'succeeded' THEN NOW() ELSE submitted_at END
      WHERE id = $1`,
    [
      submissionId,
      status,
      result.sonucKodu,
      result.sonucMesaji.slice(0, 500),
      result.sonucKodu === 0 ? null : result.sonucMesaji.slice(0, 500),
    ],
  );
}
