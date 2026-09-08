import { type AccountCopy } from "@/lib/account/copy";
import { ONLINE_PAYMENT_METHOD } from "@/lib/payments/online-payment";

/** Customer-facing reservation status (not payment status). */
export function accountReservationStatusLabel(
  status: string | null | undefined,
  copy: AccountCopy,
) {
  const raw = (status ?? "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  if (raw === "cancelled") {
    return copy.reservationStatusCancelled;
  }
  return copy.reservationStatusActive;
}

export function accountReservationStatusBadgeClass(
  status: string | null | undefined,
) {
  const raw = (status ?? "").trim().toLowerCase();
  return raw === "cancelled"
    ? "ops-status-badge is-cancelled"
    : "ops-status-badge is-active";
}

export function isAccountReservationCancelled(
  status: string | null | undefined,
) {
  return (status ?? "").trim().toLowerCase() === "cancelled";
}

export function accountPaymentStatusLabel(
  paymentStatus: string | null | undefined,
  copy: AccountCopy,
) {
  const raw = (paymentStatus ?? "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  if (raw === "pending" || raw === "payment_pending") {
    return copy.paymentStatusPending;
  }
  if (raw === "paid" || raw === "completed") {
    return copy.paymentStatusPaid;
  }
  if (raw === "failed") {
    return copy.paymentStatusFailed;
  }
  return "";
}

export function accountPaymentMethodLabel(
  paymentMethod: string | null | undefined,
  copy: AccountCopy,
) {
  const raw = (paymentMethod ?? "").trim().toLowerCase();
  if (raw === ONLINE_PAYMENT_METHOD || raw === "sbp" || raw === "online") {
    return copy.paymentMethodOnline;
  }
  if (raw === "cash") {
    return copy.paymentMethodCash;
  }
  return "";
}

export function accountPaymentProviderLabel(
  paymentProvider: string | null | undefined,
) {
  const raw = (paymentProvider ?? "").trim();
  if (!raw) {
    return "";
  }
  if (raw.toLowerCase() === "turinvoice") {
    return "Turinvoice";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function isOnlineAccountPayment(
  paymentMethod: string | null | undefined,
) {
  const raw = (paymentMethod ?? "").trim().toLowerCase();
  return raw === ONLINE_PAYMENT_METHOD || raw === "sbp" || raw === "online";
}
