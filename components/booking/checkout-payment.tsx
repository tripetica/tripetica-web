"use client";

import { CheckoutCaptcha } from "@/components/booking/checkout-captcha";
import {
  type CheckoutPaymentMethod,
} from "@/lib/booking/checkout-complete";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { displayAmountFromEur } from "@/lib/booking/fx/convert";
import {
  formatCurrencyPill,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import { type FxRateQuote } from "@/lib/booking/fx/types";
import {
  SBP_UNSUPPORTED_CURRENCY,
  type SbpAllowedCurrency,
} from "@/lib/payments/online-payment";
import { type Locale } from "@/lib/i18n/config";

/** Visual order for the GBP → SBP alternative chips only. */
const SBP_CURRENCY_CHIP_ORDER = ["RUB", "TRY", "USD", "EUR"] as const satisfies readonly SbpAllowedCurrency[];

type CheckoutPaymentProps = {
  locale: Locale;
  method: CheckoutPaymentMethod | null;
  currency: DisplayCurrency;
  totalEur: number | null;
  fxRates: Partial<Record<DisplayCurrency, FxRateQuote>>;
  captchaInstance: number;
  paymentError?: string | null;
  captchaError?: string | null;
  currencyBusy?: boolean;
  onMethodChange: (method: CheckoutPaymentMethod) => void;
  onCurrencyChange: (currency: SbpAllowedCurrency) => void;
  onCaptchaTokenChange: (token: string | null) => void;
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
  currency,
  totalEur,
  fxRates,
  captchaInstance,
  paymentError = null,
  captchaError = null,
  currencyBusy = false,
  onMethodChange,
  onCurrencyChange,
  onCaptchaTokenChange,
}: CheckoutPaymentProps) {
  const copy = checkoutCopy[locale];
  const showGbpBlock = method === "sbp" && currency === SBP_UNSUPPORTED_CURRENCY;

  return (
    <section
      id="checkout-payment"
      className={`checkout-card glass-surface${paymentError ? " is-invalid" : ""}`}
      aria-labelledby="checkout-pay-title"
    >
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
      {showGbpBlock ? (
        <div className="checkout-sbp-currency" role="alert">
          <p className="checkout-sbp-currency-title">{copy.sbpGbpUnsupportedTitle}</p>
          <p className="checkout-sbp-currency-body">{copy.sbpGbpUnsupportedBody}</p>
          <div
            className="vehicle-card-currency-pills checkout-sbp-currency-pills"
            role="radiogroup"
            aria-label={copy.currency}
          >
            {SBP_CURRENCY_CHIP_ORDER.map((code) => {
              const amount =
                totalEur == null
                  ? null
                  : displayAmountFromEur(totalEur, code, fxRates);
              const face = formatCurrencyPill(code, amount, locale);
              const unavailable = amount === null;
              const recommended = code === "RUB";
              return (
                <label
                  key={code}
                  data-currency={code}
                  className={`vehicle-card-currency-pill checkout-sbp-currency-pill${currencyBusy || unavailable ? " is-unavailable" : ""}`}
                >
                  <input
                    type="radio"
                    name="checkout-sbp-currency"
                    value={code}
                    disabled={currencyBusy || unavailable}
                    checked={false}
                    onChange={() => onCurrencyChange(code)}
                    aria-label={
                      recommended
                        ? `${face}, ${copy.sbpRecommended}`
                        : face
                    }
                  />
                  <span
                    className={`vehicle-card-currency-pill-face checkout-sbp-currency-face${recommended ? " is-recommended" : ""}`}
                    aria-hidden="true"
                  >
                    <span className="checkout-sbp-currency-amount">{face}</span>
                    {recommended ? (
                      <span className="checkout-sbp-recommended">{copy.sbpRecommended}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      {paymentError ? (
        <p className="checkout-field-error" role="alert">
          {paymentError}
        </p>
      ) : null}
      {method ? (
        <CheckoutCaptcha
          key={captchaInstance}
          locale={locale}
          invalid={Boolean(captchaError)}
          onTokenChange={onCaptchaTokenChange}
        />
      ) : null}
      {captchaError ? (
        <p className="checkout-field-error checkout-captcha-error" role="alert">
          {captchaError}
        </p>
      ) : null}
    </section>
  );
}
