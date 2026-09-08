import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureTurinvoiceOrderForReservation,
  type EnsureTurinvoiceOrderDeps,
} from "@/lib/payments/turinvoice/ensure-order";

type ReservationState = {
  payment_provider: string | null;
  payment_provider_order_id: string | null;
  payment_provider_payment_url: string | null;
};

let createTurinvoiceOrderCalls = 0;
let reservationState: ReservationState;
let paymentTxnState: {
  provider_order_id: string | null;
  provider_payment_url: string | null;
};

const lockWaiters: Array<() => void> = [];
let rowLockHeld = false;

async function acquireRowLock() {
  if (!rowLockHeld) {
    rowLockHeld = true;
    return;
  }
  await new Promise<void>((resolve) => {
    lockWaiters.push(resolve);
  });
  rowLockHeld = true;
}

function releaseRowLock() {
  rowLockHeld = false;
  const next = lockWaiters.shift();
  if (next) {
    next();
  }
}

function resetMockState() {
  createTurinvoiceOrderCalls = 0;
  reservationState = {
    payment_provider: null,
    payment_provider_order_id: null,
    payment_provider_payment_url: null,
  };
  paymentTxnState = {
    provider_order_id: null,
    provider_payment_url: null,
  };
  lockWaiters.length = 0;
  rowLockHeld = false;
}

function mockTurinvoiceOrder(idOrder: string) {
  return {
    idOrder,
    paymentUrl: `https://payment.turinvoice.ru/${idOrder}`,
    state: "new",
    amount: 140,
    currency: "EUR",
    refunds: [],
    raw: { idOrder },
  };
}

function buildTestDeps(): EnsureTurinvoiceOrderDeps {
  return {
    getPool: () =>
      ({
        connect: async () => ({
          query: async (sql: string, params?: unknown[]) => {
            const normalized = sql.replace(/\s+/g, " ").trim().toUpperCase();

            if (normalized === "BEGIN") {
              return { rows: [] };
            }
            if (normalized === "COMMIT") {
              releaseRowLock();
              return { rows: [] };
            }
            if (normalized === "ROLLBACK") {
              releaseRowLock();
              return { rows: [] };
            }

            if (
              normalized.includes("FROM RESERVATIONS R") &&
              normalized.includes("FOR UPDATE")
            ) {
              await acquireRowLock();
              return {
                rows: [
                  {
                    id: params?.[0],
                    reservation_code: "TRP-TEST-0001",
                    status: "payment_pending",
                    locale: "tr",
                    payment_method: "sbp",
                    payment_status: "pending",
                    payment_provider: reservationState.payment_provider,
                    payment_provider_order_id:
                      reservationState.payment_provider_order_id,
                    payment_provider_payment_url:
                      reservationState.payment_provider_payment_url,
                    payment_amount: "140",
                    payment_currency: "EUR",
                    total_price: "140",
                    currency: "EUR",
                    browser_session_id: "browser-session-1",
                  },
                ],
              };
            }

            if (
              normalized.includes("FROM RESERVATION_PAYMENT_TRANSACTIONS") &&
              normalized.includes("SEQUENCE_NO = 1") &&
              normalized.includes("FOR UPDATE")
            ) {
              return { rows: [paymentTxnState] };
            }

            if (
              normalized.startsWith("UPDATE RESERVATIONS") &&
              normalized.includes("PAYMENT_PROVIDER_ORDER_ID IS NULL")
            ) {
              if (reservationState.payment_provider_order_id) {
                return { rows: [] };
              }
              reservationState = {
                payment_provider: "turinvoice",
                payment_provider_order_id: String(params?.[2] ?? ""),
                payment_provider_payment_url: String(params?.[3] ?? ""),
              };
              return { rows: [{ id: params?.[0] }] };
            }

            if (
              normalized.startsWith(
                "SELECT PAYMENT_PROVIDER_ORDER_ID, PAYMENT_PROVIDER_PAYMENT_URL",
              )
            ) {
              return {
                rows: [
                  {
                    payment_provider_order_id:
                      reservationState.payment_provider_order_id,
                    payment_provider_payment_url:
                      reservationState.payment_provider_payment_url,
                  },
                ],
              };
            }

            if (normalized.startsWith("UPDATE RESERVATION_PAYMENT_TRANSACTIONS")) {
              paymentTxnState = {
                provider_order_id: String(
                  params?.[1] ?? paymentTxnState.provider_order_id,
                ),
                provider_payment_url: String(
                  params?.[2] ?? paymentTxnState.provider_payment_url,
                ),
              };
              return { rows: [] };
            }

            return { rows: [] };
          },
          release: () => {},
        }),
      }) as EnsureTurinvoiceOrderDeps["getPool"] extends () => infer P
      ? P
      : never,
    createTurinvoiceOrder: async () => {
      createTurinvoiceOrderCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return mockTurinvoiceOrder("416295");
    },
    getTurinvoiceOrder: async (idOrder: string) => mockTurinvoiceOrder(idOrder),
    requireTurinvoiceConfig: () => ({
      env: "test" as const,
      appBaseUrl: "http://localhost:3000",
      baseUrl: "https://api.example",
      login: "login",
      password: "password",
      tspId: "tsp",
      callbackSecret: "secret",
    }),
    turinvoiceCallbackUrl: () =>
      "http://localhost:3000/api/payments/turinvoice/callback",
    turinvoiceRedirectUrl: () => "http://localhost:3000/tr/booking/success",
  };
}

test("parallel ensureTurinvoiceOrderForReservation creates one provider order", async () => {
  resetMockState();
  const deps = buildTestDeps();

  const [first, second] = await Promise.all([
    ensureTurinvoiceOrderForReservation("reservation-1", "browser-session-1", deps),
    ensureTurinvoiceOrderForReservation("reservation-1", "browser-session-1", deps),
  ]);

  assert.equal(createTurinvoiceOrderCalls, 1);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.equal(first.idOrder, "416295");
    assert.equal(second.idOrder, "416295");
    assert.equal(first.idOrder, second.idOrder);
    assert.equal(first.reused || second.reused, true);
  }
  assert.equal(reservationState.payment_provider_order_id, "416295");
  assert.equal(paymentTxnState.provider_order_id, "416295");
});

test("ensureTurinvoiceOrderForReservation reuses existing reservation order", async () => {
  resetMockState();
  reservationState = {
    payment_provider: "turinvoice",
    payment_provider_order_id: "416100",
    payment_provider_payment_url: "https://payment.turinvoice.ru/416100",
  };

  const result = await ensureTurinvoiceOrderForReservation(
    "reservation-1",
    "browser-session-1",
    buildTestDeps(),
  );

  assert.equal(createTurinvoiceOrderCalls, 0);
  assert.deepEqual(result, {
    ok: true,
    reservationId: "reservation-1",
    reservationCode: "TRP-TEST-0001",
    idOrder: "416100",
    paymentUrl: "https://payment.turinvoice.ru/416100",
    reused: true,
  });
});
