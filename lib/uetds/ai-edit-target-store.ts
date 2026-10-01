import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { applyAiEditTargetSnapshot, finishAiEditPortalSync } from "@/lib/uetds/ai-edit-target";
import { parseUetdsDraft } from "@/lib/uetds/draft";
import { getUetdsNotification } from "@/lib/uetds/notifications";

export async function persistAiEditTarget(input: {
  actorType: "ops" | "partner";
  partnerId?: string | null;
  notificationId: string;
  draft: unknown;
}) {
  const edited = parseUetdsDraft(input.draft);
  if (!edited || !isUuid(input.notificationId)) return { ok: false as const, error: "invalid" as const };
  const notification = await getUetdsNotification({
    id: input.notificationId,
    partnerId: input.actorType === "partner" ? input.partnerId ?? null : null,
  });
  if (!notification) return { ok: false as const, error: "not-found" as const };
  if (notification.status === "cancelled") return { ok: false as const, error: "cancelled" as const };
  let previous: unknown = {};
  try {
    previous = JSON.parse(notification.snapshotJson || "{}");
  } catch {
    previous = {};
  }
  const next = applyAiEditTargetSnapshot(previous, edited);
  await query(`UPDATE uetds_notifications SET snapshot = $2::jsonb WHERE id = $1`, [
    notification.id,
    JSON.stringify(next),
  ]);
  return { ok: true as const, error: null };
}

export async function markAiEditPortalSyncFinished(notificationId: string, snapshotJson: string) {
  if (!isUuid(notificationId)) return;
  let previous: unknown = null;
  try {
    previous = JSON.parse(snapshotJson || "{}");
  } catch {
    return;
  }
  const sync = previous && typeof previous === "object" ? (previous as { portalSync?: { unfinished?: unknown } }).portalSync : null;
  if (!sync || sync.unfinished !== true) return;
  const next = finishAiEditPortalSync(previous);
  if (!next) return;
  await query(`UPDATE uetds_notifications SET snapshot = $2::jsonb WHERE id = $1`, [
    notificationId,
    JSON.stringify(next),
  ]);
}
