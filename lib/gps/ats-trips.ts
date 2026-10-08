import "server-only";

import { getPool } from "@/lib/db/postgres";
import { ATS_ACTIVE_NOTIFICATION_STATUSES, type AtsTripClock } from "@/lib/gps/ats-window";

export async function listAtsTripClocks(
  vehicleId: string,
  companyId: string,
  ministryEnv: "test" | "live",
): Promise<AtsTripClock[]> {
  const result = await getPool().query<{
    id: string;
    status: string;
    vehicle_id: string | null;
    company_id: string | null;
    plate: string | null;
    start_date: string | null;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
  }>(
    `SELECT id, status, vehicle_id, company_id,
            snapshot->'vehicle'->>'plate' AS plate,
            snapshot->'trip'->>'startDate' AS start_date,
            snapshot->'trip'->>'startTime' AS start_time,
            snapshot->'trip'->>'endDate' AS end_date,
            snapshot->'trip'->>'endTime' AS end_time
     FROM uetds_notifications
     WHERE vehicle_id = $1
       AND company_id = $2
       AND ministry_env = $3
       AND ministry_reference IS NOT NULL
       AND status = ANY($4::text[])`,
    [vehicleId, companyId, ministryEnv, ATS_ACTIVE_NOTIFICATION_STATUSES],
  );
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    vehicleId: row.vehicle_id,
    companyId: row.company_id,
    plate: row.plate,
    startDate: row.start_date ?? "",
    startTime: row.start_time ?? "",
    endDate: row.end_date ?? "",
    endTime: row.end_time ?? "",
  }));
}
