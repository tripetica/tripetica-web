"use client";

import { CheckoutCaptcha } from "@/components/booking/checkout-captcha";
import {
  type CheckoutPaymentMethod,
} from "@/lib/booking/checkout-complete";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type Locale } from "@/lib/i18n/config";

type CheckoutPaymentProps = {
  locale: Locale;
  method: CheckoutPaymentMethod | null;
  captchaInstance: number;
  onMethodChange: (method: CheckoutPaymentMethod) => void;
  onCaptchaChange: (verified: boolean) => void;
};

function CashGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="checkout-pay-glyph" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SbpLogo() {
  return (
    <img
      src="/sbp.svg"
      alt=""
      className="checkout-pay-sbp"
      width={54}
      height={28}
      draggable={false}
    />
  );
}

export function CheckoutPayment({
  locale,
  method,
  captchaInstance,
  onMethodChange,
  onCaptchaChange,
}: CheckoutPaymentProps) {
  const copy = checkoutCopy[locale];
  return (
    <section className="checkout-card glass-surface" aria-labelledby="checkout-pay-title">
      <h2 id="checkout-pay-title" className="checkout-card-title">
        {copy.paymentMethodTitle}
      </h2>
      <div className="checkout-pay-grid" role="radiogroup" aria-labelledby="checkout-pay-title">
        <button
          type="button"
          role="radio"
          className={`checkout-pay-card${method === "cash" ? " is-selected" : ""}`}
          aria-checked={method === "cash"}
          onClick={() => onMethodChange("cash")}
        >
          <CashGlyph />
          <span className="checkout-pay-label">{copy.payCash}</span>
        </button>
        <button
          type="button"
          role="radio"
          className={`checkout-pay-card${method === "sbp" ? " is-selected" : ""}`}
          aria-checked={method === "sbp"}
          onClick={() => onMethodChange("sbp")}
        >
          <SbpLogo />
          <span className="checkout-pay-label">{copy.paySbp}</span>
        </button>
      </div>
      {method === "cash" ? (
        <CheckoutCaptcha
          key={captchaInstance}
          locale={locale}
          onVerified={onCaptchaChange}
        />
      ) : null}
    </section>
  );
}
