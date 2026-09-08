import "server-only";

import {
  requireTurinvoiceConfig,
  turinvoiceCallbackUrl,
  turinvoiceRedirectUrl,
  type TurinvoiceConfig,
} from "@/lib/payments/turinvoice/config";

export { turinvoiceCallbackUrl, turinvoiceRedirectUrl };

type LoginResponse = {
  ok?: boolean;
  error?: string;
};

export type TurinvoiceOrderCreateInput = {
  amount: number;
  currency: string;
  name: string;
  quantity?: number;
  callbackUrl: string;
  redirectUrl: string;
};

export type TurinvoiceRefund = {
  idRefund: string | null;
  idOrder: string;
  code: string | null;
  message: string | null;
  state: string | null;
  amount: number | null;
  currency: string | null;
  /** True only when provider accepted the refund request (code OK + idRefund). Not completed. */
  accepted: boolean;
  raw: Record<string, unknown>;
};

export type TurinvoiceOrderRefundEntry = {
  idRefund: string | null;
  state: string | null;
  amount: number | null;
  currency: string | null;
  raw: Record<string, unknown>;
};

export type TurinvoiceOrder = {
  idOrder: string;
  paymentUrl: string | null;
  state: string | null;
  amount: number | null;
  currency: string | null;
  /**
   * Raw refund entries from order detail when present.
   * TODO(Turinvoice): refund final-status contract must be confirmed with provider.
   * Do not treat a non-empty array as completed.
   */
  refunds: TurinvoiceOrderRefundEntry[];
  raw: Record<string, unknown>;
};

export type TurinvoiceRefundCreateInput = {
  idOrder: string;
  amount: number;
  currency: string;
  description?: string;
};

type SessionState = {
  cookie: string;
  expiresAtMs: number;
};

let session: SessionState | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const n = Number(value);
      if (Number.isFinite(n)) {
        return n;
      }
    }
  }
  return null;
}

function joinCookies(existing: string | null, setCookie: string | null) {
  if (!setCookie) {
    return existing;
  }
  const parts = setCookie.split(/,(?=[^;]+?=)/);
  const jar = new Map<string, string>();
  if (existing) {
    for (const piece of existing.split(";")) {
      const [name, ...rest] = piece.trim().split("=");
      if (name) {
        jar.set(name, rest.join("="));
      }
    }
  }
  for (const part of parts) {
    const [pair] = part.split(";");
    const [name, ...rest] = (pair ?? "").trim().split("=");
    if (name) {
      jar.set(name, rest.join("="));
    }
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(config: TurinvoiceConfig): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      login: config.login,
      password: config.password,
    }),
  });
  const setCookie = response.headers.get("set-cookie");
  const cookie = joinCookies(null, setCookie);
  if (!response.ok || !cookie) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Turinvoice login failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }
  session = {
    cookie,
    expiresAtMs: Date.now() + 25 * 60 * 1000,
  };
  return cookie;
}

async function authedFetch(
  config: TurinvoiceConfig,
  path: string,
  init: RequestInit,
  retried = false,
): Promise<Response> {
  let cookie =
    session && session.expiresAtMs > Date.now() ? session.cookie : null;
  if (!cookie) {
    cookie = await login(config);
  }
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Cookie", cookie);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers,
  });
  const nextCookie = joinCookies(cookie, response.headers.get("set-cookie"));
  if (nextCookie) {
    session = {
      cookie: nextCookie,
      expiresAtMs: Date.now() + 25 * 60 * 1000,
    };
  }
  if (response.status === 401 && !retried) {
    session = null;
    await login(config);
    return authedFetch(config, path, init, true);
  }
  return response;
}

import {
  parseTurinvoiceOrderRefundEntries,
  parseTurinvoiceRefundResponse,
} from "@/lib/payments/turinvoice/refund-parse";

function normalizeOrder(payload: unknown): TurinvoiceOrder {
  if (!isRecord(payload)) {
    throw new Error("Turinvoice order response is not an object");
  }
  const nested = isRecord(payload.data) ? payload.data : payload;
  const idOrder = pickString(nested, ["idOrder", "id", "orderId", "IdOrder"]);
  if (!idOrder) {
    throw new Error("Turinvoice order response missing idOrder");
  }
  return {
    idOrder,
    paymentUrl: pickString(nested, [
      "paymentUrl",
      "payment_url",
      "url",
      "payUrl",
    ]),
    state: pickString(nested, ["state", "status"]),
    amount: pickNumber(nested, ["amount", "sum", "price"]),
    currency: pickString(nested, ["currency", "curr"]),
    // TODO(Turinvoice): refund final-status contract must be confirmed with provider.
    refunds: parseTurinvoiceOrderRefundEntries(nested.refund ?? nested.refunds),
    raw: nested,
  };
}

export async function createTurinvoiceOrder(
  input: TurinvoiceOrderCreateInput,
): Promise<TurinvoiceOrder> {
  const config = requireTurinvoiceConfig();
  const body = {
    idTSP: config.tspId,
    amount: input.amount,
    name: input.name,
    currency: input.currency,
    quantity: input.quantity ?? 1,
    callbackUrl: input.callbackUrl,
    redirectUrl: input.redirectUrl,
  };
  const response = await authedFetch(config, "/api/v1/tsp/order", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(
      `Turinvoice create order failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }
  return normalizeOrder(json);
}

/**
 * Create order and ensure a browser payment URL is available (GET fallback).
 */
export async function createTurinvoiceOrderWithPaymentUrl(
  input: TurinvoiceOrderCreateInput,
): Promise<TurinvoiceOrder & { paymentUrl: string }> {
  const created = await createTurinvoiceOrder(input);
  let paymentUrl = created.paymentUrl;
  if (!paymentUrl) {
    const detailed = await getTurinvoiceOrder(created.idOrder);
    paymentUrl = detailed.paymentUrl;
  }
  if (!paymentUrl) {
    throw new Error(
      `Turinvoice order ${created.idOrder} created without paymentUrl`,
    );
  }
  return { ...created, paymentUrl };
}

export async function getTurinvoiceOrder(idOrder: string): Promise<TurinvoiceOrder> {
  const config = requireTurinvoiceConfig();
  const response = await authedFetch(
    config,
    `/api/v1/tsp/order?idOrder=${encodeURIComponent(idOrder)}`,
    { method: "GET" },
  );
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(
      `Turinvoice get order failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }
  return normalizeOrder(json);
}

/**
 * Cancel an unpaid Turinvoice order.
 * Provider route: DELETE /api/v1/tsp/order?idOrder=…
 * Local rows must only move to cancelled after this resolves successfully.
 */
export async function cancelTurinvoiceOrder(idOrder: string): Promise<{
  idOrder: string;
  state: string | null;
  raw: Record<string, unknown> | null;
}> {
  const trimmed = idOrder.trim();
  if (!trimmed) {
    throw new Error("Turinvoice cancel missing idOrder");
  }
  const config = requireTurinvoiceConfig();
  const response = await authedFetch(
    config,
    `/api/v1/tsp/order?idOrder=${encodeURIComponent(trimmed)}`,
    { method: "DELETE" },
  );
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(
      `Turinvoice cancel order failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }

  let state: string | null = null;
  let raw: Record<string, unknown> | null = isRecord(json) ? json : null;
  try {
    const detailed = await getTurinvoiceOrder(trimmed);
    state = detailed.state;
    raw = detailed.raw;
    const normalized = (state ?? "").trim().toLowerCase();
    if (
      normalized === "paid" ||
      normalized === "success" ||
      normalized === "successful" ||
      normalized === "completed"
    ) {
      throw new Error(
        `Turinvoice order ${trimmed} is paid after cancel attempt (state=${state})`,
      );
    }
  } catch (error) {
    // DELETE succeeded; GET may 404 for fully removed orders — treat as cancelled.
    if (
      error instanceof Error &&
      /get order failed \(404\)/.test(error.message)
    ) {
      return { idOrder: trimmed, state: "cancelled", raw };
    }
    if (error instanceof Error && /paid after cancel/.test(error.message)) {
      throw error;
    }
  }

  return { idOrder: trimmed, state, raw };
}

function normalizeRefund(payload: unknown, fallbackOrderId: string): TurinvoiceRefund {
  const parsed = parseTurinvoiceRefundResponse(payload, fallbackOrderId);
  const nested = parsed.raw;
  return {
    idRefund: parsed.idRefund,
    idOrder: parsed.idOrder,
    code: parsed.code,
    message: parsed.message,
    state: pickString(nested, ["state", "status"]),
    amount: pickNumber(nested, ["amount", "sum", "price"]),
    currency: pickString(nested, ["currency", "curr"]),
    accepted: parsed.accepted,
    raw: nested,
  };
}

/**
 * Submits a refund request to Turinvoice.
 * HTTP OK + code=OK + idRefund means accepted (local status: submitted only).
 * TODO(Turinvoice): refund final-status contract must be confirmed with provider.
 */
export async function createTurinvoiceRefund(
  input: TurinvoiceRefundCreateInput,
): Promise<TurinvoiceRefund> {
  const config = requireTurinvoiceConfig();
  const body: Record<string, unknown> = {
    idTSP: config.tspId,
    idOrder: input.idOrder,
    amount: input.amount,
    currency: input.currency,
  };
  if (input.description?.trim()) {
    body.description = input.description.trim();
  }
  const response = await authedFetch(config, "/api/v1/tsp/refund", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(
      `Turinvoice refund failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }
  const refund = normalizeRefund(json, input.idOrder);
  if (!refund.accepted) {
    throw new Error(
      `Turinvoice refund not accepted (code=${refund.code ?? "missing"}, idRefund=${refund.idRefund ?? "missing"}): ${
        refund.message ?? text.slice(0, 300)
      }`,
    );
  }
  return refund;
}

/**
 * Inspects order.refund[] without promoting Tripetica refund_status.
 * Returns raw entries only — never maps undocumented shapes to "completed".
 * TODO(Turinvoice): refund final-status contract must be confirmed with provider.
 */
export function extractTurinvoiceOrderRefunds(order: TurinvoiceOrder) {
  return order.refunds;
}

export type { LoginResponse };
