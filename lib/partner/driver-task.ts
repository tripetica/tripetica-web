import "server-only";

import { query } from "@/lib/db/postgres";
import { type Locale } from "@/lib/i18n/config";
import { getDriverTaskForOps, type DriverTaskOpsView } from "@/lib/ops/driver-task";
import { isUuid } from "@/lib/ops/process-filters";

export async function getDriverTaskForPartner(input: {
  partnerId: string;
  reservationId: string;
  locale: Locale;
}): Promise<DriverTaskOpsView | null> {
  if (!isUuid(input.reservationId) || !input.partnerId) {
    return null;
  }
  const owned = await query<{ id: string }>(
    `SELECT id
     FROM reservations
     WHERE id = $1
       AND deleted_at IS NULL
       AND accepted_partner_id = $2
     LIMIT 1`,
    [input.reservationId, input.partnerId],
  );
  if (!owned.rows[0]) {
    return null;
  }
  return getDriverTaskForOps(input.reservationId, input.locale);
}
