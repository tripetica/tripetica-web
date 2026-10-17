import "server-only";

import { query } from "@/lib/db/postgres";

export async function recordFleetStatusAudit(input: {
  kind: "driver" | "vehicle";
  recordId: string;
  partnerId: string;
  oldStatus: string;
  newStatus: string;
  editor: { source: "partner" | "ops"; userId: string };
}) {
  if (input.oldStatus === input.newStatus) {
    return;
  }
  await query(
    `INSERT INTO partner_fleet_status_audits (
       record_kind, record_id, partner_id, old_status, new_status, actor_kind, actor_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.kind,
      input.recordId,
      input.partnerId,
      input.oldStatus,
      input.newStatus,
      input.editor.source,
      input.editor.userId,
    ],
  );
}
