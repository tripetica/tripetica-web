import "server-only";

import { pickupAirportCode } from "@/lib/booking/meet-and-greet";
import { getPool, query } from "@/lib/db/postgres";
import type { QueryResultRow } from "pg";
import {
  candidateEstimatedMs,
  candidateScheduledMs,
  matchDhmiFlight,
  resolvedActualArrivalMs,
  shouldPollFlight,
  shouldTrackAirportPickupFlight,
  snapshotIso,
  type FlightTrackingSnapshot,
} from "@/lib/ops/flight-tracking";
import {
  loadDhmiArrivals,
  resolveDhmiAirportId,
} from "@/lib/ops/flight-tracking-dhmi";

type Sql = typeof query;

let activeSql: Sql = query;

function sql<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return activeSql<T>(text, values);
}

type TrackRow = {
  id: string;
  flight_code: string | null;
  pickup_at: Date | null;
  pickup_airport_code: string | null;
  pickup_location_type: string | null;
  pickup_place_id: string | null;
  status: string;
  driver_task_stage: string | null;
  scheduled_arrival: Date | null;
  estimated_arrival: Date | null;
  actual_arrival: Date | null;
  last_checked_at: Date | null;
};

const LOCK_SQL = `
  INSERT INTO reservation_flight_tracking (
    reservation_id, source, locked_until, updated_at
  ) VALUES ($1, 'dhmi', NOW() + INTERVAL '45 seconds', NOW())
  ON CONFLICT (reservation_id) DO UPDATE
    SET locked_until = EXCLUDED.locked_until,
        updated_at = NOW()
    WHERE reservation_flight_tracking.actual_arrival IS NULL
      AND (
        reservation_flight_tracking.locked_until IS NULL
        OR reservation_flight_tracking.locked_until < NOW()
      )
  RETURNING reservation_id
`;

function reservationIata(row: TrackRow): string | null {
  const stored = row.pickup_airport_code?.trim().toUpperCase() ?? "";
  if (/^[A-Z]{3}$/.test(stored)) {
    return stored;
  }
  return pickupAirportCode({
    airportCode: row.pickup_airport_code,
    locationType: row.pickup_location_type,
    placeId: row.pickup_place_id,
  });
}

function msOf(value: Date | string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function snapshotFromTrackingRow(row: {
  scheduled_arrival?: Date | string | null;
  estimated_arrival?: Date | string | null;
  actual_arrival?: Date | string | null;
  status_text?: string | null;
  status_id?: number | null;
  source?: string | null;
  last_checked_at?: Date | string | null;
  last_success_at?: Date | string | null;
  last_error?: string | null;
} | null): FlightTrackingSnapshot | null {
  if (!row) {
    return null;
  }
  return {
    scheduledArrival: row.scheduled_arrival
      ? new Date(row.scheduled_arrival).toISOString()
      : null,
    estimatedArrival: row.estimated_arrival
      ? new Date(row.estimated_arrival).toISOString()
      : null,
    actualArrival: row.actual_arrival ? new Date(row.actual_arrival).toISOString() : null,
    statusText: row.status_text ?? null,
    statusId: row.status_id ?? null,
    source: row.source === "dhmi" ? "dhmi" : null,
    lastCheckedAt: row.last_checked_at
      ? new Date(row.last_checked_at).toISOString()
      : null,
    lastSuccessAt: row.last_success_at
      ? new Date(row.last_success_at).toISOString()
      : null,
    lastError: row.last_error ?? null,
  };
}

async function loadCandidates(reservationId?: string): Promise<TrackRow[]> {
  const result = await sql<TrackRow>(
    `SELECT
        r.id,
        r.flight_code,
        r.pickup_at,
        r.pickup_airport_code,
        r.pickup_location_type,
        r.pickup_place_id,
        r.status,
        t.current_stage AS driver_task_stage,
        ft.scheduled_arrival,
        ft.estimated_arrival,
        ft.actual_arrival,
        ft.last_checked_at
     FROM reservations r
     LEFT JOIN reservation_driver_tasks t ON t.reservation_id = r.id
     LEFT JOIN reservation_flight_tracking ft ON ft.reservation_id = r.id
     WHERE r.deleted_at IS NULL
       AND r.status = 'confirmed'
       AND r.pickup_at IS NOT NULL
       AND r.pickup_at > NOW() - INTERVAL '18 hours'
       AND r.pickup_at <= NOW() + INTERVAL '4 hours'
       AND ft.actual_arrival IS NULL
       AND ($1::uuid IS NULL OR r.id = $1)
     LIMIT 80`,
    [reservationId ?? null],
  );
  return result.rows.filter((row) =>
    shouldTrackAirportPickupFlight({
      airportCode: row.pickup_airport_code,
      locationType: row.pickup_location_type,
      placeId: row.pickup_place_id,
      flightCode: row.flight_code,
      status: row.status,
      driverTaskStage: row.driver_task_stage,
    }),
  );
}

async function writeTracking(
  reservationId: string,
  patch: {
    scheduledArrival?: string | null;
    estimatedArrival?: string | null;
    actualArrival?: string | null;
    statusText?: string | null;
    statusId?: number | null;
    lastError?: string | null;
    success?: boolean;
  },
) {
  await sql(
    `UPDATE reservation_flight_tracking
     SET scheduled_arrival = COALESCE($2, scheduled_arrival),
         estimated_arrival = COALESCE($3, estimated_arrival),
         actual_arrival = COALESCE($4, actual_arrival),
         status_text = COALESCE($5, status_text),
         status_id = COALESCE($6, status_id),
         last_checked_at = NOW(),
         last_success_at = CASE WHEN $7 THEN NOW() ELSE last_success_at END,
         last_error = $8,
         locked_until = NULL,
         updated_at = NOW()
     WHERE reservation_id = $1`,
    [
      reservationId,
      patch.scheduledArrival ?? null,
      patch.estimatedArrival ?? null,
      patch.actualArrival ?? null,
      patch.statusText ?? null,
      patch.statusId ?? null,
      Boolean(patch.success),
      patch.lastError ?? null,
    ],
  );
}

async function pollOne(
  row: TrackRow,
  board: Awaited<ReturnType<typeof loadDhmiArrivals>>,
) {
  const locked = await sql<{ reservation_id: string }>(LOCK_SQL, [row.id]);
  if (!locked.rows[0]) {
    return "locked";
  }
  try {
    if (!board.ok) {
      await writeTracking(row.id, {
        success: false,
        lastError: board.error,
      });
      return "error";
    }
    const pickupMs = msOf(row.pickup_at);
    if (pickupMs == null) {
      await writeTracking(row.id, { success: false, lastError: "missing_pickup_at" });
      return "skip";
    }
    const matched = matchDhmiFlight(board.flights, row.flight_code ?? "", pickupMs);
    if (!matched) {
      await writeTracking(row.id, { success: false, lastError: "not_found" });
      return "miss";
    }
    const scheduledMs = candidateScheduledMs(matched);
    const estimatedMs = candidateEstimatedMs(matched);
    const actualMs = resolvedActualArrivalMs(matched);
    if (
      actualMs != null &&
      estimatedMs != null &&
      actualMs === estimatedMs &&
      !(matched.exactTime ?? "").trim()
    ) {
      await writeTracking(row.id, {
        scheduledArrival: snapshotIso(scheduledMs),
        estimatedArrival: snapshotIso(estimatedMs),
        statusText: matched.status || null,
        statusId: matched.statusId ?? null,
        success: true,
        lastError: null,
      });
      return "ok";
    }
    await writeTracking(row.id, {
      scheduledArrival: snapshotIso(scheduledMs),
      estimatedArrival: snapshotIso(estimatedMs),
      actualArrival: snapshotIso(actualMs),
      statusText: matched.status || null,
      statusId: matched.statusId ?? null,
      success: true,
      lastError: null,
    });
    return "ok";
  } catch (error) {
    await writeTracking(row.id, {
      success: false,
      lastError: error instanceof Error ? error.message : "dhmi_unavailable",
    }).catch(() => undefined);
    return "error";
  }
}

const BATCH_POLL_LOCK_CLASS = 851401;
const BATCH_POLL_LOCK_OBJECT = 1;

async function runDueFlightTracking(options?: {
  reservationId?: string;
}): Promise<{ considered: number; polled: number; errors: number }> {
  const nowMs = Date.now();
  const rows = await loadCandidates(options?.reservationId);
  const due = rows.filter((row) =>
    shouldPollFlight({
      nowMs,
      scheduledMs: msOf(row.pickup_at),
      estimatedMs: msOf(row.estimated_arrival),
      actualMs: msOf(row.actual_arrival),
      lastCheckedMs: msOf(row.last_checked_at),
      cancelled: row.status === "cancelled",
      completed: row.driver_task_stage === "completed",
    }),
  );
  const byAirport = new Map<number, TrackRow[]>();
  for (const row of due) {
    const iata = reservationIata(row);
    if (!iata) {
      continue;
    }
    const airportId = await resolveDhmiAirportId(iata);
    if (!airportId) {
      continue;
    }
    const list = byAirport.get(airportId) ?? [];
    list.push(row);
    byAirport.set(airportId, list);
  }
  let polled = 0;
  let errors = 0;
  for (const [airportId, group] of byAirport) {
    const board = await loadDhmiArrivals(airportId);
    for (const row of group) {
      const result = await pollOne(row, board);
      if (result === "ok" || result === "miss" || result === "error") {
        polled += 1;
      }
      if (result === "error") {
        errors += 1;
      }
    }
  }
  return { considered: due.length, polled, errors };
}

export async function pollDueFlightTracking(options?: {
  reservationId?: string;
}): Promise<{ considered: number; polled: number; errors: number }> {
  if (options?.reservationId) {
    return runDueFlightTracking(options);
  }
  const client = await getPool().connect();
  const previous = activeSql;
  activeSql = (text, values = []) => client.query(text, values);
  try {
    const locked = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1, $2) AS locked",
      [BATCH_POLL_LOCK_CLASS, BATCH_POLL_LOCK_OBJECT],
    );
    if (!locked.rows[0]?.locked) {
      return { considered: 0, polled: 0, errors: 0 };
    }
    try {
      return await runDueFlightTracking(options);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1, $2)", [
        BATCH_POLL_LOCK_CLASS,
        BATCH_POLL_LOCK_OBJECT,
      ]);
    }
  } finally {
    activeSql = previous;
    client.release();
  }
}
