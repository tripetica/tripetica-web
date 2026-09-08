export type TurinvoiceCallbackPayload = {
  idOrder: string;
  state: string;
  amount: number;
  currency: string;
  datePay: string | null;
  secretKey: string;
};

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
      const n = Number(value.replace(",", "."));
      if (Number.isFinite(n)) {
        return n;
      }
    }
  }
  return null;
}

export function parseTurinvoiceCallbackBody(body: unknown): TurinvoiceCallbackPayload | null {
  if (!isRecord(body)) {
    return null;
  }
  const idOrder = pickString(body, ["idOrder", "id", "orderId", "IdOrder"]);
  const state = pickString(body, ["state", "status"]);
  const amount = pickNumber(body, ["amount", "sum", "price"]);
  const currency = pickString(body, ["currency", "curr"]);
  const secretKey = pickString(body, ["secret_key", "secretKey", "secret"]);
  const datePay = pickString(body, ["datePay", "date_pay", "paidAt", "paid_at"]);
  if (!idOrder || !state || amount == null || !currency || !secretKey) {
    return null;
  }
  return {
    idOrder,
    state: state.toLowerCase(),
    amount,
    currency,
    datePay,
    secretKey,
  };
}
