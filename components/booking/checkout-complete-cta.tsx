"use client";

import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type Locale } from "@/lib/i18n/config";

type CheckoutCompleteCtaProps = {
  locale: Locale;
  total: string;
  enabled: boolean;
};

export function CheckoutCompleteCta({ locale, total, enabled }: CheckoutCompleteCtaProps) {
  const copy = checkoutCopy[locale];
  return (
    <section className="checkout-card glass-surface checkout-finish" aria-labelledby="checkout-finish-title">
      <h2 id="checkout-finish-title" className="sr-only">
        {copy.completeReservation}
      </h2>
      <p className="checkout-finish-total">
        <span>{copy.total}</span>
        <strong>{total}</strong>
      </p>
      <button
        type="button"
        className="checkout-finish-cta"
        disabled={!enabled}
        onClick={() => undefined}
      >
        {copy.completeReservation}
      </button>
    </section>
  );
}
