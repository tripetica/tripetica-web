/**
 * Driver-scoped U-ETDS subscription helpers (Ops-managed, Partner read-only).
 * Entitlement is independent of partner_drivers.status (active/inactive).
 */

import { BOOKING_TIME_ZONE } from "@/lib/booking/istanbul-time";

export const UETDS_SUBSCRIPTION_CURRENCIES = ["USD", "TRY", "EUR"] as const;
export type UetdsSubscriptionCurrency = (typeof UETDS_SUBSCRIPTION_CURRENCIES)[number];

export const UETDS_SUBSCRIPTION_PERIOD_STATUSES = ["unpaid", "paid", "free"] as const;
export type UetdsSubscriptionPeriodStatus = (typeof UETDS_SUBSCRIPTION_PERIOD_STATUSES)[number];

export const UETDS_SUBSCRIPTION_REMINDER_KINDS = [
  "two_days_before",
  "last_day",
  "expired",
] as const;
export type UetdsSubscriptionReminderKind = (typeof UETDS_SUBSCRIPTION_REMINDER_KINDS)[number];

export type UetdsSubscriptionPeriodKey = {
  year: number;
  month: number; // 1-12
};

export type UetdsSubscriptionPeriodRecord = UetdsSubscriptionPeriodKey & {
  status: UetdsSubscriptionPeriodStatus;
  amountSnapshot: number | null;
  currencySnapshot: UetdsSubscriptionCurrency | null;
};

export type UetdsDriverSubscriptionState = {
  enrolled: boolean;
  enrolledAt: string | null;
  monthlyFee: number | null;
  currency: UetdsSubscriptionCurrency | null;
  periods: UetdsSubscriptionPeriodRecord[];
};

/** Compact list-row projection shared by Ops/Partner driver tables. */
export type UetdsDriverSubscriptionListSummary = {
  enrolled: boolean;
  monthlyFee: number | null;
  currency: UetdsSubscriptionCurrency | null;
  /** null when unenrolled (display as —); unpaid when enrolled with no period row. */
  currentPeriodStatus: UetdsSubscriptionPeriodStatus | null;
  /** Same rules as currentPeriodStatus, for the following Istanbul calendar month. */
  nextPeriodStatus: UetdsSubscriptionPeriodStatus | null;
};

export const UETDS_SUBSCRIPTION_LIST_DEFAULT_FEE = 9;

export function mapUetdsSubscriptionListSummary(input: {
  enrolledAt: Date | string | null | undefined;
  monthlyFee: string | number | null | undefined;
  currency: string | null | undefined;
  currentPeriodStatus: string | null | undefined;
  nextPeriodStatus?: string | null | undefined;
}): UetdsDriverSubscriptionListSummary {
  const enrolled = Boolean(input.enrolledAt);
  const feeRaw =
    typeof input.monthlyFee === "number"
      ? input.monthlyFee
      : input.monthlyFee == null
        ? null
        : Number(input.monthlyFee);
  const monthlyFee =
    feeRaw != null && Number.isFinite(feeRaw) ? Math.round(feeRaw * 100) / 100 : null;
  const currency =
    input.currency && isUetdsSubscriptionCurrency(input.currency) ? input.currency : null;
  if (!enrolled) {
    return {
      enrolled: false,
      monthlyFee: null,
      currency: null,
      currentPeriodStatus: null,
      nextPeriodStatus: null,
    };
  }
  const status =
    input.currentPeriodStatus && isUetdsSubscriptionPeriodStatus(input.currentPeriodStatus)
      ? input.currentPeriodStatus
      : "unpaid";
  const nextStatus =
    input.nextPeriodStatus && isUetdsSubscriptionPeriodStatus(input.nextPeriodStatus)
      ? input.nextPeriodStatus
      : "unpaid";
  return {
    enrolled: true,
    monthlyFee,
    currency,
    currentPeriodStatus: status,
    nextPeriodStatus: nextStatus,
  };
}

export function isUetdsSubscriptionCurrency(value: string): value is UetdsSubscriptionCurrency {
  return (UETDS_SUBSCRIPTION_CURRENCIES as readonly string[]).includes(value);
}

export function isUetdsSubscriptionPeriodStatus(
  value: string,
): value is UetdsSubscriptionPeriodStatus {
  return (UETDS_SUBSCRIPTION_PERIOD_STATUSES as readonly string[]).includes(value);
}

export function parseUetdsSubscriptionFee(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

export function formatUetdsSubscriptionFee(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toFixed(2);
}

/** List/table display: formatted fee or an em dash when empty. */
export function formatUetdsSubscriptionFeeDisplay(fee: number | null | undefined) {
  return formatUetdsSubscriptionFee(fee ?? null) || "—";
}

/** Istanbul calendar month for subscription windows. */
export function istanbulSubscriptionPeriodKey(now: Date = new Date()): UetdsSubscriptionPeriodKey {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error("uetds_subscription_period_unavailable");
  }
  return { year, month };
}

export function addSubscriptionMonths(
  key: UetdsSubscriptionPeriodKey,
  delta: number,
): UetdsSubscriptionPeriodKey {
  const absolute = key.year * 12 + (key.month - 1) + delta;
  const year = Math.floor(absolute / 12);
  const month = (absolute % 12) + 1;
  return { year, month };
}

/** Current Istanbul month + next 11 months (12 total). */
export function subscriptionUiWindow(
  now: Date = new Date(),
): UetdsSubscriptionPeriodKey[] {
  const start = istanbulSubscriptionPeriodKey(now);
  return Array.from({ length: 12 }, (_, index) => addSubscriptionMonths(start, index));
}

export function periodKeyEquals(a: UetdsSubscriptionPeriodKey, b: UetdsSubscriptionPeriodKey) {
  return a.year === b.year && a.month === b.month;
}

export function periodStatusForKey(
  periods: readonly UetdsSubscriptionPeriodRecord[],
  key: UetdsSubscriptionPeriodKey,
): UetdsSubscriptionPeriodStatus {
  const found = periods.find((period) => periodKeyEquals(period, key));
  return found?.status ?? "unpaid";
}

/**
 * Server-side entitlement for U-ETDS notify/submit.
 * Unenrolled (legacy) drivers are allowed so rollout does not mass-block.
 */
export function isUetdsDriverSubscriptionEntitled(input: {
  enrolled: boolean;
  periods: readonly UetdsSubscriptionPeriodRecord[];
  now?: Date;
}): boolean {
  if (!input.enrolled) return true;
  const current = istanbulSubscriptionPeriodKey(input.now);
  const status = periodStatusForKey(input.periods, current);
  return status === "paid" || status === "free";
}

export function buildPaidPeriodSnapshot(input: {
  status: UetdsSubscriptionPeriodStatus;
  previous: UetdsSubscriptionPeriodRecord | null;
  monthlyFee: number | null;
  currency: UetdsSubscriptionCurrency | null;
}): { amountSnapshot: number | null; currencySnapshot: UetdsSubscriptionCurrency | null } {
  if (input.status !== "paid") {
    return { amountSnapshot: null, currencySnapshot: null };
  }
  // Keep prior paid snapshot when still paid (fee changes must not rewrite history).
  if (
    input.previous?.status === "paid" &&
    input.previous.amountSnapshot != null &&
    input.previous.currencySnapshot
  ) {
    return {
      amountSnapshot: input.previous.amountSnapshot,
      currencySnapshot: input.previous.currencySnapshot,
    };
  }
  if (input.monthlyFee == null || !input.currency) {
    throw new Error("uetds_subscription_paid_requires_fee");
  }
  return { amountSnapshot: input.monthlyFee, currencySnapshot: input.currency };
}

export function serializeSubscriptionPeriodsForForm(
  window: readonly UetdsSubscriptionPeriodKey[],
  periods: readonly UetdsSubscriptionPeriodRecord[],
) {
  return window
    .map((key) => {
      const status = periodStatusForKey(periods, key);
      return `${key.year}-${String(key.month).padStart(2, "0")}:${status}`;
    })
    .join(",");
}

export function parseSubscriptionPeriodsFromForm(
  raw: string,
): Array<UetdsSubscriptionPeriodKey & { status: UetdsSubscriptionPeriodStatus }> {
  const out: Array<UetdsSubscriptionPeriodKey & { status: UetdsSubscriptionPeriodStatus }> = [];
  for (const token of raw.split(",").map((item) => item.trim()).filter(Boolean)) {
    const [keyPart, statusPart] = token.split(":");
    if (!keyPart || !statusPart || !isUetdsSubscriptionPeriodStatus(statusPart)) continue;
    const [yearRaw, monthRaw] = keyPart.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) continue;
    out.push({ year, month, status: statusPart });
  }
  return out;
}

/** Short TR/EN/RU month labels for horizontal scroller. */
export function subscriptionPeriodLabel(
  key: UetdsSubscriptionPeriodKey,
  locale: "tr" | "en" | "ru",
) {
  const date = new Date(Date.UTC(key.year, key.month - 1, 1));
  const localeTag = locale === "tr" ? "tr-TR" : locale === "ru" ? "ru-RU" : "en-US";
  const month = new Intl.DateTimeFormat(localeTag, { month: "short", timeZone: "UTC" }).format(date);
  return `${month} ${key.year}`;
}
