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
import {
  emptyDriverServices,
  selectedServiceTotal,
  type DriverServiceSelection,
} from "@/lib/uetds/service-subscriptions";

type VehicleSubscriptionRow = {
  uetds_subscription_enrolled_at: Date | null;
  uetds_subscription_monthly_fee: string | null;
  uetds_subscription_currency: string | null;
  service_standard_enabled: boolean;
  service_standard_fee: string | null;
  service_advanced_enabled: boolean;
  service_advanced_fee: string | null;
  service_gps_ats_enabled: boolean;
  service_gps_ats_fee: string | null;
  service_mobile_gps_enabled: boolean;
  service_mobile_gps_fee: string | null;
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

function servicesFrom(row: VehicleSubscriptionRow): DriverServiceSelection {
  return {
    standardEnabled: row.service_standard_enabled,
    standardFee: money(row.service_standard_fee),
    advancedEnabled: row.service_advanced_enabled,
    advancedFee: money(row.service_advanced_fee),
    gpsAtsEnabled: row.service_gps_ats_enabled,
    gpsAtsFee: money(row.service_gps_ats_fee),
    mobileEnabled: row.service_mobile_gps_enabled,
    mobileFee: money(row.service_mobile_gps_fee),
  };
}

export async function getVehicleUetdsSubscription(
  vehicleId: string,
): Promise<UetdsDriverSubscriptionState> {
  const vehicle = await query<VehicleSubscriptionRow>(
    `SELECT uetds_subscription_enrolled_at,
            uetds_subscription_monthly_fee,
            uetds_subscription_currency,
            service_standard_enabled,
            service_standard_fee,
            service_advanced_enabled,
            service_advanced_fee,
            service_gps_ats_enabled,
            service_gps_ats_fee,
            service_mobile_gps_enabled,
            service_mobile_gps_fee
       FROM partner_vehicles
      WHERE id = $1
        AND deleted_at IS NULL`,
    [vehicleId],
  );
  const row = vehicle.rows[0];
  if (!row) {
    return {
      enrolled: false,
      enrolledAt: null,
      monthlyFee: null,
      currency: null,
      periods: [],
      services: emptyDriverServices(),
    };
  }
  const periods = await query<PeriodRow>(
    `SELECT period_year, period_month, status, amount_snapshot, currency_snapshot
       FROM partner_vehicle_uetds_subscription_periods
      WHERE vehicle_id = $1
      ORDER BY period_year ASC, period_month ASC`,
    [vehicleId],
  );
  const currency =
    row.uetds_subscription_currency && isUetdsSubscriptionCurrency(row.uetds_subscription_currency)
      ? row.uetds_subscription_currency
      : null;
  const services = servicesFrom(row);
  return {
    enrolled: Boolean(row.uetds_subscription_enrolled_at),
    enrolledAt: row.uetds_subscription_enrolled_at?.toISOString() ?? null,
    monthlyFee: selectedServiceTotal(services) ?? money(row.uetds_subscription_monthly_fee),
    currency,
    periods: periods.rows.map(mapPeriod),
    services,
  };
}

export async function loadVehicleUetdsSubscriptionEntitlement(vehicleId: string) {
  const state = await getVehicleUetdsSubscription(vehicleId);
  return {
    enrolled: state.enrolled,
    periods: state.periods,
    standardEnabled: state.services.standardEnabled,
    advancedEnabled: state.services.advancedEnabled,
    gpsAtsEnabled: state.services.gpsAtsEnabled,
    mobileEnabled: state.services.mobileEnabled,
  };
}

export async function vehicleHasActivePhysicalGps(vehicleId: string) {
  const result = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM gps_devices
        WHERE vehicle_id = $1
          AND status = 'active'
     ) AS ok`,
    [vehicleId],
  );
  return Boolean(result.rows[0]?.ok);
}

export async function saveVehicleUetdsSubscription(input: {
  vehicleId: string;
  partnerId: string;
  opsUserId: string;
  enrolled: boolean;
  monthlyFee: number | null;
  currency: UetdsSubscriptionCurrency | null;
  services?: DriverServiceSelection;
  periods: Array<{ year: number; month: number; status: UetdsSubscriptionPeriodStatus }>;
}) {
  if (input.enrolled && (input.monthlyFee == null || input.currency == null)) {
    return { ok: false as const, error: "invalid-subscription-fee" as const };
  }
  if (input.currency != null && !isUetdsSubscriptionCurrency(input.currency)) {
    return { ok: false as const, error: "invalid-subscription-currency" as const };
  }
  const existing = await getVehicleUetdsSubscription(input.vehicleId);
  const found = await query<{ id: string }>(
    `SELECT id FROM partner_vehicles
      WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
    [input.vehicleId, input.partnerId],
  );
  if (found.rowCount !== 1) {
    return { ok: false as const, error: "not-found" as const };
  }
  const services = input.services;
  const billed = services ? selectedServiceTotal(services) : input.monthlyFee;
  await query(
    `UPDATE partner_vehicles
        SET uetds_subscription_enrolled_at = CASE
              WHEN $3::boolean THEN COALESCE(uetds_subscription_enrolled_at, NOW())
              ELSE NULL
            END,
            uetds_subscription_monthly_fee = $4,
            uetds_subscription_currency = $5,
            service_standard_enabled = COALESCE($7::boolean, service_standard_enabled),
            service_standard_fee = CASE WHEN $7::boolean IS NULL THEN service_standard_fee ELSE $8 END,
            service_advanced_enabled = COALESCE($9::boolean, service_advanced_enabled),
            service_advanced_fee = CASE WHEN $9::boolean IS NULL THEN service_advanced_fee ELSE $10 END,
            service_gps_ats_enabled = COALESCE($11::boolean, service_gps_ats_enabled),
            service_gps_ats_fee = CASE WHEN $11::boolean IS NULL THEN service_gps_ats_fee ELSE $12 END,
            service_mobile_gps_enabled = COALESCE($13::boolean, service_mobile_gps_enabled),
            service_mobile_gps_fee = CASE WHEN $13::boolean IS NULL THEN service_mobile_gps_fee ELSE $14 END,
            last_edited_by_ops_user_id = $6
      WHERE id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
    [
      input.vehicleId,
      input.partnerId,
      input.enrolled,
      billed,
      input.currency,
      input.opsUserId,
      services ? services.standardEnabled : null,
      services?.standardEnabled ? services.standardFee : null,
      services ? services.advancedEnabled : null,
      services?.advancedEnabled ? services.advancedFee : null,
      services ? services.gpsAtsEnabled : null,
      services?.gpsAtsEnabled ? services.gpsAtsFee : null,
      services ? services.mobileEnabled : null,
      services?.mobileEnabled ? services.mobileFee : null,
    ],
  );
  if (existing.services.mobileEnabled && services && !services.mobileEnabled) {
    await query(
      `UPDATE gps_mobile_sessions
          SET status = 'stopped', stopped_at = NOW(), stop_reason = 'subscription_closed'
        WHERE status = 'active'
          AND (
            vehicle_id = $1
            OR driver_id IN (SELECT driver_id FROM partner_fleet_defaults WHERE vehicle_id = $1)
          )`,
      [input.vehicleId],
    );
    await query(
      `INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, kind)
       SELECT $1, pairing.driver_id, $2, 'subscription_closed'
         FROM partner_fleet_defaults pairing
        WHERE pairing.vehicle_id = $2`,
      [input.partnerId, input.vehicleId],
    );
  }
  for (const period of input.periods) {
    const previous = existing.periods.find((item) => item.year === period.year && item.month === period.month) ?? null;
    let snapshot: { amountSnapshot: number | null; currencySnapshot: UetdsSubscriptionCurrency | null };
    try {
      snapshot = buildPaidPeriodSnapshot({
        status: period.status,
        previous,
        monthlyFee: billed,
        currency: input.currency,
      });
    } catch {
      return { ok: false as const, error: "invalid-subscription-fee" as const };
    }
    if (period.status === "unpaid" && !previous) continue;
    await query(
      `INSERT INTO partner_vehicle_uetds_subscription_periods (
         vehicle_id, period_year, period_month, status,
         amount_snapshot, currency_snapshot, marked_at, marked_by_ops_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
       ON CONFLICT (vehicle_id, period_year, period_month)
       DO UPDATE SET
         status = EXCLUDED.status,
         amount_snapshot = EXCLUDED.amount_snapshot,
         currency_snapshot = EXCLUDED.currency_snapshot,
         marked_at = NOW(),
         marked_by_ops_user_id = EXCLUDED.marked_by_ops_user_id,
         updated_at = NOW()`,
      [
        input.vehicleId,
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

export async function patchVehicleUetdsSubscriptionFromList(input: {
  vehicleId: string;
  opsUserId: string;
  patch:
    | { kind: "fee"; monthlyFee: number }
    | { kind: "currency"; currency: UetdsSubscriptionCurrency }
    | { kind: "currentStatus" | "nextStatus"; status: UetdsSubscriptionPeriodStatus; year: number; month: number };
}): Promise<
  | { ok: true; summary: UetdsDriverSubscriptionListSummary }
  | { ok: false; error: "not-found" | "not-enrolled" | "forbidden-period" | "invalid-subscription-fee" | "invalid-subscription-currency" | "invalid-subscription-status" }
> {
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
  if (input.patch.kind === "fee" && (!Number.isFinite(input.patch.monthlyFee) || input.patch.monthlyFee < 0)) {
    return { ok: false, error: "invalid-subscription-fee" };
  }
  const found = await query<{ id: string }>(
    `SELECT id FROM partner_vehicles WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [input.vehicleId],
  );
  if (!found.rows[0]) return { ok: false, error: "not-found" };
  const existing = await getVehicleUetdsSubscription(input.vehicleId);
  if (!existing.enrolled) return { ok: false, error: "not-enrolled" };
  let nextFee = existing.monthlyFee;
  let nextCurrency = existing.currency;
  if (input.patch.kind === "fee") nextFee = Math.round(input.patch.monthlyFee * 100) / 100;
  else if (input.patch.kind === "currency") nextCurrency = input.patch.currency;
  if (nextFee == null || !nextCurrency) return { ok: false, error: "invalid-subscription-fee" };
  await query(
    `UPDATE partner_vehicles
        SET uetds_subscription_monthly_fee = $2,
            uetds_subscription_currency = $3,
            last_edited_by_ops_user_id = $4
      WHERE id = $1 AND deleted_at IS NULL AND uetds_subscription_enrolled_at IS NOT NULL`,
    [input.vehicleId, nextFee, nextCurrency, input.opsUserId],
  );
  let currentStatus = periodStatusForKey(existing.periods, current);
  let nextStatus = periodStatusForKey(existing.periods, next);
  if (input.patch.kind === "currentStatus" || input.patch.kind === "nextStatus") {
    const statusPatch = input.patch;
    const previous = existing.periods.find((item) => item.year === statusPatch.year && item.month === statusPatch.month) ?? null;
    let snapshot: { amountSnapshot: number | null; currencySnapshot: UetdsSubscriptionCurrency | null };
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
        `INSERT INTO partner_vehicle_uetds_subscription_periods (
           vehicle_id, period_year, period_month, status,
           amount_snapshot, currency_snapshot, marked_at, marked_by_ops_user_id
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         ON CONFLICT (vehicle_id, period_year, period_month)
         DO UPDATE SET
           status = EXCLUDED.status,
           amount_snapshot = EXCLUDED.amount_snapshot,
           currency_snapshot = EXCLUDED.currency_snapshot,
           marked_at = NOW(),
           marked_by_ops_user_id = EXCLUDED.marked_by_ops_user_id,
           updated_at = NOW()`,
        [
          input.vehicleId,
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
