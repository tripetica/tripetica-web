import "server-only";
import type { UetdsDraft } from "@/lib/uetds/draft";
import type { UetdsNotificationDetail } from "@/lib/uetds/notification-view";
import { normalizeUetdsFare } from "@/lib/uetds/fare";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { queryUetdsTestBildirimOzeti } from "@/lib/uetds/ministry-ozet";

/** Called only after the page has authorized this notification; never mutates either system. */
export async function prefillUetdsFare(notification: UetdsNotificationDetail, draft: UetdsDraft) {
  if (normalizeUetdsFare(draft.fare) !== null || !notification.companyId || !notification.ministryReference || notification.ministryEnv !== resolveUetdsMinistryRuntime()) return;
  try {
    const credentials = await loadUetdsMinistryCredentials(notification.companyId);
    if (!credentials || credentials.env !== notification.ministryEnv) return;
    const summary = await queryUetdsTestBildirimOzeti({ ...credentials, seferReferansNo: notification.ministryReference });
    if (summary.sonucKodu !== 0 || (summary.seferReference && summary.seferReference !== notification.ministryReference)) return;
    const reference = JSON.parse(notification.snapshotJson).ministry?.grupReferansNo;
    const group = summary.groups.find(item => item.reference === reference);
    const fare = group ? normalizeUetdsFare(group.fare) : null;
    if (fare !== null) draft.fare = fare;
  } catch { /* Keep missing fare visible for user correction. */ }
}
