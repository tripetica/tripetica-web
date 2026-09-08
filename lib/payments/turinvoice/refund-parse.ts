/**
 * Turinvoice refund / order.refund parsing helpers (no network).
 * TODO(Turinvoice): refund final-status contract must be confirmed with provider.
 * Never map undocumented order.refund[] entries to Tripetica "completed".
 */

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

function messageFromRefundPayload(nested: Record<string, unknown>) {
  const message = nested.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  if (isRecord(message)) {
    for (const key of ["TR", "tr", "EN", "en", "RU", "ru"]) {
      const value = message[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return pickString(nested, ["error", "errorMessage", "detail"]);
}

export type ParsedTurinvoiceRefundResponse = {
  idRefund: string | null;
  idOrder: string;
  code: string | null;
  message: string | null;
  accepted: boolean;
  raw: Record<string, unknown>;
};

export type ParsedTurinvoiceOrderRefundEntry = {
  idRefund: string | null;
  state: string | null;
  amount: number | null;
  currency: string | null;
  raw: Record<string, unknown>;
};

export function parseTurinvoiceRefundResponse(
  payload: unknown,
  fallbackOrderId: string,
): ParsedTurinvoiceRefundResponse {
  if (!isRecord(payload)) {
    throw new Error("Turinvoice refund response is not an object");
  }
  const nested = isRecord(payload.data) ? payload.data : payload;
  const code = pickString(nested, ["code", "Code"]);
  const idRefund = pickString(nested, ["idRefund", "refundId", "IdRefund"]);
  const accepted = (code ?? "").toUpperCase() === "OK" && Boolean(idRefund);
  return {
    idRefund,
    idOrder:
      pickString(nested, ["idOrder", "orderId", "IdOrder"]) ?? fallbackOrderId,
    code,
    message: messageFromRefundPayload(nested),
    accepted,
    raw: nested,
  };
}

export function parseTurinvoiceOrderRefundEntries(
  value: unknown,
): ParsedTurinvoiceOrderRefundEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: ParsedTurinvoiceOrderRefundEntry[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    entries.push({
      idRefund: pickString(item, ["idRefund", "refundId", "id", "IdRefund"]),
      state: pickString(item, ["state", "status", "code"]),
      amount: pickNumber(item, ["amount", "sum", "price"]),
      currency: pickString(item, ["currency", "curr"]),
      raw: item,
    });
  }
  return entries;
}

/**
 * Order.refund[] presence must never alone mark a Tripetica refund completed.
 * TODO(Turinvoice): refund final-status contract must be confirmed with provider.
 */
export function shouldMarkRefundCompletedFromOrderRefunds(
  _entries: ParsedTurinvoiceOrderRefundEntry[],
): boolean {
  return false;
}
