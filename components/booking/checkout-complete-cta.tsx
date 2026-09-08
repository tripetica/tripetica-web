"use client";

import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type Locale } from "@/lib/i18n/config";

type CheckoutCompleteCtaProps = {
  locale: Locale;
  total: string;
  loading: boolean;
  disabled?: boolean;
  paymentMethod: "cash" | "sbp" | null;
  completedCode: string | null;
  error: string | null;
  onComplete: () => void;
};

export function CheckoutCompleteCta({
  locale,
  total,
  loading,
  disabled = false,
  paymentMethod,
  completedCode,
  error,
  onComplete,
}: CheckoutCompleteCtaProps) {
  const copy = checkoutCopy[locale];
  const locked = Boolean(completedCode) || loading || disabled;
  const idleLabel =
    paymentMethod === "sbp" ? copy.proceedToPayment : copy.completeReservation;
  const loadingLabel =
    paymentMethod === "sbp" ? copy.proceedingToPayment : copy.completingReservation;
  return (
    <section className="checkout-card glass-surface checkout-finish" aria-labelledby="checkout-finish-title">
      <h2 id="checkout-finish-title" className="sr-only">
        {idleLabel}
      </h2>
      <p className="checkout-finish-total">
        <span>{copy.total}</span>
        <strong>{total}</strong>
      </p>
      {completedCode ? (
        <div className="checkout-finish-success" role="status">
          <p>{copy.reservationCreated}</p>
          <p className="checkout-finish-code">
            <span>{copy.reservationCodeLabel}</span>
            <strong>{completedCode}</strong>
          </p>
        </div>
      ) : null}
      {error ? <p className="checkout-finish-error">{error}</p> : null}
      <button
        type="button"
        className="checkout-finish-cta"
        disabled={locked}
        aria-busy={loading}
        onClick={onComplete}
      >
        {loading ? loadingLabel : idleLabel}
      </button>
    </section>
  );
}
