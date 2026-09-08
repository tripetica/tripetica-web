import "server-only";

import { createHash } from "node:crypto";
import { type PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";

export const COMPLETION_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  sessionMax: 8,
  emailMax: 5,
  ipMax: 20,
  draftMax: 6,
} as const;

type CompletionContextRow = {
  id: string;
  customer_email: string | null;
  reservation_id: string | null;
};

export type CompletionRateLimitResult =
  | { allowed: true; idempotent: boolean }
  | { allowed: false; idempotent: false };

export function normalizedCompletionEmailHash(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function completionAttemptIsIdempotent(
  reservationId: string | null | undefined,
) {
  return Boolean(reservationId);
}

async function lockRateLimitDimensions(
  client: PoolClient,
  dimensions: string[],
) {
  for (const dimension of [...new Set(dimensions)].sort()) {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [dimension],
    );
  }
}

export async function recordAllowedCompletionAttempt(
  client: PoolClient,
  input: {
    browserSessionId: string;
    reservationSearchId: string;
    emailHash: string;
    ip: string | null;
    now?: Date;
  },
) {
  await lockRateLimitDimensions(
    client,
    [
      `completion:session:${input.browserSessionId}`,
      `completion:email:${input.emailHash}`,
      `completion:draft:${input.reservationSearchId}`,
      ...(input.ip ? [`completion:ip:${input.ip}`] : []),
    ],
  );
  await client.query(
    `DELETE FROM reservation_completion_attempts
     WHERE attempted_at < NOW() - INTERVAL '24 hours'`,
  );
  const windowStart = new Date(
    (input.now ?? new Date()).getTime() - COMPLETION_RATE_LIMIT.windowMs,
  );
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO reservation_completion_attempts (
       browser_session_id,
       reservation_search_id,
       email_hash,
       ip
     )
     SELECT $1, $2, $3, $4
     WHERE (
       SELECT COUNT(*)
       FROM reservation_completion_attempts
       WHERE browser_session_id = $1
         AND attempted_at >= $5
     ) < $6
       AND (
         SELECT COUNT(*)
         FROM reservation_completion_attempts
         WHERE email_hash = $3
           AND attempted_at >= $5
       ) < $7
       AND (
         $4::text IS NULL
         OR (
           SELECT COUNT(*)
           FROM reservation_completion_attempts
           WHERE ip = $4
             AND attempted_at >= $5
         ) < $8
       )
       AND (
         SELECT COUNT(*)
         FROM reservation_completion_attempts
         WHERE reservation_search_id = $2
           AND attempted_at >= $5
       ) < $9
     RETURNING id`,
    [
      input.browserSessionId,
      input.reservationSearchId,
      input.emailHash,
      input.ip,
      windowStart,
      COMPLETION_RATE_LIMIT.sessionMax,
      COMPLETION_RATE_LIMIT.emailMax,
      COMPLETION_RATE_LIMIT.ipMax,
      COMPLETION_RATE_LIMIT.draftMax,
    ],
  );
  return Boolean(inserted.rows[0]);
}

export async function checkReservationCompletionRateLimit(input: {
  browserSessionId: string;
  ip: string | null;
}): Promise<CompletionRateLimitResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const context = await client.query<CompletionContextRow>(
      `SELECT
         s.id,
         s.customer_email,
         r.id AS reservation_id
       FROM reservation_searches s
       LEFT JOIN reservations r ON r.source_reservation_search_id = s.id
       WHERE s.browser_session_id = $1
       ORDER BY s.updated_at DESC
       LIMIT 1`,
      [input.browserSessionId],
    );
    const row = context.rows[0];
    if (!row?.customer_email) {
      await client.query("COMMIT");
      return { allowed: true, idempotent: false };
    }
    if (completionAttemptIsIdempotent(row.reservation_id)) {
      await client.query("COMMIT");
      return { allowed: true, idempotent: true };
    }

    const allowed = await recordAllowedCompletionAttempt(client, {
      browserSessionId: input.browserSessionId,
      reservationSearchId: row.id,
      emailHash: normalizedCompletionEmailHash(row.customer_email),
      ip: input.ip,
    });
    await client.query("COMMIT");
    return allowed
      ? { allowed: true, idempotent: false }
      : { allowed: false, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
