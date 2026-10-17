import "server-only";

import { getPool } from "@/lib/db/postgres";
import { driverReminderCopy, MOBILE_REMINDER_COOLDOWN_MS, mobileReminderDue, mobileReminderPhase, mobileReminderRuntimeAllowed, overlappingTripReminderBlocks, ownerIsDriver, ownerReminderCopy, reminderEmailHtml, reminderPushSources, reminderTargets, uniquePushEndpoints } from "@/lib/gps/mobile-reminders";
import { sendPartnerMail } from "@/lib/partner/mail";
import { sendPartnerPushToSubscriptions, type PartnerWebPushPayload } from "@/lib/partner/push/send";
import { type PartnerPushSubscriptionRecord } from "@/lib/partner/push/subscriptions";
import { ATS_ACTIVE_NOTIFICATION_STATUSES } from "@/lib/gps/ats-window";
import { uetdsTripTimestamp } from "@/lib/uetds/list-policy";

type TripRow = {
  id: string;
  partner_id: string;
  driver_id: string;
  vehicle_id: string | null;
  status: string;
  snapshot: { trip?: Record<string, unknown>; vehicle?: { plate?: string }; driver?: { fullName?: string } };
  plate: string | null;
  driver_name: string;
  driver_email: string | null;
  owner_id: string | null;
  owner_email: string | null;
  mobile_enabled: boolean;
  driver_status: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function place(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return text(record.placeName) || text(record.name) || text(record.label);
}

export async function runMobileGpsReminders(now = new Date(), deliver = false) {
  if (!mobileReminderRuntimeAllowed(process.env)) {
    return { planned: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const pool = getPool();
  const trips = await pool.query<TripRow>(
    `SELECT n.id, n.partner_id, n.driver_id, n.vehicle_id, n.status, n.snapshot,
            vehicle.plate, trim(d.first_name || ' ' || d.last_name) AS driver_name, d.email AS driver_email,
            owner.id AS owner_id, owner.email AS owner_email,
            vehicle.service_mobile_gps_enabled AS mobile_enabled, d.status AS driver_status
       FROM uetds_notifications n
       JOIN partner_drivers d ON d.id = n.driver_id
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = n.vehicle_id
       LEFT JOIN LATERAL (
         SELECT id, email FROM partner_users
          WHERE partner_id = n.partner_id AND is_owner = TRUE AND status = 'active'
          ORDER BY created_at
          LIMIT 1
       ) owner ON TRUE
      WHERE d.deleted_at IS NULL
        AND vehicle.service_mobile_gps_enabled
        AND vehicle.ats_ministry_source = 'mobile'
        AND d.status = 'active'
        AND n.status = ANY($1::text[])`,
    [ATS_ACTIVE_NOTIFICATION_STATUSES],
  );
  let planned = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const trip of trips.rows) {
    const outcome = await remindTrip(trip, now, deliver);
    planned += outcome.planned;
    sent += outcome.sent;
    failed += outcome.failed;
    skipped += outcome.skipped;
  }
  return { planned, sent, failed, skipped };
}

async function remindTrip(trip: TripRow, now: Date, deliver: boolean) {
  const tripFields = trip.snapshot?.trip ?? {};
  const start = uetdsTripTimestamp(text(tripFields.startDate), text(tripFields.startTime));
  const end = uetdsTripTimestamp(text(tripFields.endDate), text(tripFields.endTime));
  if (start == null || end == null || !trip.plate || !trip.owner_id || !trip.owner_email) {
    return { planned: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const latest = await getPool().query<{ heard: Date | null }>(
    `SELECT GREATEST(
        (SELECT MAX(session.last_stream_at)
           FROM gps_mobile_sessions session
          WHERE session.partner_id = $1 AND session.driver_id = $2),
        (SELECT MAX(position.received_at)
           FROM gps_mobile_positions position
          WHERE position.partner_id = $1 AND position.driver_id = $2)
      ) AS heard`,
    [trip.partner_id, trip.driver_id],
  );
  const heard = latest.rows[0]?.heard?.getTime() ?? null;
  const slot = mobileReminderDue({
    startMs: start,
    endMs: end,
    nowMs: now.getTime(),
    lastHeardAtMs: heard,
  });
  if (slot == null) return { planned: 0, sent: 0, failed: 0, skipped: 0 };
  const samePerson = ownerIsDriver({ driverEmail: trip.driver_email, ownerEmail: trip.owner_email });
  const summary = {
    phase: mobileReminderPhase(now.getTime(), start),
    plate: trip.plate,
    driverName: trip.driver_name,
    date: text(tripFields.startDate),
    start: text(tripFields.startTime),
    end: text(tripFields.endTime),
    pickup: place(tripFields.origin) || place(tripFields.originLocation),
    dropoff: place(tripFields.destination) || place(tripFields.destinationLocation),
  };
  const driverCopy = driverReminderCopy(summary);
  const ownerCopy = ownerReminderCopy(summary);
  let planned = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const target of reminderTargets({ ownerIsDriver: samePerson })) {
    const copy = samePerson || target.audience === "driver" ? driverCopy : ownerCopy;
    const recipient = target.channel === "email"
      ? trip.owner_email
      : (target.audience === "owner" || samePerson ? trip.owner_id : trip.driver_id);
    if (await driverReminderCoolingDown(trip.driver_id, trip.id, target, now)) continue;
    const claimed = await claimReminder(trip, new Date(slot), target, recipient);
    if (!claimed) continue;
    planned += 1;
    if (!deliver) {
      await finish(claimed, "skipped", "dry_run");
      skipped += 1;
      continue;
    }
    const result = await deliverReminder({ trip, target, copy, samePerson });
    await finish(claimed, result.status, result.detail);
    if (result.status === "sent") sent += 1;
    else if (result.status === "failed") failed += 1;
    else skipped += 1;
  }
  return { planned, sent, failed, skipped };
}

async function claimReminder(
  trip: TripRow,
  slotAt: Date,
  target: { audience: "driver" | "owner"; channel: "push" | "email" },
  recipient: string,
) {
  const claimed = await getPool().query<{ id: string }>(
    `INSERT INTO gps_mobile_trip_reminders (
       partner_id, driver_id, notification_id, vehicle_id, plate, slot_at, channel, audience, recipient, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'planned')
     ON CONFLICT (notification_id, slot_at, channel, audience) DO NOTHING
     RETURNING id`,
    [trip.partner_id, trip.driver_id, trip.id, trip.vehicle_id, trip.plate, slotAt, target.channel, target.audience, recipient],
  );
  return claimed.rows[0]?.id ?? null;
}

async function deliverReminder(input: {
  trip: TripRow;
  target: { audience: "driver" | "owner"; channel: "push" | "email" };
  copy: { title: string; preview: string; body: string };
  samePerson: boolean;
}): Promise<{ status: "sent" | "failed" | "skipped"; detail: string }> {
  if (input.target.channel === "email") {
    const to = input.trip.owner_email ?? "";
    const mailed = await sendPartnerMail({
      to,
      subject: input.copy.title,
      text: input.copy.body,
      html: reminderEmailHtml({ title: input.copy.title, body: input.copy.body }),
    });
    return mailed.ok ? { status: "sent", detail: "smtp" } : { status: "failed", detail: mailed.error ?? "smtp" };
  }
  const subscriptions = await reminderPushSubscriptions(input.trip, input.target.audience, input.samePerson);
  if (subscriptions.length === 0) return { status: "skipped", detail: "no_subscription" };
  const url = input.samePerson || input.target.audience === "driver"
    ? "/tr/driver"
    : `/tr/partner/drivers/${input.trip.driver_id}`;
  const result = await sendPartnerPushToSubscriptions(
    subscriptions,
    () => pushPayload(input.copy, url),
    { TTL: 120, urgency: "high" },
  );
  if (result.skipped) return { status: "skipped", detail: "push_unconfigured" };
  return result.sent > 0 ? { status: "sent", detail: `push:${result.sent}` } : { status: "failed", detail: "push" };
}

async function driverReminderCoolingDown(
  driverId: string,
  notificationId: string,
  target: { audience: "driver" | "owner"; channel: "push" | "email" },
  now: Date,
) {
  const recent = await getPool().query<{ sent_at: Date }>(
    `SELECT created_at AS sent_at
       FROM gps_mobile_trip_reminders
      WHERE driver_id = $1
        AND notification_id <> $2
        AND channel = $3
        AND audience = $4
        AND status = 'sent'
        AND created_at > $5
      ORDER BY created_at DESC
      LIMIT 1`,
    [driverId, notificationId, target.channel, target.audience, new Date(now.getTime() - MOBILE_REMINDER_COOLDOWN_MS)],
  );
  return overlappingTripReminderBlocks({
    otherTripSentAtMs: recent.rows[0]?.sent_at.getTime() ?? null,
    nowMs: now.getTime(),
  });
}

async function reminderPushSubscriptions(trip: TripRow, audience: "driver" | "owner", samePerson: boolean) {
  const sources = reminderPushSources({ samePerson, audience });
  const rows: PartnerPushSubscriptionRecord[] = [];
  if (sources.includes("driver")) {
    const subscriptions = await getPool().query<{ endpoint: string; p256dh: string; auth: string }>(
      `SELECT endpoint, p256dh, auth FROM driver_push_subscriptions
        WHERE driver_id = $1 AND disabled_at IS NULL`,
      [trip.driver_id],
    );
    rows.push(...subscriptions.rows.map((row, index): PartnerPushSubscriptionRecord => ({
      id: `driver-${index}`,
      partner_id: trip.partner_id,
      partner_user_id: trip.driver_id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      locale: "tr",
      is_primary_partner: false,
      rank: 0,
    })));
  }
  if (sources.includes("owner") && trip.owner_id) {
    const subscriptions = await getPool().query<PartnerPushSubscriptionRecord>(
      `SELECT id, partner_id, partner_user_id, endpoint, p256dh, auth, locale, FALSE AS is_primary_partner, 0 AS rank
         FROM partner_push_subscriptions
        WHERE partner_id = $1 AND partner_user_id = $2 AND disabled_at IS NULL`,
      [trip.partner_id, trip.owner_id],
    );
    rows.push(...subscriptions.rows);
  }
  return uniquePushEndpoints(rows);
}

function pushPayload(copy: { title: string; preview: string }, url: string): PartnerWebPushPayload {
  return {
    kind: "mobile-gps-reminder",
    title: copy.title,
    body: copy.preview,
    icon: "/icon.png",
    badge: "/icon.png",
    tag: "mobile-gps-reminder",
    url,
    requireInteraction: false,
  };
}

async function finish(id: string, status: "sent" | "failed" | "skipped", detail: string) {
  await getPool().query(
    `UPDATE gps_mobile_trip_reminders SET status = $2, detail = $3 WHERE id = $1`,
    [id, status, detail],
  );
}
