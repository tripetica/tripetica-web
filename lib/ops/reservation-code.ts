import "server-only";

import { type PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";

const ISTANBUL_DAY = `(now() AT TIME ZONE 'Europe/Istanbul')::date`;

export function formatReservationCode(dayKey: string, seq: number) {
  const compact = dayKey.replace(/-/g, "");
  return `TRP-${compact}-${String(seq).padStart(4, "0")}`;
}

export async function allocateReservationCode(client: PoolClient) {
  const result = await client.query<{ day: string; last_seq: number }>(
    `INSERT INTO reservation_code_daily_seq (day, last_seq)
     VALUES (${ISTANBUL_DAY}, 1)
     ON CONFLICT (day)
     DO UPDATE SET last_seq = reservation_code_daily_seq.last_seq + 1
     RETURNING day::text AS day, last_seq`,
  );
  const row = result.rows[0];
  if (!row || row.last_seq > 9999) {
    throw new Error("Daily reservation code limit reached");
  }
  return formatReservationCode(row.day, row.last_seq);
}

/** Standalone allocation (own transaction). Prefer allocateReservationCode inside a wider transaction. */
export async function nextReservationCode() {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const code = await allocateReservationCode(client);
    await client.query("COMMIT");
    return code;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
