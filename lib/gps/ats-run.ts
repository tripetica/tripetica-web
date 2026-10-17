import "server-only";

import { getPool } from "@/lib/db/postgres";
import { dispatchMobileAts } from "@/lib/gps/ats-mobile-dispatch";
import { listAtsTripClocks } from "@/lib/gps/ats-trips";
import { planAtsCycle, type AtsTripClock } from "@/lib/gps/ats-window";
import { chooseAtsFixForTrips } from "@/lib/gps/ats-fix";
import { withAtsSlot } from "@/lib/gps/ats-slot";
import { MOBILE_ATS_MAX_FIX_AGE_MS } from "@/lib/gps/mobile-ats";
import { atsPlate, nextAtsAttempt } from "@/lib/gps/ats-policy";
import { resolveAtsDistrict } from "@/lib/gps/ats-district";
import { uetdsTripTimestamp } from "@/lib/uetds/list-policy";
import { formatAtsKonumZamani } from "@/lib/uetds/ats-soap";
import { atsLiveDispatchAllowed, atsMinistryDispatchAllowed, postAtsKonumBildir } from "@/lib/uetds/ats-post";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";

type VehicleRow = {
  vehicle_id: string;
  source_device_id: string;
  plate: string;
  deleted_at: Date | null;
  device_status: string;
  device_vehicle_id: string | null;
  company_id: string;
  company_status: string;
  integration_status: string;
  last_heartbeat_at: Date | null;
  gnss_fix: boolean | null;
};

type PositionRow = {
  id: string;
  device_id: string;
  vehicle_id: string | null;
  recorded_at: Date;
  latitude: number;
  longitude: number;
};

function openAtsRuntime() {
  const runtime = resolveUetdsMinistryRuntime();
  if (runtime === "test" && atsMinistryDispatchAllowed()) {
    return "test" as const;
  }
  if (runtime === "live" && atsLiveDispatchAllowed()) {
    return "live" as const;
  }
  return null;
}

export async function runAtsDispatch(now = new Date()) {
  const runtime = openAtsRuntime();
  if (!runtime) {
    return { sent: 0, skipped: 0, failed: 0, retried: 0 };
  }
  const pool = getPool();
  const vehicles = await pool.query<VehicleRow>(
    `SELECT device.vehicle_id,
            device.id AS source_device_id,
            vehicle.plate,
            vehicle.deleted_at,
            device.status AS device_status,
            device.vehicle_id AS device_vehicle_id,
            company.id AS company_id,
            company.status AS company_status,
            company.integration_status,
            status.last_heartbeat_at,
            status.gnss_fix
     FROM gps_devices device
     JOIN partner_vehicles vehicle ON vehicle.id = device.vehicle_id
     JOIN uetds_companies company ON company.id = vehicle.uetds_company_id
     LEFT JOIN gps_device_status status ON status.device_id = device.id
     WHERE device.status = 'active'
       AND device.live_source = TRUE
       AND vehicle.deleted_at IS NULL
       AND vehicle.service_gps_ats_enabled
       AND vehicle.ats_ministry_source = 'physical'
       AND NOT EXISTS (
         SELECT 1
           FROM gps_ats_settings settings
          WHERE settings.vehicle_id = device.vehicle_id
            AND settings.enabled = FALSE
       )`,
  );
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const vehicle of vehicles.rows) {
    const outcome = await dispatchVehicle(vehicle, now, runtime);
    if (outcome === "sent") sent += 1;
    else if (outcome === "failed") failed += 1;
    else skipped += 1;
  }
  const mobile = await dispatchMobileAts(now, runtime);
  const retried = await retryDueAttempts(now, runtime);
  return {
    sent: sent + mobile.sent,
    skipped: skipped + mobile.skipped,
    failed: failed + mobile.failed,
    retried,
  };
}

async function dispatchVehicle(
  vehicle: VehicleRow,
  now: Date,
  runtime: "test" | "live",
): Promise<"sent" | "failed" | "skipped"> {
  if (vehicle.deleted_at || vehicle.device_status !== "active" || vehicle.device_vehicle_id !== vehicle.vehicle_id) {
    return "skipped";
  }
  if (vehicle.company_status !== "active" || vehicle.integration_status !== "ready") {
    return "skipped";
  }
  const pool = getPool();
  const position = await pool.query<PositionRow>(
    `SELECT id, device_id, vehicle_id, recorded_at, latitude, longitude
     FROM gps_positions
     WHERE device_id = $1 AND vehicle_id = $2
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [vehicle.source_device_id, vehicle.vehicle_id],
  );
  const point = position.rows[0] ?? null;
  const slot = await pool.query<{ id: string }>(
    `SELECT id FROM gps_ats_submissions WHERE vehicle_id = $1 AND period_slot = $2
     UNION ALL
     SELECT id FROM gps_mobile_ats_submissions WHERE vehicle_id = $1 AND period_slot = $2
     LIMIT 1`,
    [vehicle.vehicle_id, Math.floor(now.getTime() / 120_000)],
  );
  const plate = atsPlate(vehicle.plate, runtime);
  if (!plate) {
    return "skipped";
  }
  const trips = await listAtsTripClocks(vehicle.vehicle_id, vehicle.company_id, runtime);
  const plan = planAtsCycle({
    nowMs: now.getTime(),
    enabled: true,
    trips,
    vehicleId: vehicle.vehicle_id,
    companyId: vehicle.company_id,
    plate,
    recordedAt: point?.recorded_at.toISOString() ?? null,
    statusGnssFix: vehicle.gnss_fix,
    heartbeatAt: vehicle.last_heartbeat_at?.toISOString() ?? null,
    slotUsed: slot.rows.length > 0,
  });
  if (!plan.ok || !point) {
    return "skipped";
  }
  const activeTrips = tripStarts(trips, plan.notificationIds);
  const choice = await choosePhysicalFix(vehicle, point, activeTrips, now);
  if (!choice.ok) {
    const missed = choice.unresolved[0];
    console.info(
      `ATS physical plate=${vehicle.plate} decision=skip reason=${choice.reason}${missed ? ` gnss=${new Date(missed.measuredAtMs).toISOString()} lat=${missed.latitude.toFixed(5)} lon=${missed.longitude.toFixed(5)}` : ""}`,
    );
    return "skipped";
  }
  if (choice.unresolved[0]) {
    const missed = choice.unresolved[0];
    console.info(
      `ATS physical plate=${vehicle.plate} decision=skip reason=district_unresolved gnss=${new Date(missed.measuredAtMs).toISOString()} lat=${missed.latitude.toFixed(5)} lon=${missed.longitude.toFixed(5)}`,
    );
  }
  const chosen = choice.point;
  const positionNote = chosen.id === point.id ? plan.positionNote : (plan.positionNote ?? "stale_position");
  const reserved = await withAtsSlot(vehicle.vehicle_id, plan.slot, "physical", async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO gps_ats_submissions (
         position_id, company_id, vehicle_id, device_id, gnss_time,
         ministry_env, status, attempt_count, period_slot, position_note
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, $7, $8)
       ON CONFLICT (vehicle_id, period_slot) WHERE period_slot IS NOT NULL DO NOTHING
       RETURNING id`,
      [chosen.id, vehicle.company_id, vehicle.vehicle_id, vehicle.source_device_id, chosen.recorded_at, runtime, plan.slot, positionNote],
    );
    return inserted.rows[0]?.id ?? null;
  });
  if (!reserved.ok) {
    return "skipped";
  }
  const submissionId = reserved.value;
  for (const notificationId of choice.tripIds) {
    await pool.query(
      `INSERT INTO gps_ats_submission_notifications (submission_id, notification_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [submissionId, notificationId],
    );
    await pool.query(
      `INSERT INTO gps_ats_submission_context (
         submission_id, notification_id, ministry_reference, company_short_name, plate, trip_start, trip_end
       )
       SELECT $1, notification.id, notification.ministry_reference, notification.company_short_name,
              NULLIF(notification.snapshot->'vehicle'->>'plate', ''),
              NULLIF(btrim(concat_ws(' ', notification.snapshot->'trip'->>'startDate', notification.snapshot->'trip'->>'startTime')), ''),
              NULLIF(btrim(concat_ws(' ', notification.snapshot->'trip'->>'endDate', notification.snapshot->'trip'->>'endTime')), '')
         FROM uetds_notifications notification
        WHERE notification.id = $2
       ON CONFLICT (submission_id, notification_id) DO NOTHING`,
      [submissionId, notificationId],
    );
  }
  return sendSubmission({
    submissionId,
    companyId: vehicle.company_id,
    plate,
    latitude: chosen.latitude,
    longitude: chosen.longitude,
    ilKodu: choice.district.ilKodu,
    ilceMernisKodu: choice.district.ilceMernisKodu,
    gnssTime: chosen.recorded_at,
    attemptCount: 0,
    enabled: true,
  });
}

function tripStarts(trips: readonly AtsTripClock[], ids: readonly string[]) {
  const active: Array<{ id: string; startMs: number }> = [];
  for (const trip of trips) {
    if (!ids.includes(trip.id)) continue;
    const startMs = uetdsTripTimestamp(trip.startDate, trip.startTime);
    if (startMs == null) continue;
    active.push({ id: trip.id, startMs });
  }
  return active;
}

function storedFix(point: PositionRow) {
  return {
    ...point,
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
    measuredAtMs: point.recorded_at.getTime(),
  };
}

async function choosePhysicalFix(
  vehicle: VehicleRow,
  latest: PositionRow,
  trips: Array<{ id: string; startMs: number }>,
  now: Date,
) {
  const nowMs = now.getTime();
  const first = chooseAtsFixForTrips({
    pointsNewestFirst: [storedFix(latest)],
    trips,
    nowMs,
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve: (latitude, longitude) => resolveAtsDistrict(latitude, longitude),
  });
  if (first.ok || first.reason !== "district_unresolved") return first;
  const floor = new Date(Math.min(...trips.map((trip) => trip.startMs)) - MOBILE_ATS_MAX_FIX_AGE_MS);
  const points = [storedFix(latest)];
  let before = latest.recorded_at;
  for (let page = 0; page < 8; page += 1) {
    const rows = await getPool().query<PositionRow>(
      `SELECT id, device_id, vehicle_id, recorded_at, latitude, longitude
         FROM gps_positions
        WHERE device_id = $1
          AND vehicle_id = $2
          AND recorded_at >= $3
          AND recorded_at < $4
        ORDER BY recorded_at DESC
        LIMIT 200`,
      [vehicle.source_device_id, vehicle.vehicle_id, floor, before],
    );
    for (const row of rows.rows) points.push(storedFix(row));
    const choice = chooseAtsFixForTrips({
      pointsNewestFirst: points,
      trips,
      nowMs,
      maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
      resolve: (latitude, longitude) => resolveAtsDistrict(latitude, longitude),
    });
    const oldest = rows.rows.at(-1);
    if (choice.ok || !oldest || rows.rows.length < 200) return choice;
    before = oldest.recorded_at;
  }
  return chooseAtsFixForTrips({
    pointsNewestFirst: points,
    trips,
    nowMs,
    maxAgeBeforeStartMs: MOBILE_ATS_MAX_FIX_AGE_MS,
    resolve: (latitude, longitude) => resolveAtsDistrict(latitude, longitude),
  });
}

async function retryDueAttempts(now: Date, runtime: "test" | "live") {
  const due = await getPool().query<{
    id: string;
    company_id: string;
    vehicle_id: string;
    plate: string;
    latitude: number;
    longitude: number;
    gnss_time: Date;
    attempt_count: number;
    period_slot: string | null;
  }>(
    `SELECT submission.id,
            submission.company_id,
            submission.vehicle_id,
            vehicle.plate,
            position.latitude,
            position.longitude,
            submission.gnss_time,
            submission.attempt_count,
            submission.period_slot
     FROM gps_ats_submissions submission
     JOIN gps_devices device
       ON device.id = submission.device_id
      AND device.vehicle_id = submission.vehicle_id
      AND device.status = 'active'
      AND device.live_source = TRUE
     JOIN partner_vehicles vehicle ON vehicle.id = submission.vehicle_id
     JOIN gps_positions position ON position.id = submission.position_id
     WHERE NOT EXISTS (
         SELECT 1
           FROM gps_ats_settings settings
          WHERE settings.vehicle_id = submission.vehicle_id
            AND settings.enabled = FALSE
       )
       AND submission.status = 'failed'
       AND submission.ministry_env = $2
       AND submission.attempt_count < 3
       AND submission.next_attempt_at IS NOT NULL
       AND submission.next_attempt_at <= $1
       AND NOT EXISTS (
         SELECT 1 FROM gps_ats_submissions newer
         WHERE newer.vehicle_id = submission.vehicle_id
           AND newer.period_slot > submission.period_slot
           AND newer.status = 'succeeded'
       )`,
    [now, runtime],
  );
  let retried = 0;
  for (const row of due.rows) {
    const plate = atsPlate(row.plate, runtime);
    if (!plate) {
      continue;
    }
    const trips = await listAtsTripClocks(row.vehicle_id, row.company_id, runtime);
    const active = planAtsCycle({
      nowMs: now.getTime(),
      enabled: true,
      trips,
      vehicleId: row.vehicle_id,
      companyId: row.company_id,
      plate,
      recordedAt: row.gnss_time.toISOString(),
      statusGnssFix: true,
      heartbeatAt: now.toISOString(),
      slotUsed: false,
    });
    if (!active.ok && active.reason !== "duplicate_slot") {
      await getPool().query(
        `UPDATE gps_ats_submissions SET next_attempt_at = NULL, last_error = $2 WHERE id = $1`,
        [row.id, active.reason],
      );
      continue;
    }
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const district = resolveAtsDistrict(latitude, longitude);
    if (!district.ok) {
      continue;
    }
    const outcome = await sendSubmission({
      submissionId: row.id,
      companyId: row.company_id,
      plate,
      latitude,
      longitude,
      ilKodu: district.ilKodu,
      ilceMernisKodu: district.ilceMernisKodu,
      gnssTime: row.gnss_time,
      attemptCount: row.attempt_count,
      enabled: true,
    });
    if (outcome !== "skipped") retried += 1;
  }
  return retried;
}

async function sendSubmission(input: {
  submissionId: string;
  companyId: string;
  plate: string;
  latitude: number;
  longitude: number;
  ilKodu: number;
  ilceMernisKodu: number;
  gnssTime: Date;
  attemptCount: number;
  enabled: boolean;
}): Promise<"sent" | "failed" | "skipped"> {
  const runtime = resolveUetdsMinistryRuntime();
  const credentials = await loadUetdsMinistryCredentials(input.companyId);
  if (!credentials || credentials.env !== runtime) {
    await finish(input, {
      sonucKodu: null,
      sonucMesaji: runtime === "live" ? "canlı kimlik yok" : "test kimliği yok",
    });
    return "failed";
  }
  const plate = atsPlate(input.plate, runtime);
  if (!plate) {
    await finish(input, { sonucKodu: null, sonucMesaji: "plaka canlı gönderime kapalı" });
    return "failed";
  }
  let sonucKodu: number | null = null;
  let sonucMesaji = "";
  try {
    const result = await postAtsKonumBildir({
      username: credentials.username,
      password: credentials.password,
      plate,
      latitude: input.latitude,
      longitude: input.longitude,
      ilKodu: input.ilKodu,
      ilceMernisKodu: input.ilceMernisKodu,
      konumZamani: formatAtsKonumZamani(input.gnssTime),
    });
    sonucKodu = result.sonucKodu;
    sonucMesaji = result.sonucMesaji;
  } catch (error) {
    sonucMesaji = error instanceof Error ? error.message : "ats_dispatch_failed";
  }
  await finish({ ...input, attemptCount: input.attemptCount }, { sonucKodu, sonucMesaji }, {
    latitude: input.latitude,
    longitude: input.longitude,
    ilKodu: input.ilKodu,
    ilceMernisKodu: input.ilceMernisKodu,
  });
  return sonucKodu === 0 ? "sent" : "failed";
}

async function finish(
  input: { submissionId: string; attemptCount: number; enabled: boolean },
  result: { sonucKodu: number | null; sonucMesaji: string },
  sent: { latitude: number; longitude: number; ilKodu: number; ilceMernisKodu: number } | null = null,
) {
  const attemptCount = input.attemptCount + 1;
  const retry = nextAtsAttempt({
    enabled: input.enabled,
    attemptCount,
    sonucKodu: result.sonucKodu,
    now: new Date(),
  });
  const status = result.sonucKodu === 0 ? "succeeded" : "failed";
  const sentPoint = sent
    && Number.isFinite(sent.latitude)
    && Number.isFinite(sent.longitude)
    && Number.isInteger(sent.ilKodu)
    && Number.isInteger(sent.ilceMernisKodu)
    ? sent
    : null;
  await getPool().query(
    `UPDATE gps_ats_submissions
     SET status = $2,
         attempt_count = $3,
         sonuc_kodu = $4,
         sonuc_mesaji = $5,
         last_error = $6,
         submitted_at = CASE WHEN $2 = 'succeeded' THEN NOW() ELSE submitted_at END,
         next_attempt_at = $7,
         sent_latitude = $8,
         sent_longitude = $9,
         sent_il_kodu = $10,
         sent_ilce_mernis_kodu = $11
     WHERE id = $1`,
    [
      input.submissionId,
      status,
      attemptCount,
      result.sonucKodu,
      result.sonucMesaji.slice(0, 500),
      result.sonucKodu === 0 ? null : result.sonucMesaji.slice(0, 500),
      retry.retry ? retry.nextAttemptAt : null,
      sentPoint ? String(sentPoint.latitude) : null,
      sentPoint ? String(sentPoint.longitude) : null,
      sentPoint ? sentPoint.ilKodu : null,
      sentPoint ? sentPoint.ilceMernisKodu : null,
    ],
  );
}
