import "server-only";

import { query } from "@/lib/db/postgres";
import {
  buildDriverPortalJobRow,
  isRegisteredDriverPortalAssignment,
  partitionDriverPortalJobs,
  type DriverPortalJobRow,
} from "@/lib/driver-portal/jobs-view";
import {
  ensureDriverTaskForReservation,
  loadDriverTaskByToken,
} from "@/lib/ops/driver-task";
import { type DriverTaskPublicView } from "@/lib/ops/driver-task-fields";
import { isUuid } from "@/lib/ops/process-filters";

type JobQueryRow = {
  id: string;
  pickup_at: Date | null;
  service_type: string | null;
  tour_code: string | null;
  pickup_name_tr: string | null;
  pickup_name_customer: string | null;
  dropoff_name_tr: string | null;
  dropoff_name_customer: string | null;
  current_stage: string | null;
};

export async function listDriverPortalJobs(driverId: string): Promise<DriverPortalJobRow[]> {
  const result = await query<JobQueryRow>(
    `SELECT
        r.id,
        r.pickup_at,
        r.service_type,
        r.tour_code,
        r.pickup_name_tr,
        r.pickup_name_customer,
        r.dropoff_name_tr,
        r.dropoff_name_customer,
        t.current_stage
     FROM reservations r
     LEFT JOIN reservation_driver_tasks t ON t.reservation_id = r.id
     WHERE r.deleted_at IS NULL
       AND r.assigned_driver_kind = 'registered'
       AND r.assigned_driver_id = $1
       AND t.current_stage IS DISTINCT FROM 'completed'
     ORDER BY r.pickup_at ASC NULLS LAST, r.id ASC`,
    [driverId],
  );
  return partitionDriverPortalJobs(
    result.rows.map((row) =>
      buildDriverPortalJobRow({
        reservationId: row.id,
        pickupAt: row.pickup_at,
        serviceType: row.service_type,
        tourCode: row.tour_code,
        pickupNameTr: row.pickup_name_tr,
        pickupNameCustomer: row.pickup_name_customer,
        dropoffNameTr: row.dropoff_name_tr,
        dropoffNameCustomer: row.dropoff_name_customer,
        currentStage: row.current_stage,
      }),
    ),
  ).upcoming;
}

export async function loadAuthorizedDriverPortalTask(
  driverId: string,
  reservationId: string,
): Promise<
  | (DriverTaskPublicView & { token: string })
  | { valid: false; reason: "forbidden" | "revoked" | "not-found" }
> {
  if (!isUuid(reservationId) || !isUuid(driverId)) {
    return { valid: false, reason: "forbidden" };
  }
  const assigned = await query<{
    assigned_driver_kind: string | null;
    assigned_driver_id: string | null;
    access_token: string | null;
  }>(
    `SELECT
        r.assigned_driver_kind,
        r.assigned_driver_id,
        t.access_token
     FROM reservations r
     LEFT JOIN reservation_driver_tasks t ON t.reservation_id = r.id
     WHERE r.id = $1
       AND r.deleted_at IS NULL
     LIMIT 1`,
    [reservationId],
  );
  const row = assigned.rows[0];
  if (
    !row ||
    !isRegisteredDriverPortalAssignment({
      assignedDriverKind: row.assigned_driver_kind,
      assignedDriverId: row.assigned_driver_id,
      sessionDriverId: driverId,
    })
  ) {
    return { valid: false, reason: "forbidden" };
  }

  if (!row.access_token) {
    await ensureDriverTaskForReservation({ query }, reservationId);
  }
  const tokenRow = await query<{ access_token: string }>(
    `SELECT access_token
     FROM reservation_driver_tasks
     WHERE reservation_id = $1
     LIMIT 1`,
    [reservationId],
  );
  const token = tokenRow.rows[0]?.access_token;
  if (!token) {
    return { valid: false, reason: "forbidden" };
  }
  const loaded = await loadDriverTaskByToken(token, { enforcePublicExpiry: false });
  if (!loaded.valid) {
    return loaded;
  }
  return { ...loaded, token };
}
