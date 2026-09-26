import "server-only";
import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { getUetdsNotification } from "@/lib/uetds/notifications";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { verifyUetdsMinistryNotification } from "@/lib/uetds/verify-ministry";

/** Reconcile only a final-verification failure. There are no mutation imports. */
export async function retryUetdsFinalVerification(input: {
  notificationId: string;
  actorType: "ops" | "partner";
  partnerId: string | null;
}) {
  if (!isUuid(input.notificationId) || (input.actorType === "partner" && !isUuid(input.partnerId ?? ""))) {
    return { ok: false as const };
  }
  const notification = await getUetdsNotification({
    id: input.notificationId, partnerId: input.actorType === "partner" ? input.partnerId : null,
  });
  const runtime = resolveUetdsMinistryRuntime();
  if (!notification || !runtime || runtime !== notification.ministryEnv || !notification.companyId || !notification.ministryReference) {
    return { ok: false as const };
  }
  const snapshot = JSON.parse(notification.snapshotJson);
  const ministry = snapshot.ministry;
  if (notification.status !== "partial" || ministry?.finalVerification?.result !== "final-verification-failed" || ministry.seferReferansNo !== notification.ministryReference) {
    return { ok: false as const };
  }
  const credentials = await loadUetdsMinistryCredentials(notification.companyId);
  if (!credentials || credentials.env !== runtime) return { ok: false as const };
  const expected = {
    seferReference: notification.ministryReference,
    plate: String(snapshot.vehicle?.ministryPlate || snapshot.vehicle?.plate || ""),
    groupCount: 1, personnelCount: 1,
    passengerCount: Array.isArray(snapshot.passengers) ? snapshot.passengers.length : 0,
  };
  if (!expected.plate || !expected.passengerCount) return { ok: false as const };
  const verification = await verifyUetdsMinistryNotification({ ...credentials, environment: runtime, expected });
  const status = verification.result === "verified" ? "submitted" : "partial";
  const next = { ...snapshot, ministry: {
    ...ministry, status, finalVerification: verification,
    message: verification.result === "verified" ? "U-ETDS bildirimi Bakanlık tarafından doğrulandı." : "Bildirim Bakanlığa gönderildi ancak nihai U-ETDS doğrulaması tamamlanamadı. Lütfen bildirimi kontrol edin.",
    finalVerificationHistory: [...(Array.isArray(ministry.finalVerificationHistory) ? ministry.finalVerificationHistory : []), verification],
  } };
  // Do not overwrite a concurrent edit/cancel or another verification result.
  const saved = await query<{ id: string }>(
    `UPDATE uetds_notifications SET status = $2, snapshot = $3::jsonb
     WHERE id = $1 AND status = 'partial' AND snapshot = $4::jsonb
       AND ministry_env = $5 AND ministry_reference = $6
       AND ($7::uuid IS NULL OR partner_id = $7)
     RETURNING id`,
    [notification.id, status, JSON.stringify(next), notification.snapshotJson, runtime, notification.ministryReference,
      input.actorType === "partner" ? input.partnerId : null],
  );
  if (!saved.rows[0]) return { ok: false as const };
  return { ok: true as const, id: notification.id, status, verification, seferReference: notification.ministryReference };
}
