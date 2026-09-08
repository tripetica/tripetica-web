import "server-only";

import { type PoolClient } from "pg";
import { getPool } from "@/lib/db/postgres";
import {
  createTurinvoiceOrder as defaultCreateTurinvoiceOrder,
  getTurinvoiceOrder as defaultGetTurinvoiceOrder,
} from "@/lib/payments/turinvoice/client";
import {
  requireTurinvoiceConfig as defaultRequireTurinvoiceConfig,
  turinvoiceCallbackUrl as defaultTurinvoiceCallbackUrl,
  turinvoiceRedirectUrl as defaultTurinvoiceRedirectUrl,
} from "@/lib/payments/turinvoice/config";
import {
  ONLINE_PAYMENT_METHOD,
  ONLINE_PAYMENT_PENDING_STATUS,
  ONLINE_PAYMENT_PROVIDER,
  RESERVATION_PAYMENT_PENDING_STATUS,
  isSbpAllowedCurrency,
} from "@/lib/payments/online-payment";

export type EnsureTurinvoiceOrderResult =
  | {
      ok: true;
      reservationId: string;
      reservationCode: string;
      idOrder: string;
      paymentUrl: string;
      reused: boolean;
    }
  | { ok: false; reason: "not-found" | "forbidden" | "invalid" | "not-pending" | "provider" };

type ReservationPaymentRow = {
  id: string;
  reservation_code: string;
  status: string;
  locale: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_provider: string | null;
  payment_provider_order_id: string | null;
  payment_provider_payment_url: string | null;
  payment_amount: string | null;
  payment_currency: string | null;
  total_price: string | null;
  currency: string | null;
  browser_session_id: string;
};

export type EnsureTurinvoiceOrderDeps = {
  getPool: typeof getPool;
  createTurinvoiceOrder: typeof defaultCreateTurinvoiceOrder;
  getTurinvoiceOrder: typeof defaultGetTurinvoiceOrder;
  requireTurinvoiceConfig: typeof defaultRequireTurinvoiceConfig;
  turinvoiceCallbackUrl: typeof defaultTurinvoiceCallbackUrl;
  turinvoiceRedirectUrl: typeof defaultTurinvoiceRedirectUrl;
};

function defaultEnsureTurinvoiceOrderDeps(): EnsureTurinvoiceOrderDeps {
  return {
    getPool,
    createTurinvoiceOrder: defaultCreateTurinvoiceOrder,
    getTurinvoiceOrder: defaultGetTurinvoiceOrder,
    requireTurinvoiceConfig: defaultRequireTurinvoiceConfig,
    turinvoiceCallbackUrl: defaultTurinvoiceCallbackUrl,
    turinvoiceRedirectUrl: defaultTurinvoiceRedirectUrl,
  };
}

async function loadOwnedReservationLocked(
  client: PoolClient,
  reservationId: string,
): Promise<
  | { ok: true; row: ReservationPaymentRow }
  | { ok: false; reason: "not-found" }
> {
  const result = await client.query<ReservationPaymentRow>(
    `SELECT
        r.id,
        r.reservation_code,
        r.status,
        r.locale,
        r.payment_method,
        r.payment_status,
        r.payment_provider,
        r.payment_provider_order_id,
        r.payment_provider_payment_url,
        r.payment_amount::text,
        r.payment_currency,
        r.total_price::text,
        r.currency,
        s.browser_session_id
     FROM reservations r
     INNER JOIN reservation_searches s ON s.id = r.source_reservation_search_id
     WHERE r.id = $1
       AND r.deleted_at IS NULL
     FOR UPDATE OF r`,
    [reservationId],
  );
  const row = result.rows[0];
  if (!row) {
    return { ok: false, reason: "not-found" };
  }
  return { ok: true, row };
}

function successReuse(
  row: ReservationPaymentRow,
  idOrder: string,
  paymentUrl: string,
): EnsureTurinvoiceOrderResult {
  return {
    ok: true,
    reservationId: row.id,
    reservationCode: row.reservation_code,
    idOrder,
    paymentUrl,
    reused: true,
  };
}

type InitialPaymentTxnRow = {
  provider_order_id: string | null;
  provider_payment_url: string | null;
};

async function loadInitialPendingPaymentTxnLocked(
  client: PoolClient,
  reservationId: string,
): Promise<InitialPaymentTxnRow | null> {
  const result = await client.query<InitialPaymentTxnRow>(
    `SELECT provider_order_id, provider_payment_url
     FROM reservation_payment_transactions
     WHERE reservation_id = $1
       AND sequence_no = 1
       AND status = 'pending'
     FOR UPDATE`,
    [reservationId],
  );
  return result.rows[0] ?? null;
}

async function linkInitialPaymentTransaction(
  client: PoolClient,
  reservationId: string,
  idOrder: string,
  paymentUrl: string,
) {
  await client.query(
    `UPDATE reservation_payment_transactions
     SET provider_order_id = COALESCE(provider_order_id, $2),
         provider_payment_url = COALESCE(provider_payment_url, $3)
     WHERE reservation_id = $1
       AND sequence_no = 1
       AND status = 'pending'`,
    [reservationId, idOrder, paymentUrl],
  );
}

async function ensureTurinvoiceOrderUnderLock(
  client: PoolClient,
  row: ReservationPaymentRow,
  browserSessionId: string,
  deps: EnsureTurinvoiceOrderDeps,
): Promise<EnsureTurinvoiceOrderResult> {
  if (row.browser_session_id !== browserSessionId) {
    return { ok: false, reason: "forbidden" };
  }
  if (row.payment_method !== ONLINE_PAYMENT_METHOD) {
    return { ok: false, reason: "invalid" };
  }
  if (
    row.status !== RESERVATION_PAYMENT_PENDING_STATUS ||
    row.payment_status !== ONLINE_PAYMENT_PENDING_STATUS
  ) {
    return { ok: false, reason: "not-pending" };
  }

  const initialTxn = await loadInitialPendingPaymentTxnLocked(client, row.id);
  if (initialTxn?.provider_order_id && initialTxn.provider_payment_url) {
    if (
      !row.payment_provider_order_id ||
      !row.payment_provider_payment_url
    ) {
      await client.query(
        `UPDATE reservations
         SET payment_provider = COALESCE(payment_provider, $2),
             payment_provider_order_id = COALESCE(payment_provider_order_id, $3),
             payment_provider_payment_url = COALESCE(payment_provider_payment_url, $4)
         WHERE id = $1`,
        [
          row.id,
          ONLINE_PAYMENT_PROVIDER,
          initialTxn.provider_order_id,
          initialTxn.provider_payment_url,
        ],
      );
    }
    return successReuse(
      row,
      initialTxn.provider_order_id,
      initialTxn.provider_payment_url,
    );
  }

  if (row.payment_provider_order_id && row.payment_provider_payment_url) {
    await linkInitialPaymentTransaction(
      client,
      row.id,
      row.payment_provider_order_id,
      row.payment_provider_payment_url,
    );
    return successReuse(
      row,
      row.payment_provider_order_id,
      row.payment_provider_payment_url,
    );
  }

  if (row.payment_provider_order_id && !row.payment_provider_payment_url) {
    try {
      const order = await deps.getTurinvoiceOrder(row.payment_provider_order_id);
      if (order.paymentUrl) {
        await client.query(
          `UPDATE reservations
           SET payment_provider_payment_url = $2
           WHERE id = $1
             AND payment_provider_order_id = $3`,
          [row.id, order.paymentUrl, row.payment_provider_order_id],
        );
        await linkInitialPaymentTransaction(
          client,
          row.id,
          row.payment_provider_order_id,
          order.paymentUrl,
        );
        return successReuse(row, row.payment_provider_order_id, order.paymentUrl);
      }
    } catch (error) {
      console.error("[Turinvoice] failed to refresh pending order", error);
    }
  }

  const amountRaw = row.payment_amount ?? row.total_price;
  const currencyRaw = (row.payment_currency ?? row.currency ?? "")
    .trim()
    .toUpperCase();
  const amount = amountRaw == null ? NaN : Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0 || !isSbpAllowedCurrency(currencyRaw)) {
    return { ok: false, reason: "invalid" };
  }

  deps.requireTurinvoiceConfig();
  const locale = row.locale === "en" || row.locale === "ru" ? row.locale : "tr";
  const created = await deps.createTurinvoiceOrder({
    amount,
    currency: currencyRaw,
    name: `Tripetica ${row.reservation_code}`,
    quantity: 1,
    callbackUrl: deps.turinvoiceCallbackUrl(),
    redirectUrl: deps.turinvoiceRedirectUrl(locale),
  });

  let paymentUrl = created.paymentUrl;
  if (!paymentUrl) {
    const detailed = await deps.getTurinvoiceOrder(created.idOrder);
    paymentUrl = detailed.paymentUrl;
  }
  if (!paymentUrl) {
    console.error("[Turinvoice] order created without paymentUrl", created.idOrder);
    return { ok: false, reason: "provider" };
  }

  const updated = await client.query<{ id: string }>(
    `UPDATE reservations
     SET payment_provider = $2,
         payment_provider_order_id = $3,
         payment_provider_payment_url = $4,
         payment_amount = $5,
         payment_currency = $6
     WHERE id = $1
       AND payment_status = $7
       AND status = $8
       AND payment_provider_order_id IS NULL
     RETURNING id`,
    [
      row.id,
      ONLINE_PAYMENT_PROVIDER,
      created.idOrder,
      paymentUrl,
      amount,
      currencyRaw,
      ONLINE_PAYMENT_PENDING_STATUS,
      RESERVATION_PAYMENT_PENDING_STATUS,
    ],
  );

  if (!updated.rows[0]) {
    const refreshed = await client.query<{
      payment_provider_order_id: string | null;
      payment_provider_payment_url: string | null;
    }>(
      `SELECT payment_provider_order_id, payment_provider_payment_url
       FROM reservations
       WHERE id = $1`,
      [row.id],
    );
    const existing = refreshed.rows[0];
    if (existing?.payment_provider_order_id && existing.payment_provider_payment_url) {
      return successReuse(
        row,
        existing.payment_provider_order_id,
        existing.payment_provider_payment_url,
      );
    }
    return { ok: false, reason: "provider" };
  }

  await linkInitialPaymentTransaction(
    client,
    row.id,
    created.idOrder,
    paymentUrl,
  );

  return {
    ok: true,
    reservationId: row.id,
    reservationCode: row.reservation_code,
    idOrder: created.idOrder,
    paymentUrl,
    reused: false,
  };
}

export async function ensureTurinvoiceOrderForReservation(
  reservationId: string,
  browserSessionId: string,
  deps: EnsureTurinvoiceOrderDeps = defaultEnsureTurinvoiceOrderDeps(),
): Promise<EnsureTurinvoiceOrderResult> {
  const client = await deps.getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await loadOwnedReservationLocked(client, reservationId);
    if (!locked.ok) {
      await client.query("ROLLBACK");
      return { ok: false, reason: locked.reason };
    }
    const result = await ensureTurinvoiceOrderUnderLock(
      client,
      locked.row,
      browserSessionId,
      deps,
    );
    if (!result.ok) {
      await client.query("ROLLBACK");
      return result;
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[Turinvoice] ensure order failed", error);
    return { ok: false, reason: "provider" };
  } finally {
    client.release();
  }
}

/**
 * Link or create a Turinvoice order for a pending payment transaction row.
 * Used by edit additional-payment flow; serializes on the payment txn row.
 */
export async function ensureTurinvoiceOrderForPaymentTransaction(input: {
  paymentTransactionId: string;
  amount: number;
  currency: string;
  orderName: string;
  locale: string;
}): Promise<
  | { ok: true; idOrder: string; paymentUrl: string; reused: boolean }
  | { ok: false; reason: "not-found" | "not-pending" | "invalid" | "provider" }
> {
  const currency = input.currency.trim().toUpperCase();
  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    !isSbpAllowedCurrency(currency)
  ) {
    return { ok: false, reason: "invalid" };
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: string;
      status: string;
      provider_order_id: string | null;
      provider_payment_url: string | null;
    }>(
      `SELECT id, status, provider_order_id, provider_payment_url
       FROM reservation_payment_transactions
       WHERE id = $1
       FOR UPDATE`,
      [input.paymentTransactionId],
    );
    const row = locked.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-found" };
    }
    if ((row.status ?? "").trim().toLowerCase() !== "pending") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not-pending" };
    }
    if (row.provider_order_id && row.provider_payment_url) {
      await client.query("COMMIT");
      return {
        ok: true,
        idOrder: row.provider_order_id,
        paymentUrl: row.provider_payment_url,
        reused: true,
      };
    }

    defaultRequireTurinvoiceConfig();
    const locale =
      input.locale === "en" || input.locale === "ru" ? input.locale : "tr";
    const created = await defaultCreateTurinvoiceOrder({
      amount: input.amount,
      currency,
      name: input.orderName,
      quantity: 1,
      callbackUrl: defaultTurinvoiceCallbackUrl(),
      redirectUrl: defaultTurinvoiceRedirectUrl(locale),
    });

    let paymentUrl = created.paymentUrl;
    if (!paymentUrl) {
      const detailed = await defaultGetTurinvoiceOrder(created.idOrder);
      paymentUrl = detailed.paymentUrl;
    }
    if (!paymentUrl) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "provider" };
    }

    const updated = await client.query<{ id: string }>(
      `UPDATE reservation_payment_transactions
       SET provider_order_id = $2,
           provider_payment_url = $3,
           provider_response = $4::jsonb
       WHERE id = $1
         AND status = 'pending'
         AND provider_order_id IS NULL
       RETURNING id`,
      [
        row.id,
        created.idOrder,
        paymentUrl,
        JSON.stringify(created.raw),
      ],
    );

    if (!updated.rows[0]) {
      const again = await client.query<{
        provider_order_id: string | null;
        provider_payment_url: string | null;
      }>(
        `SELECT provider_order_id, provider_payment_url
         FROM reservation_payment_transactions
         WHERE id = $1`,
        [row.id],
      );
      const existing = again.rows[0];
      if (existing?.provider_order_id && existing.provider_payment_url) {
        await client.query("COMMIT");
        return {
          ok: true,
          idOrder: existing.provider_order_id,
          paymentUrl: existing.provider_payment_url,
          reused: true,
        };
      }
      await client.query("ROLLBACK");
      return { ok: false, reason: "provider" };
    }

    await client.query("COMMIT");
    return {
      ok: true,
      idOrder: created.idOrder,
      paymentUrl,
      reused: false,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[Turinvoice] ensure payment txn order failed", error);
    return { ok: false, reason: "provider" };
  } finally {
    client.release();
  }
}
