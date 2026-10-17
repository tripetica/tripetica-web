import "server-only";

import { getPool } from "@/lib/db/postgres";
import { atsPlate } from "@/lib/gps/ats-policy";
import { chooseAtsFixForTrips, type AtsFixChoice } from "@/lib/gps/ats-fix";
import { resolveAtsDistrict } from "@/lib/gps/ats-district";
import { ATS_ACTIVE_NOTIFICATION_STATUSES, atsPeriodSlot } from "@/lib/gps/ats-window";
import { withAtsSlot } from "@/lib/gps/ats-slot";
import { mobileAtsBlockReason } from "@/lib/gps/ats-feed";
import { MOBILE_ATS_MAX_FIX_AGE_MS } from "@/lib/gps/mobile-ats";
import { formatAtsKonumZamani } from "@/lib/uetds/ats-soap";
import { postAtsKonumBildir } from "@/lib/uetds/ats-post";
import { isUetdsDriverSubscriptionEntitled } from "@/lib/uetds/driver-subscription";
import { getVehicleUetdsSubscription } from "@/lib/uetds/vehicle-subscription-store";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { uetdsTripTimestamp } from "@/lib/uetds/list-policy";

const FIX_PAGE = 200;
const FIX_PAGES = 8;

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
  ats_ministry_source: string | null;
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

type StoredFix = MobileFix & {
  measuredAtMs: number;
};

function logTrip(input: {
  plate: string;
  ref: string | null;
  decision: "send" | "skip" | "failed";
  reason: string;
  gnss?: string;
  latitude?: number;
  longitude?: number;
}) {
  const gnss = input.gnss ? ` gnss=${input.gnss}` : "";
  const place = input.latitude != null && input.longitude != null
    ? ` lat=${input.latitude.toFixed(5)} lon=${input.longitude.toFixed(5)}`
    : "";
  console.info(
    `ATS mobile trip plate=${input.plate} ref=${input.ref ?? "-"} decision=${input.decision} reason=${input.reason}${gnss}${place}`,
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
            vehicle.service_mobile_gps_enabled,
            vehicle.ats_ministry_source
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
      if (startMs - nowMs <= MOBILE_ATS_MAX_FIX_AGE_MS) {
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
  const groups = new Map<string, EligibleTrip[]>();
  for (const item of eligible) {
    const list = groups.get(item.point.driver_id) ?? [];
    list.push(item);
    groups.set(item.point.driver_id, list);
  }
  const ranked: Array<{ items: EligibleTrip[]; choice: Extract<AtsFixChoice<StoredFix>, { ok: true }> }> = [];
  for (const items of groups.values()) {
    const choice = await chooseDriverFix(vehicle.vehicle_id, items, nowMs);
    if (!choice.ok) {
      const missed = choice.unresolved[0];
      for (const item of items) {
        logTrip({
          plate: vehicle.plate,
          ref: item.row.ministry_reference,
          decision: "skip",
          reason: choice.reason,
          gnss: missed ? new Date(missed.measuredAtMs).toISOString() : undefined,
          latitude: missed?.latitude,
          longitude: missed?.longitude,
        });
      }
      continue;
    }
    ranked.push({ items, choice });
  }
  if (ranked.length === 0) return "skipped";
  ranked.sort((left, right) =>
    right.choice.point.measuredAtMs - left.choice.point.measuredAtMs
    || Math.max(...right.items.map((item) => item.startMs)) - Math.max(...left.items.map((item) => item.startMs)));
  const winner = ranked[0];
  if (!winner || !plate) return "skipped";
  for (const other of ranked.slice(1)) {
    for (const item of other.items) {
      logTrip({
        plate: vehicle.plate,
        ref: item.row.ministry_reference,
        decision: "skip",
        reason: "shared_slot_other_driver",
        gnss: other.choice.point.recorded_at.toISOString(),
      });
    }
  }
  const missed = winner.choice.unresolved[0];
  const linked = winner.items
    .filter((item) => winner.choice.tripIds.includes(item.row.id))
    .sort((left, right) => left.startMs - right.startMs);
  if (missed) {
    for (const item of linked) {
      logTrip({
        plate: vehicle.plate,
        ref: item.row.ministry_reference,
        decision: "skip",
        reason: "district_unresolved",
        gnss: new Date(missed.measuredAtMs).toISOString(),
        latitude: missed.latitude,
        longitude: missed.longitude,
      });
    }
  }
  for (const item of winner.items) {
    if (winner.choice.tripIds.includes(item.row.id)) continue;
    logTrip({ plate: vehicle.plate, ref: item.row.ministry_reference, decision: "skip", reason: "fix_before_window" });
  }
  const chosenPoint = winner.choice.point;
  const district = winner.choice.district;
  const primary = linked[0];
  if (!primary) return "skipped";
  const slot = atsPeriodSlot(nowMs);
  const pool = getPool();
  const reserved = await withAtsSlot(vehicle.vehicle_id, slot, "mobile", async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO gps_mobile_ats_submissions (
         notification_id, mobile_position_id, ministry_env, status, gnss_time,
         vehicle_id, period_slot, ministry_reference, company_short_name, plate, trip_start, trip_end
       ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (vehicle_id, period_slot) WHERE period_slot IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        primary.row.id,
        chosenPoint.id,
        runtime,
        chosenPoint.recorded_at,
        vehicle.vehicle_id,
        slot,
        primary.row.ministry_reference,
        vehicle.company_short_name,
        plate,
        `${primary.row.start_date ?? ""} ${primary.row.start_time ?? ""}`.trim(),
        `${primary.row.end_date ?? ""} ${primary.row.end_time ?? ""}`.trim(),
      ],
    );
    return inserted.rows[0]?.id ?? null;
  });
  if (!reserved.ok) {
    for (const item of linked) {
      logTrip({ plate: vehicle.plate, ref: item.row.ministry_reference, decision: "skip", reason: "slot_already_sent" });
    }
    return "skipped";
  }
  const submissionId = reserved.value;
  for (const item of linked) {
    await pool.query(
      `INSERT INTO gps_mobile_ats_submission_notifications (submission_id, notification_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [submissionId, item.row.id],
    );
  }
  const credentials = await loadUetdsMinistryCredentials(vehicle.company_id);
  if (!credentials || credentials.env !== runtime) {
    await finishMobile(submissionId, { sonucKodu: null, sonucMesaji: runtime === "live" ? "canlı kimlik yok" : "test kimliği yok" });
    for (const item of linked) {
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
      latitude: chosenPoint.latitude,
      longitude: chosenPoint.longitude,
      ilKodu: district.ilKodu,
      ilceMernisKodu: district.ilceMernisKodu,
      konumZamani: formatAtsKonumZamani(chosenPoint.recorded_at),
    });
    sonucKodu = result.sonucKodu;
    sonucMesaji = result.sonucMesaji;
  } catch (error) {
    sonucMesaji = error instanceof Error ? error.message : "ats_dispatch_failed";
  }
  await finishMobile(submissionId, { sonucKodu, sonucMesaji }, {
    latitude: chosenPoint.latitude,
    longitude: chosenPoint.longitude,
    ilKodu: district.ilKodu,
    ilceMernisKodu: district.ilceMernisKodu,
  });
  const decision = sonucKodu === 0 ? "send" : "failed";
  const reason = sonucKodu === 0
    ? (missed ? "previous_resolved_fix" : "plate_position")
    : "ministry";
  for (const item of linked) {
    logTrip({
      plate: vehicle.plate,
      ref: item.row.ministry_reference,
      decision,
      reason,
      gnss: chosenPoint.recorded_at.toISOString(),
    });
  }
  return sonucKodu === 0 ? "sent" : "failed";
}

async function chooseDriverFix(
  vehicleId: string,
  items: EligibleTrip[],
  nowMs: number,
): Promise<AtsFixChoice<StoredFix>> {
  const driverId = items[0]?.point.driver_id;
  if (!driverId) return { ok: false, reason: "fix_missing", unresolved: [] };
  const floor = new Date(Math.min(...items.map((item) => item.startMs)) - MOBILE_ATS_MAX_FIX_AGE_MS);
  const ceiling = new Date(nowMs + 5 * 60 * 1000 + 1);
  const points: StoredFix[] = [];
  let before = ceiling;
  let choice: AtsFixChoice<StoredFix> = { ok: false, reason: "fix_missing", unresolved: [] };
  for (let page = 0; page < FIX_PAGES; page += 1) {
    const rows = await getPool().query<MobileFix>(
      `SELECT id, vehicle_id, driver_id, recorded_at, latitude, longitude
         FROM gps_mobile_positions
        WHERE vehicle_id = $1
          AND driver_id = $2
          AND recorded_at >= $3
          AND recorded_at < $4
        ORDER BY recorded_at DESC
        LIMIT ${FIX_PAGE}`,
      [vehicleId, driverId, floor, before],
    );
    for (const row of rows.rows) {
      points.push({
        ...row,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        measuredAtMs: row.recorded_at.getTime(),
      });
    }
    choice = chooseAtsFixForTrips({
      pointsNewestFirst: points,
      trips: items.map((item) => ({ id: item.row.id, startMs: item.startMs })),
      nowMs,
      maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
      resolve: (latitude, longitude) => resolveAtsDistrict(latitude, longitude),
    });
    const oldest = rows.rows.at(-1);
    if (choice.ok || !oldest || rows.rows.length < FIX_PAGE) return choice;
    before = oldest.recorded_at;
  }
  return choice;
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
  if (row.ats_ministry_source !== "mobile") return { kind: "skip", reason: "source_not_mobile" };
  if (row.notification_company_id !== row.company_id) return { kind: "skip", reason: "company_mismatch" };
  if (row.company_status !== "active" || row.integration_status !== "ready") {
    return { kind: "skip", reason: "company_not_ready" };
  }
  if (!plate) return { kind: "skip", reason: "plate" };
  if (!row.driver_id || row.driver_deleted || row.driver_status !== "active") {
    return { kind: "skip", reason: "driver_inactive" };
  }
  if (row.service_mobile_gps_enabled !== true) return { kind: "skip", reason: "mobile_service_off" };
  let subscriptionOpen = subscriptionCache.get(row.vehicle_id);
  if (subscriptionOpen === undefined) {
    try {
      const subscription = await getVehicleUetdsSubscription(row.vehicle_id);
      subscriptionOpen = isUetdsDriverSubscriptionEntitled({
        enrolled: subscription.enrolled,
        periods: subscription.periods,
        now,
      });
    } catch {
      subscriptionOpen = false;
      subscriptionCache.set(row.vehicle_id, false);
      return { kind: "skip", reason: "subscription_lookup" };
    }
    subscriptionCache.set(row.vehicle_id, subscriptionOpen);
  }
  const point = fixByDriver.get(`${row.vehicle_id}:${row.driver_id}`) ?? null;
  const block = mobileAtsBlockReason({
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
  sent: { latitude: number; longitude: number; ilKodu: number; ilceMernisKodu: number } | null = null,
) {
  const status = result.sonucKodu === 0 ? "succeeded" : "failed";
  const sentPoint = sent
    && Number.isFinite(sent.latitude)
    && Number.isFinite(sent.longitude)
    && Number.isInteger(sent.ilKodu)
    && Number.isInteger(sent.ilceMernisKodu)
    ? sent
    : null;
  await getPool().query(
    `UPDATE gps_mobile_ats_submissions
        SET status = $2,
            attempt_count = attempt_count + 1,
            sonuc_kodu = $3,
            sonuc_mesaji = $4,
            last_error = $5,
            submitted_at = CASE WHEN $2 = 'succeeded' THEN NOW() ELSE submitted_at END,
            sent_latitude = $6,
            sent_longitude = $7,
            sent_il_kodu = $8,
            sent_ilce_mernis_kodu = $9
      WHERE id = $1`,
    [
      submissionId,
      status,
      result.sonucKodu,
      result.sonucMesaji.slice(0, 500),
      result.sonucKodu === 0 ? null : result.sonucMesaji.slice(0, 500),
      sentPoint ? String(sentPoint.latitude) : null,
      sentPoint ? String(sentPoint.longitude) : null,
      sentPoint ? sentPoint.ilKodu : null,
      sentPoint ? sentPoint.ilceMernisKodu : null,
    ],
  );
}
