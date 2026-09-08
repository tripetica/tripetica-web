export type ReservationCompletionMode = "cash" | "sbp";

export function completionRequiresCaptcha(mode: ReservationCompletionMode) {
  return mode === "cash" || mode === "sbp";
}

export function completionEmailQueueTimestampSql(
  mode: ReservationCompletionMode,
) {
  return mode === "cash" ? "NOW()" : "NULL";
}

export function paidCallbackQueuesReservationNotifications(
  paymentKind: "initial_payment" | "additional_payment",
) {
  return paymentKind === "initial_payment";
}

export function paymentPendingExpiryPredicateSql(alias: string) {
  return `${alias}.status = 'payment_pending'
         AND ${alias}.payment_status = 'pending'
         AND ${alias}.payment_method = 'sbp'
         AND ${alias}.paid_at IS NULL
         AND ${alias}.confirmed_at IS NULL
         AND ${alias}.deleted_at IS NULL`;
}
