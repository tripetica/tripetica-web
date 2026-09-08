import { type DisplayCurrency } from "@/lib/booking/pricing/format-eur";

export const ONLINE_PAYMENT_METHOD = "sbp" as const;
export const ONLINE_PAYMENT_PROVIDER = "turinvoice" as const;

export const ONLINE_PAYMENT_PENDING_STATUS = "pending" as const;
export const ONLINE_PAYMENT_PAID_STATUS = "paid" as const;

export const RESERVATION_PAYMENT_PENDING_STATUS = "payment_pending" as const;
export const RESERVATION_CONFIRMED_STATUS = "confirmed" as const;

export const SBP_UNSUPPORTED_CURRENCY = "GBP" as const;

export const SBP_ALLOWED_CURRENCIES = ["USD", "EUR", "RUB", "TRY"] as const satisfies readonly DisplayCurrency[];

export type SbpAllowedCurrency = (typeof SBP_ALLOWED_CURRENCIES)[number];

export function isSbpAllowedCurrency(value: string | null | undefined): value is SbpAllowedCurrency {
  const normalized = value?.trim().toUpperCase();
  return SBP_ALLOWED_CURRENCIES.some((code) => code === normalized);
}

export function paymentAmountsMatch(
  expected: number,
  actual: number,
): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
    return false;
  }
  if (Math.abs(expected - actual) < 0.005) {
    return true;
  }
  // Some providers send minor units (cents / kopecks).
  if (Math.abs(Math.round(expected * 100) - actual) < 0.5) {
    return true;
  }
  return false;
}

export function normalizePaymentCurrency(value: string | null | undefined) {
  return value?.trim().toUpperCase() || "";
}
