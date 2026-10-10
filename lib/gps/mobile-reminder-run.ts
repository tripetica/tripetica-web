import "server-only";

import { getPool } from "@/lib/db/postgres";
import { MOBILE_REMINDER_FRESH_MS, driverGapCopy, driverReminderCopy, mobileGapAlert, mobileReminderSlot, ownerGapCopy, ownerIsDriver, ownerReminderCopy, reminderEmailHtml, reminderTargets } from "@/lib/gps/mobile-reminders";
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
  share_enabled: boolean | null;
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
  if (process.env.NODE_ENV === "production" || process.env.EXPECTED_DATABASE !== "tripetica_dev") {
    return { planned: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const pool = getPool();
  const trips = await pool.query<TripRow>(
    `SELECT n.id, n.partner_id, n.driver_id, n.vehicle_id, n.status, n.snapshot,
            vehicle.plate, trim(d.first_name || ' ' || d.last_name) AS driver_name, d.email AS driver_email,
            owner.id AS owner_id, owner.email AS owner_email,
            d.service_mobile_gps_enabled AS mobile_enabled, d.status AS driver_status,
            share.share_enabled
       FROM uetds_notifications n
       JOIN partner_drivers d ON d.id = n.driver_id
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = n.vehicle_id
       LEFT JOIN LATERAL (
         SELECT id, email FROM partner_users
          WHERE partner_id = n.partner_id AND is_owner = TRUE AND status = 'active'
          ORDER BY created_at
          LIMIT 1
       ) owner ON TRUE
       LEFT JOIN LATERAL (
         SELECT TRUE AS share_enabled
           FROM gps_mobile_sessions session
          WHERE session.driver_id = d.id
            AND session.partner_id = n.partner_id
            AND session.status = 'active'
            AND session.share_enabled
          LIMIT 1
       ) share ON TRUE
      WHERE d.deleted_at IS NULL
        AND d.service_mobile_gps_enabled
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
  const slot = start == null || end == null ? null : mobileReminderSlot({ startMs: start, endMs: end, nowMs: now.getTime() });
  if (slot == null || !trip.plate || !trip.owner_id || !trip.owner_email) return { planned: 0, sent: 0, failed: 0, skipped: 0 };
  const latest = await getPool().query<{ received_at: Date }>(
    `SELECT received_at FROM gps_mobile_positions
      WHERE partner_id = $1 AND driver_id = $2
      ORDER BY received_at DESC LIMIT 1`,
    [trip.partner_id, trip.driver_id],
  );
  const received = latest.rows[0]?.received_at?.getTime();
  if (received != null && now.getTime() - received <= MOBILE_REMINDER_FRESH_MS) {
    return { planned: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const gap = mobileGapAlert({
    shareEnabled: trip.share_enabled === true,
    lastReceivedAtMs: received ?? null,
    nowMs: now.getTime(),
    tripOpen: true,
  });
  const lastFixLabel = received == null ? "" : new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(received);
  const samePerson = ownerIsDriver({ driverEmail: trip.driver_email, ownerEmail: trip.owner_email });
  const summary = {
    plate: trip.plate,
    driverName: trip.driver_name,
    start: `${text(tripFields.startDate)} ${text(tripFields.startTime)}`,
    end: `${text(tripFields.endDate)} ${text(tripFields.endTime)}`,
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
    const gapCopy = samePerson || target.audience === "driver"
      ? driverGapCopy({ plate: summary.plate, lastFix: lastFixLabel })
      : ownerGapCopy({ ...summary, lastFix: lastFixLabel });
    const tripCopy = samePerson || target.audience === "driver" ? driverCopy : ownerCopy;
    const recipient = target.channel === "email"
      ? trip.owner_email
      : (target.audience === "owner" || samePerson ? trip.owner_id : trip.driver_id);
    const tripClaim = await claimReminder(trip, new Date(slot), target, recipient);
    const gapClaim = gap.send ? await claimReminder(trip, new Date(gap.anchorMs), target, recipient) : null;
    const copy = gapClaim ? gapCopy : tripCopy;
    const ids = [tripClaim, gapClaim].filter((id): id is string => Boolean(id));
    if (ids.length === 0) continue;
    planned += ids.length;
    if (!deliver) {
      for (const id of ids) await finish(id, "skipped", "dry_run");
      skipped += 1;
      continue;
    }
    const result = await deliverReminder({ trip, target, copy, samePerson });
    const detail = ids.length > 1 ? `merged:${result.detail}` : result.detail;
    for (const id of ids) await finish(id, result.status, detail);
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
  if (input.samePerson || input.target.audience === "owner") {
    const subscriptions = await getPool().query<PartnerPushSubscriptionRecord>(
      `SELECT id, partner_id, partner_user_id, endpoint, p256dh, auth, locale, FALSE AS is_primary_partner, 0 AS rank
         FROM partner_push_subscriptions
        WHERE partner_id = $1 AND partner_user_id = $2 AND disabled_at IS NULL`,
      [input.trip.partner_id, input.trip.owner_id],
    );
    if (subscriptions.rows.length === 0) return { status: "skipped", detail: "no_subscription" };
    const url = `/tr/partner/drivers/${input.trip.driver_id}`;
    const result = await sendPartnerPushToSubscriptions(subscriptions.rows, () => pushPayload(input.copy, url));
    if (result.skipped) return { status: "skipped", detail: "push_unconfigured" };
    return result.sent > 0 ? { status: "sent", detail: `push:${result.sent}` } : { status: "failed", detail: "push" };
  }
  const subscriptions = await getPool().query<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT endpoint, p256dh, auth FROM driver_push_subscriptions
      WHERE driver_id = $1 AND disabled_at IS NULL`,
    [input.trip.driver_id],
  );
  if (subscriptions.rows.length === 0) return { status: "skipped", detail: "no_subscription" };
  const asPartner: PartnerPushSubscriptionRecord[] = subscriptions.rows.map((row, index) => ({
    id: String(index),
    partner_id: input.trip.partner_id,
    partner_user_id: input.trip.driver_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    locale: "tr",
    is_primary_partner: false,
    rank: 0,
  }));
  const result = await sendPartnerPushToSubscriptions(asPartner, () => pushPayload(input.copy, "/tr/driver"));
  if (result.skipped) return { status: "skipped", detail: "push_unconfigured" };
  return result.sent > 0 ? { status: "sent", detail: `push:${result.sent}` } : { status: "failed", detail: "push" };
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
