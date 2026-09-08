import "server-only";

import { query } from "@/lib/db/postgres";
import { type PartnerJobRank } from "@/lib/partner/job-visibility";

export const PARTNER_JOB_RELEASED_EVENT = "partner_job_released";

export async function claimPartnerPushEvent(
  reservationId: string,
  audienceRank: PartnerJobRank,
): Promise<boolean> {
  const result = await query<{ event_type: string }>(
    `INSERT INTO partner_push_events (event_type, reservation_id, audience_rank)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_type, reservation_id, audience_rank) DO NOTHING
     RETURNING event_type`,
    [PARTNER_JOB_RELEASED_EVENT, reservationId, audienceRank],
  );
  return Boolean(result.rows[0]);
}
