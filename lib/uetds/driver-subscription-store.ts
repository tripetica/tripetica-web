import "server-only";

import { query } from "@/lib/db/postgres";
import {
  addSubscriptionMonths,
  buildPaidPeriodSnapshot,
  istanbulSubscriptionPeriodKey,
  isUetdsSubscriptionCurrency,
  isUetdsSubscriptionPeriodStatus,
  periodStatusForKey,
  type UetdsDriverSubscriptionListSummary,
  type UetdsDriverSubscriptionState,
  type UetdsSubscriptionCurrency,
  type UetdsSubscriptionPeriodRecord,
  type UetdsSubscriptionPeriodStatus,
} from "@/lib/uetds/driver-subscription";

type DriverSubscriptionRow = {
  uetds_subscription_enrolled_at: Date | null;
  uetds_subscription_monthly_fee: string | null;
  uetds_subscription_currency: string | null;
};

type PeriodRow = {
  period_year: number;
  period_month: number;
  status: string;
  amount_snapshot: string | null;
  currency_snapshot: string | null;
};

function money(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function mapPeriod(row: PeriodRow): UetdsSubscriptionPeriodRecord {
  const status = isUetdsSubscriptionPeriodStatus(row.status) ? row.status : "unpaid";
  const currency =
    row.currency_snapshot && isUetdsSubscriptionCurrency(row.currency_snapshot)
      ? row.currency_snapshot
      : null;
  return {
    year: row.period_year,
    month: row.period_month,
    status,
    amountSnapshot: money(row.amount_snapshot),
    currencySnapshot: currency,
  };
}

export async function getDriverUetdsSubscription(
  driverId: string,
): Promise<UetdsDriverSubscriptionState> {
  const driver = await query<DriverSubscriptionRow>(
    `SELECT uetds_subscription_enrolled_at,
            uetds_subscription_monthly_fee,
            uetds_subscription_currency
       FROM partner_drivers
      WHERE id = $1
        AND deleted_at IS NULL`,
    [driverId],
  );
  const row = driver.rows[0];
  if (!row) {
    return { enrolled: false, enrolledAt: null, monthlyFee: null, currency: null, periods: [] };
  }
  const periods = await query<PeriodRow>(
    `SELECT period_year, period_month, status, amount_snapshot, currency_snapshot
       FROM partner_driver_uetds_subscription_periods
      WHERE driver_id = $1
      ORDER BY period_year ASC, period_month ASC`,
    [driverId],
  );
  const currency =
    row.uetds_subscription_currency &&
    isUetdsSubscriptionCurrency(row.uetds_subscription_currency)
      ? row.uetds_subscription_currency
      : null;
  return {
    enrolled: Boolean(row.uetds_subscription_enrolled_at),
    enrolledAt: row.uetds_subscription_enrolled_at?.toISOString() ?? null,
    monthlyFee: money(row.uetds_subscription_monthly_fee),
    currency,
    periods: periods.rows.map(mapPeriod),
  };
}

export async function saveDriverUetdsSubscription(input: {
  driverId: string;
  partnerId: string;
  opsUserId: string;
  enrolled: boolean;
  monthlyFee: number | null;
  currency: UetdsSubscriptionCurrency | null;
  periods: Array<{
    year: number;
    month: number;
    status: UetdsSubscriptionPeriodStatus;
  }>;
}) {
  if (input.enrolled) {
    if (input.monthlyFee == null || input.currency == null) {
      return { ok: false as const, error: "invalid-subscription-fee" as const };
    }
  }
  if (input.currency != null && !isUetdsSubscriptionCurrency(input.currency)) {
    return { ok: false as const, error: "invalid-subscription-currency" as const };
  }

  const existing = await getDriverUetdsSubscription(input.driverId);
  const found = await query<{ id: string }>(
    `SELECT id
       FROM partner_drivers
      WHERE id = $1
        AND partner_id = $2
        AND deleted_at IS NULL`,
    [input.driverId, input.partnerId],
  );
  if (found.rowCount !== 1) {
    return { ok: false as const, error: "not-found" as const };
  }

  await query(
    `UPDATE partner_drivers
        SET uetds_subscription_enrolled_at = CASE
              WHEN $3::boolean THEN COALESCE(uetds_subscription_enrolled_at, NOW())
              ELSE NULL
            END,
            uetds_subscription_monthly_fee = $4,
            uetds_subscription_currency = $5,
            last_edited_by_ops_user_id = $6
      WHERE id = $1
        AND partner_id = $2
        AND deleted_at IS NULL`,
    [
      input.driverId,
      input.partnerId,
      input.enrolled,
      input.enrolled ? input.monthlyFee : null,
      input.enrolled ? input.currency : null,
      input.opsUserId,
    ],
  );

  for (const period of input.periods) {
    const previous =
      existing.periods.find((item) => item.year === period.year && item.month === period.month) ??
      null;
    let snapshot: { amountSnapshot: number | null; currencySnapshot: UetdsSubscriptionCurrency | null };
    try {
      snapshot = buildPaidPeriodSnapshot({
        status: period.status,
        previous,
        monthlyFee: input.monthlyFee,
        currency: input.currency,
      });
    } catch {
      return { ok: false as const, error: "invalid-subscription-fee" as const };
    }

    if (period.status === "unpaid" && !previous) {
      // Implicit default; no need to insert unpaid rows.
      continue;
    }

    await query(
      `INSERT INTO partner_driver_uetds_subscription_periods (
         driver_id, period_year, period_month, status,
         amount_snapshot, currency_snapshot, marked_at, marked_by_ops_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
       ON CONFLICT (driver_id, period_year, period_month)
       DO UPDATE SET
         status = EXCLUDED.status,
         amount_snapshot = EXCLUDED.amount_snapshot,
         currency_snapshot = EXCLUDED.currency_snapshot,
         marked_at = NOW(),
         marked_by_ops_user_id = EXCLUDED.marked_by_ops_user_id,
         updated_at = NOW()`,
      [
        input.driverId,
        period.year,
        period.month,
        period.status,
        snapshot.amountSnapshot,
        snapshot.currencySnapshot,
        input.opsUserId,
      ],
    );
  }

  return { ok: true as const };
}

export async function loadDriverUetdsSubscriptionEntitlement(driverId: string) {
  const state = await getDriverUetdsSubscription(driverId);
  return {
    enrolled: state.enrolled,
    periods: state.periods,
  };
}

/** Idempotent claim for reminder emails. Returns true only on first claim. */
export async function claimDriverUetdsSubscriptionReminder(input: {
  driverId: string;
  year: number;
  month: number;
  kind: string;
}) {
  const inserted = await query<{ id: string }>(
    `INSERT INTO partner_driver_uetds_subscription_reminders (
       driver_id, period_year, period_month, reminder_kind
     ) VALUES ($1, $2, $3, $4)
     ON CONFLICT (driver_id, period_year, period_month, reminder_kind) DO NOTHING
     RETURNING id`,
    [input.driverId, input.year, input.month, input.kind],
  );
  return inserted.rows[0]?.id ?? null;
}

export async function markDriverUetdsSubscriptionReminderSent(id: string) {
  await query(
    `UPDATE partner_driver_uetds_subscription_reminders
        SET sent_at = NOW()
      WHERE id = $1
        AND sent_at IS NULL`,
    [id],
  );
}

export type DriverUetdsSubscriptionListPatchResult =
  | {
      ok: true;
      summary: UetdsDriverSubscriptionListSummary;
    }
  | {
      ok: false;
      error:
        | "not-found"
        | "not-enrolled"
        | "forbidden-period"
        | "invalid-subscription-fee"
        | "invalid-subscription-currency"
        | "invalid-subscription-status";
    };

/**
 * Ops list inline patch for already-enrolled drivers only.
 * Viewing/listing never enrolls; enrollment stays on the driver detail checkbox.
 * Status changes are limited to the current Istanbul month or the next month.
 */
export async function patchDriverUetdsSubscriptionFromList(input: {
  driverId: string;
  opsUserId: string;
  patch:
    | { kind: "fee"; monthlyFee: number }
    | { kind: "currency"; currency: UetdsSubscriptionCurrency }
    | {
        kind: "currentStatus" | "nextStatus";
        status: UetdsSubscriptionPeriodStatus;
        year: number;
        month: number;
      };
}): Promise<DriverUetdsSubscriptionListPatchResult> {
  const current = istanbulSubscriptionPeriodKey();
  const next = addSubscriptionMonths(current, 1);
  if (input.patch.kind === "currentStatus" || input.patch.kind === "nextStatus") {
    const allowed = input.patch.kind === "currentStatus" ? current : next;
    if (input.patch.year !== allowed.year || input.patch.month !== allowed.month) {
      return { ok: false, error: "forbidden-period" };
    }
    if (!isUetdsSubscriptionPeriodStatus(input.patch.status)) {
      return { ok: false, error: "invalid-subscription-status" };
    }
  }
  if (input.patch.kind === "currency" && !isUetdsSubscriptionCurrency(input.patch.currency)) {
    return { ok: false, error: "invalid-subscription-currency" };
  }
  if (input.patch.kind === "fee") {
    if (!Number.isFinite(input.patch.monthlyFee) || input.patch.monthlyFee < 0) {
      return { ok: false, error: "invalid-subscription-fee" };
    }
  }

  const found = await query<{ id: string }>(
    `SELECT id
       FROM partner_drivers
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1`,
    [input.driverId],
  );
  if (!found.rows[0]) {
    return { ok: false, error: "not-found" };
  }

  const existing = await getDriverUetdsSubscription(input.driverId);
  if (!existing.enrolled) {
    return { ok: false, error: "not-enrolled" };
  }

  let nextFee = existing.monthlyFee;
  let nextCurrency = existing.currency;

  if (input.patch.kind === "fee") {
    nextFee = Math.round(input.patch.monthlyFee * 100) / 100;
  } else if (input.patch.kind === "currency") {
    nextCurrency = input.patch.currency;
  }

  if (nextFee == null || !nextCurrency) {
    return { ok: false, error: "invalid-subscription-fee" };
  }

  await query(
    `UPDATE partner_drivers
        SET uetds_subscription_monthly_fee = $2,
            uetds_subscription_currency = $3,
            last_edited_by_ops_user_id = $4
      WHERE id = $1
        AND deleted_at IS NULL
        AND uetds_subscription_enrolled_at IS NOT NULL`,
    [input.driverId, nextFee, nextCurrency, input.opsUserId],
  );

  let currentStatus: UetdsSubscriptionPeriodStatus = periodStatusForKey(
    existing.periods,
    current,
  );
  let nextStatus: UetdsSubscriptionPeriodStatus = periodStatusForKey(existing.periods, next);

  if (input.patch.kind === "currentStatus" || input.patch.kind === "nextStatus") {
    const statusPatch = input.patch;
    const previous =
      existing.periods.find(
        (item) => item.year === statusPatch.year && item.month === statusPatch.month,
      ) ?? null;
    let snapshot: {
      amountSnapshot: number | null;
      currencySnapshot: UetdsSubscriptionCurrency | null;
    };
    try {
      snapshot = buildPaidPeriodSnapshot({
        status: statusPatch.status,
        previous,
        monthlyFee: nextFee,
        currency: nextCurrency,
      });
    } catch {
      return { ok: false, error: "invalid-subscription-fee" };
    }

    let applied: UetdsSubscriptionPeriodStatus = statusPatch.status;
    if (!(statusPatch.status === "unpaid" && !previous)) {
      await query(
        `INSERT INTO partner_driver_uetds_subscription_periods (
           driver_id, period_year, period_month, status,
           amount_snapshot, currency_snapshot, marked_at, marked_by_ops_user_id
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         ON CONFLICT (driver_id, period_year, period_month)
         DO UPDATE SET
           status = EXCLUDED.status,
           amount_snapshot = EXCLUDED.amount_snapshot,
           currency_snapshot = EXCLUDED.currency_snapshot,
           marked_at = NOW(),
           marked_by_ops_user_id = EXCLUDED.marked_by_ops_user_id,
           updated_at = NOW()`,
        [
          input.driverId,
          statusPatch.year,
          statusPatch.month,
          statusPatch.status,
          snapshot.amountSnapshot,
          snapshot.currencySnapshot,
          input.opsUserId,
        ],
      );
    } else {
      applied = "unpaid";
    }
    if (statusPatch.kind === "currentStatus") currentStatus = applied;
    else nextStatus = applied;
  }

  return {
    ok: true,
    summary: {
      enrolled: true,
      monthlyFee: nextFee,
      currency: nextCurrency,
      currentPeriodStatus: currentStatus,
      nextPeriodStatus: nextStatus,
    },
  };
}

