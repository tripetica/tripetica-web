import "server-only";

import { type PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";
import { sendPartnerMail } from "@/lib/partner/mail";
import { sendPartnerPushToSubscriptions } from "@/lib/partner/push/send";
import { listActivePartnerPushSubscriptionsForPartner } from "@/lib/partner/push/subscriptions";
import { maintenanceDriverNotice, maintenanceEmail } from "@/lib/gps/maintenance-mail";
import { uniquePushEndpoints } from "@/lib/gps/mobile-reminders";
import type { PartnerPushSubscriptionRecord } from "@/lib/partner/push/subscriptions";
import {
  foldMaintenanceDistance,
  istanbulMaintenanceDate,
  maintenanceDeliveryPlan,
  maintenanceDistanceSource,
  maintenanceFigures,
  maintenanceLockKey,
  maintenanceNormalizeEmail,
  maintenanceNoticeDue,
  maintenancePartnerRecipients,
  maintenancePositionSql,
  type MaintenanceCursor,
  type MaintenanceError,
  type MaintenanceEventKind,
  type MaintenanceHistoryItem,
  type MaintenanceLine,
  type MaintenanceLocale,
  type MaintenanceNoticeItem,
  type MaintenanceSnapshot,
  type MaintenanceTrackPoint,
} from "@/lib/gps/maintenance";

type ProfileRow = {
  vehicle_id: string;
  partner_id: string;
  cycle_id: string;
  start_km: number;
  interval_km: number;
  last_service_km: number;
  last_service_on: string;
  verified_km: number;
  verified_at: Date;
  distance_m: string;
  cursor_at: Date | null;
  cursor_latitude: number | null;
  cursor_longitude: number | null;
  cursor_point_id: string | null;
  cursor_ignition: "on" | "off" | null;
  distance_source: "physical" | "mobile" | null;
  distance_gap: boolean;
};

const PROFILE_SQL = `SELECT vehicle_id, partner_id, cycle_id::text, start_km, interval_km, last_service_km,
            last_service_on::text, verified_km, verified_at, distance_m::text,
            cursor_at, cursor_latitude, cursor_longitude, cursor_point_id, cursor_ignition, distance_source, distance_gap
       FROM vehicle_maintenance`;

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export function maintenanceDeliveryEnabled() {
  if (process.env.MAINTENANCE_DELIVER === "no") return false;
  if (process.env.MAINTENANCE_DELIVER === "yes") return true;
  return process.env.NODE_ENV === "production";
}

async function withMaintenanceLock<T>(vehicleId: string, run: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [maintenanceLockKey(vehicleId)]);
    const value = await run(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ownedVehicle(client: PoolClient, vehicleId: string, partnerId: string) {
  const result = await client.query<{ id: string }>(
    `SELECT id
       FROM partner_vehicles
      WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL
      FOR UPDATE`,
    [vehicleId, partnerId],
  );
  return result.rows[0]?.id ?? null;
}

async function readProfile(client: PoolClient, vehicleId: string, partnerId: string) {
  const result = await client.query<ProfileRow>(
    `${PROFILE_SQL} WHERE vehicle_id = $1 AND partner_id = $2 FOR UPDATE`,
    [vehicleId, partnerId],
  );
  return result.rows[0] ?? null;
}

async function readHistory(client: PoolClient, vehicleId: string, partnerId: string): Promise<MaintenanceHistoryItem[]> {
  const result = await client.query<{
    id: string;
    kind: MaintenanceEventKind;
    odometer_km: number;
    service_on: string | null;
    interval_km: number | null;
    actor_email: string | null;
    created_at: Date;
  }>(
    `SELECT event.id::text, event.kind, event.odometer_km, event.service_on::text, event.interval_km,
            users.email AS actor_email, event.created_at
       FROM vehicle_maintenance_events event
       LEFT JOIN partner_users users
         ON users.id = event.actor_user_id
        AND users.partner_id = event.partner_id
      WHERE event.vehicle_id = $1 AND event.partner_id = $2
      ORDER BY event.created_at DESC
      LIMIT 50`,
    [vehicleId, partnerId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    odometerKm: row.odometer_km,
    serviceOn: row.service_on,
    intervalKm: row.interval_km,
    actorEmail: row.actor_email,
    createdAt: row.created_at.toISOString(),
  }));
}

async function readNotices(client: PoolClient, vehicleId: string, partnerId: string): Promise<MaintenanceNoticeItem[]> {
  const result = await client.query<{
    threshold_km: number;
    created_at: Date;
    driver_title: string | null;
    driver_body_text: string | null;
  }>(
    `SELECT threshold_km, created_at, driver_title, driver_body_text
       FROM vehicle_maintenance_notices
      WHERE vehicle_id = $1 AND partner_id = $2
      ORDER BY created_at DESC
      LIMIT 20`,
    [vehicleId, partnerId],
  );
  return result.rows.map((row) => ({
    thresholdKm: row.threshold_km,
    createdAt: row.created_at.toISOString(),
    driverTitle: row.driver_title,
    driverBody: row.driver_body_text,
  }));
}

function snapshotFrom(row: ProfileRow, today: string, history: MaintenanceHistoryItem[], notices: MaintenanceNoticeItem[]): MaintenanceSnapshot {
  const figures = maintenanceFigures({
    verifiedKm: row.verified_km,
    distanceM: Number(row.distance_m),
    lastServiceKm: row.last_service_km,
    intervalKm: row.interval_km,
  });
  return {
    started: true,
    vehicleId: row.vehicle_id,
    today,
    startKm: row.start_km,
    verifiedKm: row.verified_km,
    verifiedAt: row.verified_at.toISOString(),
    estimatedKm: figures.estimatedKm,
    lastServiceKm: row.last_service_km,
    lastServiceOn: row.last_service_on,
    intervalKm: row.interval_km,
    nextServiceKm: figures.nextServiceKm,
    remainingKm: figures.remainingKm,
    line: figures.line,
    gap: row.distance_gap,
    history,
    notices,
  };
}

async function loadSnapshot(client: PoolClient, row: ProfileRow, today: string) {
  const [history, notices] = await Promise.all([
    readHistory(client, row.vehicle_id, row.partner_id),
    readNotices(client, row.vehicle_id, row.partner_id),
  ]);
  return snapshotFrom(row, today, history, notices);
}

function cursorOf(row: ProfileRow): MaintenanceCursor | null {
  if (!row.cursor_at && row.cursor_latitude === null) return null;
  return {
    at: row.cursor_at?.getTime() ?? row.verified_at.getTime(),
    latitude: row.cursor_latitude,
    longitude: row.cursor_longitude,
    pointId: row.cursor_point_id,
    ignition: row.cursor_ignition === "on" || row.cursor_ignition === "off" ? row.cursor_ignition : null,
  };
}

async function activePhysical(client: PoolClient, vehicleId: string, partnerId: string) {
  const result = await client.query<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM gps_devices device
        WHERE device.vehicle_id = $1
          AND device.partner_id = $2
          AND device.status = 'active'
     ) AS present`,
    [vehicleId, partnerId],
  );
  return result.rows[0]?.present === true;
}

async function readPoints(client: PoolClient, row: ProfileRow, source: "physical" | "mobile", after: Date) {
  const result = await client.query<{ id: string; recorded_at: Date; latitude: string; longitude: string; ignition: string | null }>(
    maintenancePositionSql(source),
    [row.partner_id, row.vehicle_id, after.toISOString()],
  );
  return result.rows.flatMap((point): MaintenanceTrackPoint[] => {
    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{
      id: point.id,
      at: point.recorded_at.getTime(),
      latitude,
      longitude,
      ignition: source === "physical" && (point.ignition === "on" || point.ignition === "off") ? point.ignition : null,
    }];
  });
}

async function catchUpLocked(client: PoolClient, row: ProfileRow, now: Date) {
  const source = maintenanceDistanceSource(await activePhysical(client, row.vehicle_id, row.partner_id));
  let working = row;
  if (row.distance_source && row.distance_source !== source) {
    const switched = await client.query<ProfileRow>(
      `UPDATE vehicle_maintenance
          SET distance_source = $3,
              cursor_at = $4,
              cursor_latitude = NULL,
              cursor_longitude = NULL,
              cursor_point_id = NULL,
              cursor_ignition = NULL,
              distance_gap = TRUE,
              updated_at = NOW()
        WHERE vehicle_id = $1 AND partner_id = $2
        RETURNING vehicle_id, partner_id, cycle_id::text, start_km, interval_km, last_service_km,
                  last_service_on::text, verified_km, verified_at, distance_m::text,
                  cursor_at, cursor_latitude, cursor_longitude, cursor_point_id, cursor_ignition, distance_source, distance_gap`,
      [row.vehicle_id, row.partner_id, source, now.toISOString()],
    );
    working = switched.rows[0] ?? row;
  }
  const after = working.cursor_at ?? working.verified_at;
  const folded = foldMaintenanceDistance({
    cursor: cursorOf(working),
    points: await readPoints(client, working, source, after),
    nowMs: now.getTime(),
    useIgnition: source === "physical",
  });
  const updated = await client.query<ProfileRow>(
    `UPDATE vehicle_maintenance
        SET distance_m = distance_m + $3,
            cursor_at = $4,
            cursor_latitude = $5,
            cursor_longitude = $6,
            cursor_point_id = $7,
            distance_source = $8,
            distance_gap = distance_gap OR $9,
            cursor_ignition = $10,
            updated_at = NOW()
      WHERE vehicle_id = $1 AND partner_id = $2
      RETURNING vehicle_id, partner_id, cycle_id::text, start_km, interval_km, last_service_km,
                last_service_on::text, verified_km, verified_at, distance_m::text,
                cursor_at, cursor_latitude, cursor_longitude, cursor_point_id, cursor_ignition, distance_source, distance_gap`,
    [
      working.vehicle_id,
      working.partner_id,
      Math.round(folded.addedMeters),
      folded.cursor ? new Date(folded.cursor.at).toISOString() : working.cursor_at?.toISOString() ?? null,
      folded.cursor?.latitude ?? null,
      folded.cursor?.longitude ?? null,
      folded.cursor?.pointId ?? null,
      source,
      folded.gap,
      folded.cursor?.ignition === "on" || folded.cursor?.ignition === "off" ? folded.cursor.ignition : null,
    ],
  );
  return updated.rows[0] ?? working;
}

export async function syncVehicleMaintenance(vehicleId: string, partnerId: string, locale: MaintenanceLocale, now = new Date()) {
  const today = istanbulMaintenanceDate(now);
  const snapshot = await withMaintenanceLock(vehicleId, async (client) => {
    const vehicle = await ownedVehicle(client, vehicleId, partnerId);
    if (!vehicle) return null;
    const row = await readProfile(client, vehicleId, partnerId);
    if (!row) return { started: false as const, vehicleId, today };
    const caught = await catchUpLocked(client, row, now);
    return loadSnapshot(client, caught, today);
  });
  if (snapshot && snapshot.started && maintenanceDeliveryEnabled()) {
    await deliverVehicleMaintenanceNotice(vehicleId, partnerId, locale, now);
    return withMaintenanceLock(vehicleId, async (client) => {
      const row = await readProfile(client, vehicleId, partnerId);
      if (!row) return { started: false as const, vehicleId, today };
      return loadSnapshot(client, row, today);
    });
  }
  return snapshot;
}

async function partnerEmails(partnerId: string) {
  const owners = await getPool().query<{ email: string }>(
    `SELECT users.email
       FROM partner_users users
       JOIN partners partner ON partner.id = users.partner_id
      WHERE users.partner_id = $1
        AND users.status = 'active'
        AND users.is_owner = TRUE
        AND partner.status = 'active'
        AND partner.deleted_at IS NULL`,
    [partnerId],
  );
  if (owners.rows.length > 0) return maintenancePartnerRecipients(owners.rows.map((row) => row.email));
  const users = await getPool().query<{ email: string }>(
    `SELECT users.email
       FROM partner_users users
       JOIN partners partner ON partner.id = users.partner_id
      WHERE users.partner_id = $1
        AND users.status = 'active'
        AND partner.status = 'active'
        AND partner.deleted_at IS NULL`,
    [partnerId],
  );
  return maintenancePartnerRecipients(users.rows.map((row) => row.email));
}

type DriverNoticeCopy = {
  title: string;
  body: string;
  subject: string;
  text: string;
  html: string;
};

type ClaimedNotice = {
  id: string;
  title: string;
  bodyText: string;
  bodyHtml: string;
  driverId: string | null;
  driver: DriverNoticeCopy | null;
  plate: string;
  line: MaintenanceLine;
  estimatedKm: number;
  lastServiceKm: number;
  nextServiceKm: number;
  remainingKm: number;
};

type AssignedDriver = {
  id: string;
  email: string | null;
  firstName: string | null;
};

function claimedDriver(row: {
  driver_id: string | null;
  driver_title: string | null;
  driver_body_text: string | null;
  driver_email_subject: string | null;
  driver_email_text: string | null;
  driver_email_html: string | null;
}): DriverNoticeCopy | null {
  if (!row.driver_title || !row.driver_body_text || !row.driver_email_subject || !row.driver_email_text || !row.driver_email_html) {
    return null;
  }
  return {
    title: row.driver_title,
    body: row.driver_body_text,
    subject: row.driver_email_subject,
    text: row.driver_email_text,
    html: row.driver_email_html,
  };
}

async function claimNotice(vehicleId: string, partnerId: string, locale: MaintenanceLocale, now: Date): Promise<ClaimedNotice | null> {
  return withMaintenanceLock(vehicleId, async (client) => {
    const row = await readProfile(client, vehicleId, partnerId);
    if (!row) return null;
    const figures = maintenanceFigures({
      verifiedKm: row.verified_km,
      distanceM: Number(row.distance_m),
      lastServiceKm: row.last_service_km,
      intervalKm: row.interval_km,
    });
    const sent = await client.query<{ threshold_km: number }>(
      `SELECT threshold_km
         FROM vehicle_maintenance_notices
        WHERE vehicle_id = $1 AND cycle_id = $2 AND emailed_at IS NOT NULL`,
      [vehicleId, row.cycle_id],
    );
    const due = maintenanceNoticeDue(figures.remainingKm, new Set(sent.rows.map((item) => item.threshold_km)));
    const vehicle = await client.query<{
      plate: string;
      brand: string | null;
      model: string | null;
      driver_id: string | null;
      driver_name: string | null;
      driver_first_name: string | null;
      driver_phone: string | null;
    }>(
      `SELECT vehicle.plate, vehicle.brand, vehicle.model,
              driver.id::text AS driver_id,
              NULLIF(trim(concat_ws(' ', driver.first_name, driver.last_name)), '') AS driver_name,
              NULLIF(trim(driver.first_name), '') AS driver_first_name,
              driver.phone AS driver_phone
         FROM partner_vehicles vehicle
         LEFT JOIN partner_fleet_defaults pairing
           ON pairing.vehicle_id = vehicle.id AND pairing.partner_id = vehicle.partner_id
         LEFT JOIN partner_drivers driver
           ON driver.id = pairing.driver_id
          AND driver.partner_id = vehicle.partner_id
          AND driver.deleted_at IS NULL
        WHERE vehicle.id = $1 AND vehicle.partner_id = $2 AND vehicle.deleted_at IS NULL`,
      [vehicleId, partnerId],
    );
    const context = vehicle.rows[0];
    if (!context) return null;
    const driverCopy = context.driver_id
      ? maintenanceDriverNotice({
          locale,
          line: figures.line,
          plate: context.plate,
          firstName: context.driver_first_name,
          estimatedKm: figures.estimatedKm,
          lastServiceKm: row.last_service_km,
          nextServiceKm: figures.nextServiceKm,
          remainingKm: figures.remainingKm,
        })
      : null;
    const snapshot = {
      plate: context.plate,
      line: figures.line,
      estimatedKm: figures.estimatedKm,
      lastServiceKm: row.last_service_km,
      nextServiceKm: figures.nextServiceKm,
      remainingKm: figures.remainingKm,
    };
    if (due === null) {
      const pending = await client.query<{
        id: string;
        title: string;
        body_text: string;
        body_html: string;
        driver_id: string | null;
        driver_title: string | null;
        driver_body_text: string | null;
        driver_email_subject: string | null;
        driver_email_text: string | null;
        driver_email_html: string | null;
      }>(
        `UPDATE vehicle_maintenance_notices
            SET claimed_at = NOW()
          WHERE id = (
            SELECT id
              FROM vehicle_maintenance_notices
             WHERE vehicle_id = $1
               AND partner_id = $2
               AND cycle_id = $3
               AND emailed_at IS NULL
               AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes')
             ORDER BY created_at
             LIMIT 1
          )
          RETURNING id::text, title, body_text, body_html, driver_id::text,
                    driver_title, driver_body_text, driver_email_subject, driver_email_text, driver_email_html`,
        [vehicleId, partnerId, row.cycle_id],
      );
      const pendingRow = pending.rows[0];
      return pendingRow
        ? {
            id: pendingRow.id,
            title: pendingRow.title,
            bodyText: pendingRow.body_text,
            bodyHtml: pendingRow.body_html,
            driverId: pendingRow.driver_id,
            driver: claimedDriver(pendingRow),
            ...snapshot,
          }
        : null;
    }
    const mail = maintenanceEmail({
      locale,
      line: figures.line,
      thresholdKm: due,
      plate: context.plate,
      brand: context.brand,
      model: context.model,
      driverName: context.driver_name,
      driverPhone: context.driver_phone,
      estimatedKm: figures.estimatedKm,
      lastServiceKm: row.last_service_km,
      lastServiceOn: row.last_service_on,
      intervalKm: row.interval_km,
      nextServiceKm: figures.nextServiceKm,
      remainingKm: figures.remainingKm,
    });
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO vehicle_maintenance_notices (
         vehicle_id, partner_id, cycle_id, threshold_km, title, body_text, body_html, claimed_at,
         driver_id, driver_title, driver_body_text, driver_email_subject, driver_email_text, driver_email_html
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13)
       ON CONFLICT (vehicle_id, cycle_id, threshold_km) DO NOTHING
       RETURNING id::text AS id`,
      [
        vehicleId,
        partnerId,
        row.cycle_id,
        due,
        mail.subject,
        mail.text,
        mail.html,
        context.driver_id,
        driverCopy?.title ?? null,
        driverCopy?.body ?? null,
        driverCopy?.subject ?? null,
        driverCopy?.text ?? null,
        driverCopy?.html ?? null,
      ],
    );
    if (inserted.rows[0]) {
      return {
        id: inserted.rows[0].id,
        title: mail.subject,
        bodyText: mail.text,
        bodyHtml: mail.html,
        driverId: context.driver_id,
        driver: driverCopy,
        ...snapshot,
      };
    }
    const claimed = await client.query<{
      id: string;
      title: string;
      body_text: string;
      body_html: string;
      driver_id: string | null;
      driver_title: string | null;
      driver_body_text: string | null;
      driver_email_subject: string | null;
      driver_email_text: string | null;
      driver_email_html: string | null;
    }>(
      `UPDATE vehicle_maintenance_notices
          SET claimed_at = NOW()
        WHERE vehicle_id = $1 AND partner_id = $2 AND cycle_id = $3 AND threshold_km = $4
          AND emailed_at IS NULL
          AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes')
        RETURNING id::text, title, body_text, body_html, driver_id::text,
                  driver_title, driver_body_text, driver_email_subject, driver_email_text, driver_email_html`,
      [vehicleId, partnerId, row.cycle_id, due],
    );
    const claimedRow = claimed.rows[0];
    return claimedRow
      ? {
          id: claimedRow.id,
          title: claimedRow.title,
          bodyText: claimedRow.body_text,
          bodyHtml: claimedRow.body_html,
          driverId: claimedRow.driver_id,
          driver: claimedDriver(claimedRow),
          ...snapshot,
        }
      : null;
  });
}

async function finishNotice(id: string, delivered: boolean) {
  if (delivered) {
    await getPool().query(
      `UPDATE vehicle_maintenance_notices SET emailed_at = NOW() WHERE id = $1`,
      [id],
    );
    return;
  }
  await getPool().query(
    `UPDATE vehicle_maintenance_notices SET claimed_at = NULL WHERE id = $1 AND emailed_at IS NULL`,
    [id],
  );
}

async function assignedMaintenanceDriver(vehicleId: string, partnerId: string): Promise<AssignedDriver | null> {
  const result = await getPool().query<{ id: string; email: string | null; first_name: string | null }>(
    `SELECT driver.id::text AS id, driver.email, NULLIF(trim(driver.first_name), '') AS first_name
       FROM partner_fleet_defaults pairing
       JOIN partner_drivers driver
         ON driver.id = pairing.driver_id
        AND driver.partner_id = pairing.partner_id
        AND driver.deleted_at IS NULL
      WHERE pairing.vehicle_id = $1
        AND pairing.partner_id = $2`,
    [vehicleId, partnerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, firstName: row.first_name };
}

async function storeDriverNotice(id: string, driverId: string, copy: DriverNoticeCopy) {
  await getPool().query(
    `UPDATE vehicle_maintenance_notices
        SET driver_id = $2,
            driver_title = $3,
            driver_body_text = $4,
            driver_email_subject = $5,
            driver_email_text = $6,
            driver_email_html = $7
      WHERE id = $1`,
    [id, driverId, copy.title, copy.body, copy.subject, copy.text, copy.html],
  );
}

async function partnerUserEmails(partnerId: string) {
  const result = await getPool().query<{ id: string; email: string | null }>(
    `SELECT id::text, email
       FROM partner_users
      WHERE partner_id = $1
        AND status = 'active'`,
    [partnerId],
  );
  const emails = new Map<string, string>();
  for (const row of result.rows) {
    const email = maintenanceNormalizeEmail(row.email);
    if (email) emails.set(row.id, email);
  }
  return emails;
}

async function driverPushSubscriptions(partnerId: string, driverId: string): Promise<PartnerPushSubscriptionRecord[]> {
  const result = await getPool().query<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT endpoint, p256dh, auth
       FROM driver_push_subscriptions
      WHERE driver_id = $1
        AND partner_id = $2
        AND disabled_at IS NULL`,
    [driverId, partnerId],
  );
  return result.rows.map((row, index) => ({
    id: `driver-${index}`,
    partner_id: partnerId,
    partner_user_id: driverId,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    locale: "tr" as const,
    is_primary_partner: false,
    rank: 0 as const,
  }));
}

export async function deliverVehicleMaintenanceNotice(vehicleId: string, partnerId: string, locale: MaintenanceLocale, now = new Date()) {
  const claimed = await claimNotice(vehicleId, partnerId, locale, now);
  if (!claimed) return { sent: false as const };
  const driver = await assignedMaintenanceDriver(vehicleId, partnerId);
  let driverNotice = claimed.driver;
  if (driver && (driver.id !== claimed.driverId || !driverNotice)) {
    driverNotice = maintenanceDriverNotice({
      locale,
      line: claimed.line,
      plate: claimed.plate,
      firstName: driver.firstName,
      estimatedKm: claimed.estimatedKm,
      lastServiceKm: claimed.lastServiceKm,
      nextServiceKm: claimed.nextServiceKm,
      remainingKm: claimed.remainingKm,
    });
    await storeDriverNotice(claimed.id, driver.id, driverNotice);
  }
  if (!driver) driverNotice = null;
  const plan = maintenanceDeliveryPlan({
    partnerEmails: await partnerEmails(partnerId),
    driverEmail: driver?.email ?? null,
  });
  let partnerDelivered = plan.partnerEmails.length === 0;
  for (const email of plan.partnerEmails) {
    const mailed = await sendPartnerMail({
      to: email,
      subject: claimed.title,
      text: claimed.bodyText,
      html: claimed.bodyHtml,
    });
    if (mailed.ok) partnerDelivered = true;
  }
  let driverDelivered = !plan.driverEmail;
  if (plan.driverEmail && driverNotice) {
    const mailed = await sendPartnerMail({
      to: plan.driverEmail,
      subject: driverNotice.subject,
      text: driverNotice.text,
      html: driverNotice.html,
    });
    driverDelivered = mailed.ok;
  }
  try {
    const subscriptions = await listActivePartnerPushSubscriptionsForPartner(partnerId);
    const userEmails = await partnerUserEmails(partnerId);
    const samePersonIds = new Set(
      [...userEmails.entries()].filter(([, email]) => email === plan.driverEmail).map(([id]) => id),
    );
    const partnerTargets = plan.driverEmail
      ? subscriptions.filter((subscription) => !samePersonIds.has(subscription.partner_user_id))
      : subscriptions;
    if (partnerTargets.length > 0) {
      await sendPartnerPushToSubscriptions(
        partnerTargets,
        (subscription) => ({
          kind: "vehicle-maintenance",
          title: claimed.title,
          body: claimed.bodyText.split("\n").find((line) => line.trim().length > 20) ?? claimed.title,
          icon: "/icon.png",
          badge: "/icon.png",
          tag: `maintenance-${claimed.id}`,
          url: `/${subscription.locale}/partner/gps`,
          requireInteraction: false,
        }),
        { TTL: 60 * 60, urgency: "normal" },
      );
    }
    if (driver && driverNotice) {
      const driverTargets = uniquePushEndpoints([
        ...await driverPushSubscriptions(partnerId, driver.id),
        ...subscriptions.filter((subscription) => samePersonIds.has(subscription.partner_user_id)),
      ]);
      if (driverTargets.length > 0) {
        await sendPartnerPushToSubscriptions(
          driverTargets,
          () => ({
            kind: "vehicle-maintenance",
            title: driverNotice.title,
            body: driverNotice.body,
            icon: "/icon.png",
            badge: "/icon.png",
            tag: `maintenance-${claimed.id}`,
            url: `/${locale}/driver/gps`,
            requireInteraction: false,
          }),
          { TTL: 60 * 60, urgency: "normal" },
        );
      }
    }
  } catch (error) {
    console.error("[vehicle-maintenance] push failed", error instanceof Error ? error.message : "push");
  }
  const delivered = partnerDelivered && driverDelivered;
  await finishNotice(claimed.id, delivered);
  return { sent: delivered };
}

async function insertEvent(client: PoolClient, input: {
  vehicleId: string;
  partnerId: string;
  cycleId: string;
  kind: MaintenanceEventKind;
  odometerKm: number;
  serviceOn: string | null;
  intervalKm: number | null;
  actorUserId: string | null;
  idempotencyKey: string | null;
}) {
  await client.query(
    `INSERT INTO vehicle_maintenance_events (
       vehicle_id, partner_id, cycle_id, kind, odometer_km, service_on, interval_km, actor_user_id, idempotency_key
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.vehicleId,
      input.partnerId,
      input.cycleId,
      input.kind,
      input.odometerKm,
      input.serviceOn,
      input.intervalKm,
      input.actorUserId,
      input.idempotencyKey,
    ],
  );
}

export async function startVehicleMaintenance(input: {
  vehicleId: string;
  partnerId: string;
  actorUserId: string | null;
  startKm: number;
  previousKm: number;
  previousOn: string;
  intervalKm: number;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const today = istanbulMaintenanceDate(now);
  try {
    return await withMaintenanceLock(input.vehicleId, async (client) => {
      const vehicle = await ownedVehicle(client, input.vehicleId, input.partnerId);
      if (!vehicle) return { ok: false as const, error: "forbidden" as const };
      const existing = await readProfile(client, input.vehicleId, input.partnerId);
      if (existing) return { ok: true as const, snapshot: await loadSnapshot(client, existing, today) };
      const duplicate = await client.query(
        `SELECT 1 FROM vehicle_maintenance_events WHERE vehicle_id = $1 AND idempotency_key = $2`,
        [input.vehicleId, input.idempotencyKey],
      );
      if (duplicate.rows.length > 0) {
        const again = await readProfile(client, input.vehicleId, input.partnerId);
        if (again) return { ok: true as const, snapshot: await loadSnapshot(client, again, today) };
      }
      const inserted = await client.query<ProfileRow>(
        `INSERT INTO vehicle_maintenance (
           vehicle_id, partner_id, cycle_id, start_km, interval_km, last_service_km, last_service_on,
           verified_km, verified_at, distance_m, cursor_at
         ) VALUES ($1, $2, gen_random_uuid(), $3, $4, $5, $6, $3, $7, 0, $7)
         RETURNING vehicle_id, partner_id, cycle_id::text, start_km, interval_km, last_service_km,
                   last_service_on::text, verified_km, verified_at, distance_m::text,
                   cursor_at, cursor_latitude, cursor_longitude, cursor_point_id, distance_source, distance_gap`,
        [input.vehicleId, input.partnerId, input.startKm, input.intervalKm, input.previousKm, input.previousOn, now.toISOString()],
      );
      const row = inserted.rows[0];
      if (!row) return { ok: false as const, error: "failed" as const };
      await insertEvent(client, {
        vehicleId: input.vehicleId,
        partnerId: input.partnerId,
        cycleId: row.cycle_id,
        kind: "setup",
        odometerKm: input.previousKm,
        serviceOn: input.previousOn,
        intervalKm: input.intervalKm,
        actorUserId: input.actorUserId,
        idempotencyKey: input.idempotencyKey,
      });
      return { ok: true as const, snapshot: await loadSnapshot(client, row, today) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false as const, error: "exists" as const };
    throw error;
  }
}

export async function correctVehicleMaintenance(input: {
  vehicleId: string;
  partnerId: string;
  actorUserId: string | null;
  odometerKm: number;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const today = istanbulMaintenanceDate(now);
  try {
    return await withMaintenanceLock(input.vehicleId, async (client) => {
      const vehicle = await ownedVehicle(client, input.vehicleId, input.partnerId);
      if (!vehicle) return { ok: false as const, error: "forbidden" as const };
      const duplicate = await client.query(
        `SELECT 1 FROM vehicle_maintenance_events WHERE vehicle_id = $1 AND idempotency_key = $2`,
        [input.vehicleId, input.idempotencyKey],
      );
      const row = await readProfile(client, input.vehicleId, input.partnerId);
      if (!row) return { ok: false as const, error: "missing" as const };
      if (duplicate.rows.length > 0) return { ok: true as const, snapshot: await loadSnapshot(client, row, today) };
      const updated = await client.query<ProfileRow>(
        `UPDATE vehicle_maintenance
            SET verified_km = $3,
                verified_at = $4,
                distance_m = 0,
                cursor_at = $4,
                cursor_latitude = NULL,
                cursor_longitude = NULL,
                cursor_point_id = NULL,
                cursor_ignition = NULL,
                distance_gap = FALSE,
                updated_at = NOW()
          WHERE vehicle_id = $1 AND partner_id = $2
          RETURNING vehicle_id, partner_id, cycle_id::text, start_km, interval_km, last_service_km,
                    last_service_on::text, verified_km, verified_at, distance_m::text,
                    cursor_at, cursor_latitude, cursor_longitude, cursor_point_id, distance_source, distance_gap`,
        [input.vehicleId, input.partnerId, input.odometerKm, now.toISOString()],
      );
      const next = updated.rows[0];
      if (!next) return { ok: false as const, error: "failed" as const };
      await insertEvent(client, {
        vehicleId: input.vehicleId,
        partnerId: input.partnerId,
        cycleId: next.cycle_id,
        kind: "correction",
        odometerKm: input.odometerKm,
        serviceOn: null,
        intervalKm: null,
        actorUserId: input.actorUserId,
        idempotencyKey: input.idempotencyKey,
      });
      return { ok: true as const, snapshot: await loadSnapshot(client, next, today) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false as const, error: "failed" as const };
    throw error;
  }
}

export async function completeVehicleMaintenance(input: {
  vehicleId: string;
  partnerId: string;
  actorUserId: string | null;
  expectedKm: number;
  expectedDate: string;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const today = istanbulMaintenanceDate(now);
  try {
    return await withMaintenanceLock(input.vehicleId, async (client) => {
      const vehicle = await ownedVehicle(client, input.vehicleId, input.partnerId);
      if (!vehicle) return { ok: false as const, error: "forbidden" as const };
      const row = await readProfile(client, input.vehicleId, input.partnerId);
      if (!row) return { ok: false as const, error: "missing" as const };
      const duplicate = await client.query(
        `SELECT 1 FROM vehicle_maintenance_events WHERE vehicle_id = $1 AND idempotency_key = $2`,
        [input.vehicleId, input.idempotencyKey],
      );
      if (duplicate.rows.length > 0) return { ok: true as const, snapshot: await loadSnapshot(client, row, today) };
      const caught = await catchUpLocked(client, row, now);
      const figures = maintenanceFigures({
        verifiedKm: caught.verified_km,
        distanceM: Number(caught.distance_m),
        lastServiceKm: caught.last_service_km,
        intervalKm: caught.interval_km,
      });
      if (figures.estimatedKm !== input.expectedKm || today !== input.expectedDate) {
        return { ok: false as const, error: "conflict" as const };
      }
      const updated = await client.query<ProfileRow>(
        `UPDATE vehicle_maintenance
            SET cycle_id = gen_random_uuid(),
                last_service_km = $3,
                last_service_on = $4,
                updated_at = NOW()
          WHERE vehicle_id = $1 AND partner_id = $2
          RETURNING vehicle_id, partner_id, cycle_id::text, start_km, interval_km, last_service_km,
                    last_service_on::text, verified_km, verified_at, distance_m::text,
                    cursor_at, cursor_latitude, cursor_longitude, cursor_point_id, distance_source, distance_gap`,
        [input.vehicleId, input.partnerId, figures.estimatedKm, today],
      );
      const next = updated.rows[0];
      if (!next) return { ok: false as const, error: "failed" as const };
      await insertEvent(client, {
        vehicleId: input.vehicleId,
        partnerId: input.partnerId,
        cycleId: next.cycle_id,
        kind: "service",
        odometerKm: figures.estimatedKm,
        serviceOn: today,
        intervalKm: next.interval_km,
        actorUserId: input.actorUserId,
        idempotencyKey: input.idempotencyKey,
      });
      return { ok: true as const, snapshot: await loadSnapshot(client, next, today) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false as const, error: "failed" as const };
    throw error;
  }
}

export async function editVehicleMaintenance(input: {
  vehicleId: string;
  partnerId: string;
  actorUserId: string | null;
  lastServiceKm: number;
  lastServiceOn: string;
  intervalKm: number;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const today = istanbulMaintenanceDate(now);
  try {
    return await withMaintenanceLock(input.vehicleId, async (client) => {
      const vehicle = await ownedVehicle(client, input.vehicleId, input.partnerId);
      if (!vehicle) return { ok: false as const, error: "forbidden" as const };
      const row = await readProfile(client, input.vehicleId, input.partnerId);
      if (!row) return { ok: false as const, error: "missing" as const };
      const duplicate = await client.query(
        `SELECT 1 FROM vehicle_maintenance_events WHERE vehicle_id = $1 AND idempotency_key = $2`,
        [input.vehicleId, input.idempotencyKey],
      );
      if (duplicate.rows.length > 0) return { ok: true as const, snapshot: await loadSnapshot(client, row, today) };
      const updated = await client.query<ProfileRow>(
        `UPDATE vehicle_maintenance
            SET last_service_km = $3,
                last_service_on = $4,
                interval_km = $5,
                updated_at = NOW()
          WHERE vehicle_id = $1 AND partner_id = $2
          RETURNING vehicle_id, partner_id, cycle_id::text, start_km, interval_km, last_service_km,
                    last_service_on::text, verified_km, verified_at, distance_m::text,
                    cursor_at, cursor_latitude, cursor_longitude, cursor_point_id, distance_source, distance_gap`,
        [input.vehicleId, input.partnerId, input.lastServiceKm, input.lastServiceOn, input.intervalKm],
      );
      const next = updated.rows[0];
      if (!next) return { ok: false as const, error: "failed" as const };
      await insertEvent(client, {
        vehicleId: input.vehicleId,
        partnerId: input.partnerId,
        cycleId: next.cycle_id,
        kind: "edit",
        odometerKm: input.lastServiceKm,
        serviceOn: input.lastServiceOn,
        intervalKm: input.intervalKm,
        actorUserId: input.actorUserId,
        idempotencyKey: input.idempotencyKey,
      });
      return { ok: true as const, snapshot: await loadSnapshot(client, next, today) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false as const, error: "failed" as const };
    throw error;
  }
}

export async function sweepVehicleMaintenance(now = new Date()) {
  const result = await getPool().query<{ vehicle_id: string; partner_id: string }>(
    `SELECT maintenance.vehicle_id, maintenance.partner_id
       FROM vehicle_maintenance maintenance
       JOIN partner_vehicles vehicle ON vehicle.id = maintenance.vehicle_id
       JOIN partners partner ON partner.id = maintenance.partner_id
      WHERE vehicle.deleted_at IS NULL
        AND partner.deleted_at IS NULL
        AND partner.status = 'active'`,
  );
  let checked = 0;
  for (const row of result.rows) {
    try {
      await syncVehicleMaintenance(row.vehicle_id, row.partner_id, "tr", now);
      checked += 1;
    } catch (error) {
      console.error("[vehicle-maintenance] sweep failed", row.vehicle_id, error instanceof Error ? error.message : "failed");
    }
  }
  return { checked };
}

export type { MaintenanceError };
