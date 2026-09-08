"use client";

import { useEffect, useState } from "react";
import { CheckoutSuccessPanel } from "@/components/booking/checkout-success-panel";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type Locale } from "@/lib/i18n/config";

type CheckoutSuccessGateProps = {
  locale: Locale;
  reservationCode: string;
  showTourGuideInfo: boolean;
  initiallyPaid: boolean;
  initiallyPendingPayment: boolean;
  updatedViaEdit?: boolean;
};

type StatusPayload = {
  ok?: boolean;
  paid?: boolean;
  pendingPayment?: boolean;
  reservationCode?: string;
};

export function CheckoutSuccessGate({
  locale,
  reservationCode,
  showTourGuideInfo,
  initiallyPaid,
  initiallyPendingPayment,
  updatedViaEdit = false,
}: CheckoutSuccessGateProps) {
  const copy = checkoutCopy[locale];
  const [paid, setPaid] = useState(initiallyPaid);
  const [code, setCode] = useState(reservationCode);
  const [pending, setPending] = useState(initiallyPendingPayment);

  useEffect(() => {
    if (paid || !pending) {
      return;
    }
    let cancelled = false;
    let attempts = 0;
    let timer = 0;

    async function poll(refreshProvider: boolean) {
      try {
        const params = refreshProvider ? "?refresh=1" : "";
        const response = await fetch(`/api/booking/payment/status${params}`);
        const payload = (await response.json()) as StatusPayload;
        if (cancelled || !response.ok || !payload.ok) {
          return;
        }
        if (payload.reservationCode) {
          setCode(payload.reservationCode);
        }
        if (payload.paid) {
          setPaid(true);
          setPending(false);
          return;
        }
        setPending(Boolean(payload.pendingPayment));
      } catch {
        // keep waiting
      }
    }

    void poll(false);

    const tick = () => {
      attempts += 1;
      // Callback is primary; provider refresh is a sparse fallback.
      const refreshProvider = attempts === 3 || attempts === 8;
      void poll(refreshProvider);
      if (attempts >= 20) {
        return;
      }
      timer = window.setTimeout(tick, attempts < 6 ? 2000 : 4000);
    };
    timer = window.setTimeout(tick, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [paid, pending]);

  if (paid) {
    return (
      <CheckoutSuccessPanel
        locale={locale}
        reservationCode={code}
        showTourGuideInfo={showTourGuideInfo}
        updatedViaEdit={updatedViaEdit}
      />
    );
  }

  return (
    <div className="booking-payment-redirect" role="status" aria-live="polite">
      <div className="booking-payment-redirect-card glass-surface">
        <div className="booking-payment-spinner" aria-hidden="true" />
        <h1 className="booking-payment-redirect-title">{copy.verifyingPayment}</h1>
        <p className="booking-payment-redirect-body">{copy.verifyingPaymentBody}</p>
      </div>
    </div>
  );
}
