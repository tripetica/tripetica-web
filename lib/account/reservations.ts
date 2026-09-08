import "server-only";

import { query } from "@/lib/db/postgres";
import { VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL } from "@/lib/account/customer-reservation-access-policy";
import {
  evaluateCustomerCancel,
  evaluateCustomerEdit,
  evaluateCustomerReactivate,
} from "@/lib/account/customer-status-policy";
import { findReservationVoucherById } from "@/lib/booking/reservation-voucher-access";
import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { voucherServiceTypeLabel } from "@/lib/booking/voucher-copy";
import { type Locale } from "@/lib/i18n/config";

export type AccountReservationListItem = {
  id: string;
  reservationCode: string | null;
  pickupAt: string | null;
  serviceType: string | null;
  tourCode: string | null;
  serviceTypeLabel: string;
  pickupLabel: string | null;
  dropoffLabel: string | null;
  totalPrice: string | null;
  currency: string | null;
  status: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
};

export type AccountReservationDetail = {
  id: string;
  reservationCode: string;
  status: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentProvider: string | null;
  notes: string | null;
  serviceTypeLabel: string;
  dateTime: string;
  durationValue: string | null;
  pickupName: string;
  pickupAddress: string;
  dropoffName: string;
  dropoffAddress: string;
  vehicleLabel: string;
  showVehicleClass: boolean;
  passengerCount: number;
  luggageCount: number;
  babySeatCount: number;
  passengerNames: string[];
  pickupIsAirport: boolean;
  flightCode: string | null;
  meetAndGreet: boolean | null;
  packageCoverageValue: string | null;
  packageNotes: string[];
  participantBreakdown: string[] | null;
  participantBreakdownHeading: string | null;
  includedSectionTitle: string | null;
  includedItems: string[] | null;
  serviceInfoSectionTitle: string | null;
  serviceInfoGroups: Array<{ title: string; body: string }> | null;
  totalLabel: string;
  otherCurrencyLine: string | null;
  currency: string | null;
  paymentMethodLabel: string;
  isBosphorusDinner: boolean;
  canCancel: boolean;
  canReactivate: boolean;
  canEdit: boolean;
  cancelBlockedReason: "within_six_hours" | null;
  reactivateBlockedReason: "within_six_hours" | "bosphorus_after_cutoff" | null;
  editBlockedReason: "within_six_hours" | "cancelled" | null;
  /** True when cancel would issue a full refund of remaining collected online payment. */
  cancelWillRefund: boolean;
  finance: {
    reservationTotal: number | null;
    currency: string | null;
    totalPaid: number;
    refundRequested: number;
    refunded: number;
    refundableAmount: number;
    refundStatus: "submitted" | "completed" | "failed" | "partial" | null;
  } | null;
};

type Row = {
  id: string;
  reservation_code: string | null;
  pickup_at: Date | null;
  service_type: string | null;
  tour_code: string | null;
  pickup_name_customer: string | null;
  dropoff_name_customer: string | null;
  total_price: string | null;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
};

type OwnedMetaRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_provider: string | null;
  notes: string | null;
  currency: string | null;
  total_price: string | null;
  luggage_count: number | null;
  baby_seat_count: number | null;
  passenger_count: number | null;
  pickup_at: Date | null;
  service_type: string | null;
  tour_code: string | null;
};

function mapRow(row: Row, locale: Locale): AccountReservationListItem {
  return {
    id: row.id,
    reservationCode: row.reservation_code,
    pickupAt: row.pickup_at ? row.pickup_at.toISOString() : null,
    serviceType: row.service_type,
    tourCode: row.tour_code,
    serviceTypeLabel: voucherServiceTypeLabel(
      row.service_type,
      locale,
      row.tour_code,
    ),
    pickupLabel: row.pickup_name_customer,
    dropoffLabel: row.dropoff_name_customer,
    totalPrice: row.total_price,
    currency: row.currency,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
  };
}

function asCount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) {
    return 0;
  }
  return Math.max(0, Math.floor(Number(value)));
}

export async function listAccountReservations(input: {
  userId: string;
  locale: Locale;
}) {
  const result = await query<Row>(
    `SELECT id, reservation_code, pickup_at, service_type, tour_code,
            pickup_name_customer, dropoff_name_customer,
            total_price::text, currency, status, payment_status, payment_method
     FROM reservations r
     WHERE r.deleted_at IS NULL
       AND ${VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL}
     ORDER BY pickup_at DESC NULLS LAST, created_at DESC
     LIMIT 100`,
    [input.userId],
  );
  return result.rows.map((row) => mapRow(row, input.locale));
}

export async function getAccountReservation(
  userId: string,
  reservationId: string,
  locale: Locale = "en",
) {
  const result = await query<Row>(
    `SELECT id, reservation_code, pickup_at, service_type, tour_code,
            pickup_name_customer, dropoff_name_customer,
            total_price::text, currency, status, payment_status, payment_method
     FROM reservations r
     WHERE r.id = $2
       AND r.deleted_at IS NULL
       AND ${VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL}
     LIMIT 1`,
    [userId, reservationId],
  );
  const row = result.rows[0];
  return row ? mapRow(row, locale) : null;
}

export async function getAccountReservationDetail(input: {
  userId: string;
  reservationId: string;
  locale: Locale;
}): Promise<AccountReservationDetail | null> {
  const reservationId = input.reservationId.trim();
  if (!reservationId) {
    return null;
  }
  const owned = await query<OwnedMetaRow>(
    `SELECT id, status, payment_status, payment_method, payment_provider,
            notes, currency, total_price::text, luggage_count, baby_seat_count, passenger_count,
            pickup_at, service_type, tour_code
     FROM reservations r
     WHERE r.id = $2
       AND r.deleted_at IS NULL
       AND ${VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL}
     LIMIT 1`,
    [input.userId, reservationId],
  );
  const meta = owned.rows[0];
  if (!meta) {
    return null;
  }

  const voucher = await findReservationVoucherById(meta.id, input.locale);
  if (!voucher) {
    return null;
  }

  const cancel = evaluateCustomerCancel({
    status: meta.status,
    pickupAt: meta.pickup_at,
  });
  const edit = evaluateCustomerEdit({
    status: meta.status,
    pickupAt: meta.pickup_at,
  });
  const reactivate = evaluateCustomerReactivate({
    status: meta.status,
    serviceType: meta.service_type,
    tourCode: meta.tour_code,
    pickupAt: meta.pickup_at,
  });

  let finance: AccountReservationDetail["finance"] = null;
  let cancelWillRefund = false;
  if ((meta.payment_method ?? "").trim().toLowerCase() === "sbp") {
    try {
      const { loadReservationFinancialSummary } = await import(
        "@/lib/payments/ledger/store"
      );
      const { remainingRefundableFromSummary } = await import(
        "@/lib/payments/ledger/math"
      );
      const total =
        meta.total_price != null && Number.isFinite(Number(meta.total_price))
          ? Number(meta.total_price)
          : null;
      const summary = await loadReservationFinancialSummary({
        reservationId: meta.id,
        currentTotal: total,
        currentCurrency: meta.currency,
      });
      const refundableAmount = remainingRefundableFromSummary(summary);
      const refundStatus =
        summary.pendingRefunds > 0 && summary.completedRefunds > 0
          ? ("partial" as const)
          : summary.pendingRefunds > 0
            ? ("submitted" as const)
            : summary.completedRefunds > 0
              ? ("completed" as const)
              : null;
      finance = {
        reservationTotal: total,
        currency: summary.currency ?? meta.currency,
        totalPaid: summary.grossSuccessfulPayments,
        refundRequested: summary.pendingRefunds,
        refunded: summary.completedRefunds,
        refundableAmount: Math.max(0, refundableAmount),
        refundStatus,
      };
      cancelWillRefund = refundableAmount > 0;
    } catch {
      finance = null;
    }
  }

  return {
    id: meta.id,
    reservationCode: voucher.reservationCode,
    status: meta.status,
    paymentStatus: meta.payment_status,
    paymentMethod: meta.payment_method,
    paymentProvider: meta.payment_provider,
    notes: meta.notes?.trim() || null,
    serviceTypeLabel: voucher.serviceTypeLabel,
    dateTime: voucher.dateTime,
    durationValue: voucher.durationValue,
    pickupName: voucher.pickupName,
    pickupAddress: voucher.pickupAddress,
    dropoffName: voucher.dropoffName,
    dropoffAddress: voucher.dropoffAddress,
    vehicleLabel: voucher.vehicleLabel,
    showVehicleClass: voucher.showVehicleClass,
    passengerCount: asCount(voucher.passengerCount ?? meta.passenger_count),
    luggageCount: asCount(voucher.luggageCount ?? meta.luggage_count),
    babySeatCount: asCount(voucher.babySeatCount ?? meta.baby_seat_count),
    passengerNames: voucher.passengerNames,
    pickupIsAirport: voucher.pickupIsAirport,
    flightCode: voucher.flightCode?.trim() || null,
    meetAndGreet: voucher.meetAndGreet,
    packageCoverageValue: voucher.packageCoverageValue,
    packageNotes: voucher.packageOverrunNote?.split("\n").filter(Boolean) ?? [],
    participantBreakdown: voucher.participantBreakdown,
    participantBreakdownHeading: voucher.participantBreakdownHeading,
    includedSectionTitle: voucher.includedSectionTitle,
    includedItems: voucher.includedItems,
    serviceInfoSectionTitle: voucher.serviceInfoSectionTitle,
    serviceInfoGroups: voucher.serviceInfoGroups,
    totalLabel: voucher.totalLabel,
    otherCurrencyLine: voucher.otherCurrencyLine,
    currency: meta.currency,
    paymentMethodLabel: voucher.paymentMethodLabel,
    isBosphorusDinner: isBosphorusDinnerTour(meta.service_type, meta.tour_code),
    canCancel: cancel.allowed,
    canReactivate: reactivate.allowed,
    canEdit: edit.allowed,
    cancelWillRefund,
    cancelBlockedReason:
      cancel.reason === "within_six_hours" ? "within_six_hours" : null,
    reactivateBlockedReason:
      reactivate.reason === "within_six_hours" ||
      reactivate.reason === "bosphorus_after_cutoff"
        ? reactivate.reason
        : null,
    editBlockedReason:
      edit.reason === "within_six_hours" || edit.reason === "cancelled"
        ? edit.reason
        : null,
    finance,
  };
}
