import {
  ONLINE_PAYMENT_METHOD,
  ONLINE_PAYMENT_PAID_STATUS,
  ONLINE_PAYMENT_PROVIDER,
} from "@/lib/payments/online-payment";
import { evaluateOpsCancelPolicy } from "@/lib/ops/cancellation-policy";
import { isReservationCancelled } from "@/lib/ops/record-detail";

export const REFUND_STATUS_SUBMITTED = "submitted" as const;
export const REFUND_STATUS_COMPLETED = "completed" as const;
export const REFUND_STATUS_FAILED = "failed" as const;

export type OpsRefundStatus =
  | typeof REFUND_STATUS_SUBMITTED
  | typeof REFUND_STATUS_COMPLETED
  | typeof REFUND_STATUS_FAILED;

export type OpsRefundBlockReason =
  | "not-cancelled"
  | "cash"
  | "not-paid"
  | "missing-order"
  | "already-refunded"
  | "missing-amount";

export type OpsRefundGate =
  | { ok: true; adminOverride: boolean }
  | { ok: false; reason: OpsRefundBlockReason };

export function isActiveRefundStatus(status: string | null | undefined) {
  const raw = status?.trim();
  return raw === REFUND_STATUS_SUBMITTED || raw === REFUND_STATUS_COMPLETED;
}

export function evaluateOpsRefundGate(input: {
  status: string | null | undefined;
  paymentMethod: string | null | undefined;
  paymentStatus: string | null | undefined;
  paymentProvider: string | null | undefined;
  paymentProviderOrderId: string | null | undefined;
  paymentAmount: string | number | null | undefined;
  paymentCurrency: string | null | undefined;
  refundStatus: string | null | undefined;
  serviceType: string | null | undefined;
  tourCode: string | null | undefined;
  pickupAt: Date | string | null | undefined;
  nowUtcMs?: number;
  /** When provided (ledger), overrides single refund_status already-refunded check. */
  remainingRefundableAmount?: number | null;
}): OpsRefundGate {
  if (!isReservationCancelled(input.status)) {
    return { ok: false, reason: "not-cancelled" };
  }
  if ((input.paymentMethod ?? "").trim() !== ONLINE_PAYMENT_METHOD) {
    return { ok: false, reason: "cash" };
  }
  if ((input.paymentStatus ?? "").trim() !== ONLINE_PAYMENT_PAID_STATUS) {
    return { ok: false, reason: "not-paid" };
  }
  const provider = (input.paymentProvider ?? "").trim();
  if (provider && provider !== ONLINE_PAYMENT_PROVIDER) {
    return { ok: false, reason: "missing-order" };
  }
  if (!(input.paymentProviderOrderId ?? "").trim()) {
    return { ok: false, reason: "missing-order" };
  }
  if (
    input.remainingRefundableAmount != null &&
    Number.isFinite(input.remainingRefundableAmount)
  ) {
    if (input.remainingRefundableAmount <= 0) {
      return { ok: false, reason: "already-refunded" };
    }
  } else if (isActiveRefundStatus(input.refundStatus)) {
    return { ok: false, reason: "already-refunded" };
  }
  const amount =
    typeof input.paymentAmount === "number"
      ? input.paymentAmount
      : Number(input.paymentAmount);
  if (!Number.isFinite(amount) || amount <= 0 || !(input.paymentCurrency ?? "").trim()) {
    return { ok: false, reason: "missing-amount" };
  }

  const policy = evaluateOpsCancelPolicy({
    serviceType: input.serviceType,
    tourCode: input.tourCode,
    pickupAt: input.pickupAt,
    nowUtcMs: input.nowUtcMs,
  });
  const adminOverride =
    policy.kind === "bosphorus-dinner" && policy.withinRefundWindow === false;

  return { ok: true, adminOverride };
}
