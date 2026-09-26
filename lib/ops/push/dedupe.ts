import "server-only";

import { query } from "@/lib/db/postgres";

export type OpsPushEventType =
  | "process_created"
  | "reservation_confirmed"
  | "partner_application_created"
  | "partner_vehicle_approval_requested"
  | "driver_no_show_reported";

export async function claimOpsPushEvent(
  eventType: OpsPushEventType,
  sourceId: string,
): Promise<boolean> {
  const result = await query<{ event_type: string }>(
    `INSERT INTO ops_push_events (event_type, source_id)
     VALUES ($1, $2)
     ON CONFLICT (event_type, source_id) DO NOTHING
     RETURNING event_type`,
    [eventType, sourceId],
  );
  return Boolean(result.rows[0]);
}
