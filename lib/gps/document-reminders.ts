import "server-only";

import { query } from "@/lib/db/postgres";
import { sendPartnerMail } from "@/lib/partner/mail";
import { sendPartnerPushToSubscriptions } from "@/lib/partner/push/send";
import { listActivePartnerPushSubscriptionsForPartner } from "@/lib/partner/push/subscriptions";
import {
  documentDaysLeft,
  documentReminderAudience,
  documentReminderClock,
  documentReminderDue,
  documentReminderMessage,
  documentTypeName,
  escapeDocumentHtml,
  istanbulDocumentDate,
  isVehicleDocumentType,
} from "@/lib/gps/documents";

type DueDocument = {
  id: string;
  vehicle_id: string;
  document_type: string;
  expires_on: string;
  plate: string | null;
};

type RecipientRow = {
  user_id: string;
  email: string;
  partner_id: string;
};

async function claimReminder(input: {
  documentId: string;
  expiresOn: string;
  notifyOn: string;
  clock: "10:00" | "14:00";
  channel: "email" | "push";
  userId: string;
}) {
  const result = await query<{ id: string }>(
    `INSERT INTO vehicle_document_reminders (
       document_id, expires_on, notify_on, clock, channel, partner_user_id, status
     ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (document_id, expires_on, notify_on, clock, channel, partner_user_id)
     DO UPDATE SET status = 'pending', claimed_at = NOW()
       WHERE vehicle_document_reminders.status = 'failed'
     RETURNING id`,
    [input.documentId, input.expiresOn, input.notifyOn, input.clock, input.channel, input.userId],
  );
  return result.rows[0]?.id ?? null;
}

async function finishReminder(id: string, status: "sent" | "failed") {
  await query(
    `UPDATE vehicle_document_reminders SET status = $2, claimed_at = NOW() WHERE id = $1`,
    [id, status],
  );
}

export async function sweepVehicleDocumentReminders(now = new Date()) {
  const clock = documentReminderClock(now);
  if (!clock) return { clock: null, sent: 0, failed: 0, skipped: 0 };
  const today = istanbulDocumentDate(now);
  await query(
    `UPDATE vehicle_document_reminders
        SET status = 'failed'
      WHERE status = 'pending'
        AND claimed_at < NOW() - INTERVAL '10 minutes'`,
  );
  const documents = await query<DueDocument>(
    `SELECT d.id, d.vehicle_id, d.document_type, d.expires_on::text AS expires_on, v.plate
       FROM vehicle_documents d
       JOIN partner_vehicles v ON v.id = d.vehicle_id
      WHERE v.deleted_at IS NULL`,
  );
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const document of documents.rows) {
    if (!isVehicleDocumentType(document.document_type)) continue;
    const daysLeft = documentDaysLeft(document.expires_on, today);
    if (!documentReminderDue(daysLeft, clock)) continue;
    const recipients = await query<RecipientRow>(
      `SELECT u.id AS user_id, u.email, u.partner_id
         FROM partner_users u
         JOIN partners p ON p.id = u.partner_id
        WHERE u.status = 'active'
          AND p.status = 'active'
          AND p.deleted_at IS NULL
          AND u.email IS NOT NULL
          AND btrim(u.email) <> ''
          AND partner_can_access_vehicle(u.partner_id, $1)`,
      [document.vehicle_id],
    );
    const audience = documentReminderAudience(recipients.rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
    })));
    const message = documentReminderMessage({
      plate: document.plate ?? "",
      name: documentTypeName(document.document_type, "tr"),
      expiresOn: document.expires_on,
      daysLeft,
    });
    const html = `<p>${escapeDocumentHtml(message.text)}</p>`;
    for (const target of audience.emailTargets) {
      const claimId = await claimReminder({
        documentId: document.id,
        expiresOn: document.expires_on,
        notifyOn: today,
        clock,
        channel: "email",
        userId: target.userId,
      });
      if (!claimId) {
        skipped += 1;
        continue;
      }
      try {
        const mailed = await sendPartnerMail({
          to: target.email,
          subject: message.subject,
          text: message.text,
          html,
        });
        await finishReminder(claimId, mailed.ok ? "sent" : "failed");
        if (mailed.ok) sent += 1;
        else failed += 1;
      } catch (error) {
        await finishReminder(claimId, "failed");
        failed += 1;
        console.error("[vehicle-documents] email failed", error instanceof Error ? error.name : "email");
      }
    }
    const allowedUsers = new Set(audience.userIds);
    const partnerIds = [...new Set(recipients.rows.map((row) => row.partner_id))];
    const subscriptions = [];
    for (const partnerId of partnerIds) {
      const rows = await listActivePartnerPushSubscriptionsForPartner(partnerId);
      subscriptions.push(...rows.filter((row) => allowedUsers.has(row.partner_user_id)));
    }
    const byUser = new Map<string, typeof subscriptions>();
    for (const subscription of subscriptions) {
      const bucket = byUser.get(subscription.partner_user_id) ?? [];
      if (!bucket.some((item) => item.endpoint === subscription.endpoint)) bucket.push(subscription);
      byUser.set(subscription.partner_user_id, bucket);
    }
    for (const [userId, targets] of byUser) {
      const claimId = await claimReminder({
        documentId: document.id,
        expiresOn: document.expires_on,
        notifyOn: today,
        clock,
        channel: "push",
        userId,
      });
      if (!claimId) {
        skipped += 1;
        continue;
      }
      try {
        const pushed = await sendPartnerPushToSubscriptions(
          targets,
          (subscription) => ({
            kind: "vehicle-document",
            title: message.subject,
            body: message.text,
            icon: "/icon.png",
            badge: "/icon.png",
            tag: `vehicle-document:${document.id}:${document.expires_on}:${today}:${clock}`,
            url: `/${subscription.locale}/partner/gps`,
            requireInteraction: false,
          }),
          { TTL: 60 * 60, urgency: "normal" },
        );
        const ok = !pushed.skipped && pushed.sent > 0;
        await finishReminder(claimId, ok ? "sent" : "failed");
        if (ok) sent += 1;
        else failed += 1;
      } catch (error) {
        await finishReminder(claimId, "failed");
        failed += 1;
        console.error("[vehicle-documents] push failed", error instanceof Error ? error.name : "push");
      }
    }
  }
  return { clock, sent, failed, skipped };
}
