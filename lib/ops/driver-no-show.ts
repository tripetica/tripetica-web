import "server-only";

import { query } from "@/lib/db/postgres";
import { driverAssignmentFingerprint } from "@/lib/ops/driver-task-stages";
import { snapshotFromTrackingRow } from "@/lib/ops/flight-tracking-poll";
import {
  isReservationOpsFinalStatus,
  isTransferNoShowService,
  NO_SHOW_REVIEW_PENDING,
  reservationStatusFromNoShowDecision,
  type DriverNoShowReport,
  type NoShowReviewDecision,
  type NoShowReviewStatus,
} from "@/lib/ops/no-show";
import { writeOpsRecordAudits } from "@/lib/ops/record-audit";

export {
  canReportDriverNoShow,
  isTransferNoShowService,
  type DriverNoShowReport,
} from "@/lib/ops/no-show";

type ReportRow = {
  reported_at: Date;
  arrived_at: Date | null;
  driver_kind: string | null;
  driver_id: string | null;
  driver_name: string | null;
  flight_code: string | null;
  pickup_at: Date | null;
  service_type: string | null;
  reservation_status: string | null;
  review_status: string;
  reviewed_at: Date | null;
  reviewed_by_name: string | null;
  operations_note: string | null;
  scheduled_arrival: Date | null;
  estimated_arrival: Date | null;
  actual_arrival: Date | null;
  status_text: string | null;
  status_id: number | null;
  source: string | null;
  last_checked_at: Date | null;
  last_success_at: Date | null;
  last_error: string | null;
};

function asReviewStatus(value: string | null | undefined): NoShowReviewStatus {
  if (value === "approved" || value === "rejected") {
    return value;
  }
  return NO_SHOW_REVIEW_PENDING;
}

function mapReport(row: ReportRow): DriverNoShowReport {
  const reviewStatus = asReviewStatus(row.review_status);
  return {
    reportedAt: row.reported_at.toISOString(),
    arrivedAt: row.arrived_at ? row.arrived_at.toISOString() : null,
    driverKind: row.driver_kind,
    driverId: row.driver_id,
    driverName: row.driver_name?.trim() || null,
    flightCode: row.flight_code?.trim() || null,
    pickupAt: row.pickup_at ? row.pickup_at.toISOString() : null,
    serviceType: row.service_type,
    reservationStatus: row.reservation_status,
    reviewStatus,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    reviewedByName: row.reviewed_by_name?.trim() || null,
    operationsNote: row.operations_note?.trim() || null,
    canReview:
      reviewStatus === NO_SHOW_REVIEW_PENDING &&
      isTransferNoShowService(row.service_type) &&
      !isReservationOpsFinalStatus(row.reservation_status),
    flightTracking: snapshotFromTrackingRow(row),
  };
}

export async function loadDriverNoShowReport(
  reservationId: string,
): Promise<DriverNoShowReport | null> {
  const result = await query<ReportRow>(
    `SELECT
        ns.reported_at,
        ns.arrived_at,
        ns.driver_kind,
        ns.driver_id,
        CASE
          WHEN ns.driver_kind = 'registered'
            THEN NULLIF(TRIM(CONCAT(COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, ''))), '')
          ELSE NULLIF(TRIM(CONCAT(
            COALESCE(r.assigned_driver_snapshot->>'firstName', ''),
            ' ',
            COALESCE(r.assigned_driver_snapshot->>'lastName', '')
          )), '')
        END AS driver_name,
        r.flight_code,
        r.pickup_at,
        r.service_type,
        r.status AS reservation_status,
        ns.review_status,
        ns.reviewed_at,
        NULLIF(TRIM(CONCAT(COALESCE(ou.first_name, ''), ' ', COALESCE(ou.last_name, ''))), '') AS reviewed_by_name,
        ns.operations_note,
        ft.scheduled_arrival,
        ft.estimated_arrival,
        ft.actual_arrival,
        ft.status_text,
        ft.status_id,
        ft.source,
        ft.last_checked_at,
        ft.last_success_at,
        ft.last_error
     FROM reservation_driver_no_show_reports ns
     JOIN reservations r ON r.id = ns.reservation_id
     LEFT JOIN partner_drivers d ON d.id = ns.driver_id
     LEFT JOIN ops_users ou ON ou.id = ns.reviewed_by
     LEFT JOIN reservation_flight_tracking ft ON ft.reservation_id = ns.reservation_id
     WHERE ns.reservation_id = $1
     LIMIT 1`,
    [reservationId],
  );
  return result.rows[0] ? mapReport(result.rows[0]) : null;
}

export async function loadDriverNoShowReportedAtByReservationIds(
  reservationIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (reservationIds.length === 0) {
    return map;
  }
  const result = await query<{ reservation_id: string; reported_at: Date }>(
    `SELECT reservation_id, reported_at
     FROM reservation_driver_no_show_reports
     WHERE reservation_id = ANY($1::uuid[])`,
    [reservationIds],
  );
  for (const row of result.rows) {
    map.set(row.reservation_id, row.reported_at.toISOString());
  }
  return map;
}

export async function reportDriverNoShowByToken(token: string): Promise<
  | { ok: true; alreadyReported: boolean; reservationId: string }
  | { ok: false; reason: "revoked" | "conflict" }
> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, reason: "revoked" };
  }
  const { getPool } = await import("@/lib/db/postgres");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      reservation_id: string;
      current_stage: string;
      service_type: string | null;
      status: string;
      assigned_driver_kind: string | null;
      assigned_driver_id: string | null;
      assigned_driver_snapshot: unknown;
    }>(
      `SELECT
          t.reservation_id,
          t.current_stage,
          r.service_type,
          r.status,
          r.assigned_driver_kind,
          r.assigned_driver_id,
          r.assigned_driver_snapshot
       FROM reservation_driver_tasks t
       JOIN reservations r ON r.id = t.reservation_id
       WHERE t.access_token = $1
         AND r.deleted_at IS NULL
       FOR UPDATE OF t`,
      [trimmed],
    );
    const row = locked.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "revoked" };
    }
    if (!isTransferNoShowService(row.service_type)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "conflict" };
    }
    if (row.current_stage !== "arrived" || row.status !== "confirmed") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "conflict" };
    }
    const arrived = await client.query<{ occurred_at: Date }>(
      `SELECT occurred_at
       FROM reservation_driver_task_events
       WHERE reservation_id = $1
         AND stage = 'arrived'
       ORDER BY occurred_at ASC
       LIMIT 1`,
      [row.reservation_id],
    );
    const inserted = await client.query<{ reservation_id: string }>(
      `INSERT INTO reservation_driver_no_show_reports (
         reservation_id, reported_at, arrived_at,
         driver_kind, driver_id, driver_fingerprint, event_source
       ) VALUES ($1, NOW(), $2, $3, $4, $5, 'driver_link')
       ON CONFLICT (reservation_id) DO NOTHING
       RETURNING reservation_id`,
      [
        row.reservation_id,
        arrived.rows[0]?.occurred_at ?? null,
        row.assigned_driver_kind,
        row.assigned_driver_id,
        driverAssignmentFingerprint({
          kind: row.assigned_driver_kind,
          driverId: row.assigned_driver_id,
          snapshot: row.assigned_driver_snapshot,
        }),
      ],
    );
    const stageAfter = await client.query<{ current_stage: string; status: string }>(
      `SELECT t.current_stage, r.status
       FROM reservation_driver_tasks t
       JOIN reservations r ON r.id = t.reservation_id
       WHERE t.reservation_id = $1
       LIMIT 1`,
      [row.reservation_id],
    );
    if (
      stageAfter.rows[0]?.current_stage !== "arrived" ||
      stageAfter.rows[0]?.status !== "confirmed"
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "conflict" };
    }
    await client.query("COMMIT");
    return {
      ok: true,
      alreadyReported: !inserted.rows[0],
      reservationId: row.reservation_id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reviewDriverNoShowReport(input: {
  reservationId: string;
  opsUserId: string;
  decision: NoShowReviewDecision;
  operationsNote?: string | null;
}): Promise<
  | { ok: true; status: "no_show" | "service_failed" }
  | { ok: false; reason: "not-found" | "conflict" | "invalid" }
> {
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { ok: false, reason: "invalid" };
  }
  const nextStatus = reservationStatusFromNoShowDecision(input.decision);
  const note = input.operationsNote?.trim() || null;
  const { getPool } = await import("@/lib/db/postgres");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      reservation_id: string;
      review_status: string;
      status: string;
      service_type: string | null;
    }>(
      `SELECT
          ns.reservation_id,
          ns.review_status,
          r.status,
          r.service_type
       FROM reservation_driver_no_show_reports ns
       JOIN reservations r ON r.id = ns.reservation_id
       WHERE ns.reservation_id = $1
         AND r.deleted_at IS NULL
       FOR UPDATE OF ns, r`,
      [input.reservationId],
    );
    const row = locked.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }
    if (
      !isTransferNoShowService(row.service_type) ||
      row.review_status !== NO_SHOW_REVIEW_PENDING ||
      row.status !== "confirmed"
    ) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "conflict" };
    }
    const reviewed = await client.query<{ reservation_id: string }>(
      `UPDATE reservation_driver_no_show_reports
       SET review_status = $2,
           reviewed_at = NOW(),
           reviewed_by = $3,
           operations_note = $4
       WHERE reservation_id = $1
         AND review_status = $5
       RETURNING reservation_id`,
      [input.reservationId, input.decision, input.opsUserId, note, NO_SHOW_REVIEW_PENDING],
    );
    if (!reviewed.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "conflict" };
    }
    const updated = await client.query<{ status: string }>(
      `UPDATE reservations
       SET status = $2
       WHERE id = $1
         AND status = 'confirmed'
       RETURNING status`,
      [input.reservationId, nextStatus],
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "conflict" };
    }
    await writeOpsRecordAudits(client, {
      recordKind: "reservation",
      recordId: input.reservationId,
      changedBy: input.opsUserId,
      changes: [
        {
          fieldName: "status",
          oldValue: row.status,
          newValue: nextStatus,
        },
        {
          fieldName: "no_show_review_status",
          oldValue: row.review_status,
          newValue: input.decision,
        },
      ],
    });
    await client.query("COMMIT");
    return { ok: true, status: nextStatus };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
