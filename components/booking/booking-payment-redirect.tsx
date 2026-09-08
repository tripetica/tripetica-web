"use client";

import { useEffect, useState } from "react";
import { fetchPaymentStartOnce } from "@/lib/booking/payment-start-fetch";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type Locale } from "@/lib/i18n/config";

type BookingPaymentRedirectProps = {
  locale: Locale;
};

export function BookingPaymentRedirect({ locale }: BookingPaymentRedirectProps) {
  const copy = checkoutCopy[locale];
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const payload = await fetchPaymentStartOnce();
        if (!payload.paymentUrl) {
          if (!cancelled) {
            setError(copy.paymentRedirectError);
          }
          return;
        }
        // Redirect even if this effect was cleaned up (React Strict Mode remount).
        window.location.assign(payload.paymentUrl);
      } catch {
        if (!cancelled) {
          setError(copy.paymentRedirectError);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [copy.paymentRedirectError]);

  return (
    <div className="booking-payment-redirect" role="status" aria-live="polite">
      <div className="booking-payment-redirect-card glass-surface">
        <div className="booking-payment-spinner" aria-hidden="true" />
        <h1 className="booking-payment-redirect-title">{copy.paymentRedirectTitle}</h1>
        <p className="booking-payment-redirect-body">{copy.paymentRedirectBody}</p>
        {error ? (
          <p className="booking-payment-redirect-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
