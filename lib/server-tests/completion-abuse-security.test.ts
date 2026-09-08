import test from "node:test";
import assert from "node:assert/strict";
import { type PoolClient } from "pg";
import {
  COMPLETION_RATE_LIMIT,
  completionAttemptIsIdempotent,
  normalizedCompletionEmailHash,
  recordAllowedCompletionAttempt,
} from "@/lib/booking/completion-rate-limit";
import { queueReservationEmails } from "@/lib/booking/reservation-email-queue";
import { trustedClientIpFromHeaders } from "@/lib/security/trusted-client-ip";
import { locationFromDraftLocation } from "@/lib/booking/transfer-draft-hydration";
import { verifyRecaptchaToken } from "@/lib/booking/recaptcha-verify";

type CapturedQuery = { sql: string; values: unknown[] };

function fakeClient(insertAllowed: boolean) {
  const queries: CapturedQuery[] = [];
  const client = {
    async query(sql: string, values: unknown[] = []) {
      queries.push({ sql, values });
      return {
        rows:
          sql.includes("INSERT INTO reservation_completion_attempts") &&
          insertAllowed
            ? [{ id: "attempt-id" }]
            : [],
      };
    },
  } as unknown as PoolClient;
  return { client, queries };
}

test("completion identity normalizes and hashes email without storing raw PII", () => {
  const first = normalizedCompletionEmailHash(" Trip@Example.COM ");
  const second = normalizedCompletionEmailHash("trip@example.com");
  assert.equal(first, second);
  assert.equal(first.includes("trip@example.com"), false);
});

test("missing CAPTCHA secret fails closed in DEV too", async () => {
  const previous = process.env.RECAPTCHA_SECRET_KEY;
  delete process.env.RECAPTCHA_SECRET_KEY;
  try {
    assert.equal(await verifyRecaptchaToken("client-token"), false);
  } finally {
    if (previous === undefined) {
      delete process.env.RECAPTCHA_SECRET_KEY;
    } else {
      process.env.RECAPTCHA_SECRET_KEY = previous;
    }
  }
});

test("idempotent completion replay bypasses new-attempt throttling", () => {
  assert.equal(completionAttemptIsIdempotent("existing-reservation"), true);
  assert.equal(completionAttemptIsIdempotent(null), false);
});

test("completion throttle atomically locks IP, session, email, and draft dimensions", async () => {
  const { client, queries } = fakeClient(true);
  const allowed = await recordAllowedCompletionAttempt(client, {
    browserSessionId: "11111111-1111-4111-8111-111111111111",
    reservationSearchId: "22222222-2222-4222-8222-222222222222",
    emailHash: "email-hash",
    ip: "203.0.113.8",
    now: new Date("2026-09-05T08:00:00.000Z"),
  });
  assert.equal(allowed, true);
  const locks = queries
    .filter((item) => item.sql.includes("pg_advisory_xact_lock"))
    .map((item) => item.values[0]);
  assert.deepEqual(locks, [...locks].sort());
  assert.ok(locks.includes("completion:ip:203.0.113.8"));
  assert.ok(locks.includes("completion:email:email-hash"));
  const insert = queries.find((item) =>
    item.sql.includes("INSERT INTO reservation_completion_attempts"),
  );
  assert.ok(insert);
  assert.ok(insert.values.includes(COMPLETION_RATE_LIMIT.emailMax));
  assert.ok(insert.values.includes(COMPLETION_RATE_LIMIT.draftMax));
});

test("exhausted completion budget records no successful attempt or reservation write", async () => {
  const { client, queries } = fakeClient(false);
  const allowed = await recordAllowedCompletionAttempt(client, {
    browserSessionId: "11111111-1111-4111-8111-111111111111",
    reservationSearchId: "22222222-2222-4222-8222-222222222222",
    emailHash: "email-hash",
    ip: "198.51.100.7",
  });
  assert.equal(allowed, false);
  assert.equal(
    queries.some((item) => /\bINSERT INTO reservations\b/.test(item.sql)),
    false,
  );
  assert.equal(
    queries.some((item) => /email_queued_at\s*=/.test(item.sql)),
    false,
  );
});

test("spoofed X-Forwarded-For cannot change completion throttle identity", () => {
  const headers = new Headers({
    "x-real-ip": "198.51.100.7",
    "x-forwarded-for": "203.0.113.99",
  });
  assert.equal(trustedClientIpFromHeaders(headers), "198.51.100.7");
});

test("reservation email queue accepts confirmed cash or provider-paid records only", async () => {
  const { client, queries } = fakeClient(true);
  await queueReservationEmails(client, "reservation-id");
  const sql = queries[0]?.sql ?? "";
  assert.match(sql, /status = 'confirmed'/);
  assert.match(sql, /payment_method = 'cash'/);
  assert.match(sql, /payment_status = 'paid'/);
  assert.doesNotMatch(sql, /payment_status = 'pending'/);
});

test("existing placeId-less legacy draft hydration remains usable", () => {
  const legacy = locationFromDraftLocation(
    {
      nameCustomer: "Legacy hotel",
      addressCustomer: "Legacy address",
      nameTr: null,
      addressTr: null,
      placeId: null,
      latitude: 41.01,
      longitude: 29.01,
      locationType: "hotel",
      airportCode: null,
      provinceCode: "istanbul",
      districtCode: "besiktas",
    },
    {
      IST: "Istanbul Airport",
      SAW: "Sabiha Gokcen Airport",
      AYT: "Antalya Airport",
    },
  );
  assert.equal(legacy.source, "query");
  assert.equal(legacy.lat, 41.01);
  assert.equal(legacy.lng, 29.01);
});
