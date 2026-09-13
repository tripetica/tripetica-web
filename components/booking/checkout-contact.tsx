"use client";

import { PhoneField } from "@/components/booking/phone-field";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type Locale } from "@/lib/i18n/config";

type CheckoutContactProps = {
  locale: Locale;
  email: string;
  emailError: string | null;
  phoneCountry: string | null;
  phoneNational: string;
  phoneError: string | null;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPhoneCountryChange: (iso2: string) => void;
  onPhoneNationalChange: (value: string) => void;
  onPhoneBlur: () => void;
};

export function CheckoutContact({
  locale,
  email,
  emailError,
  phoneCountry,
  phoneNational,
  phoneError,
  onEmailChange,
  onEmailBlur,
  onPhoneCountryChange,
  onPhoneNationalChange,
  onPhoneBlur,
}: CheckoutContactProps) {
  const copy = checkoutCopy[locale];
  return (
    <section className="checkout-card glass-surface" aria-labelledby="checkout-contact-title">
      <h2 id="checkout-contact-title" className="checkout-card-title">
        {copy.contactTitle}
      </h2>
      <div className="checkout-contact-grid">
        <label className="checkout-field">
          <span className="checkout-label">{copy.emailLabel} *</span>
          <input
            id="checkout-email"
            className={`checkout-input ltr-isolate${emailError ? " is-invalid" : ""}`}
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            value={email}
            placeholder={copy.emailPlaceholder}
            aria-invalid={emailError ? true : undefined}
            onChange={(event) => onEmailChange(event.target.value)}
            onBlur={onEmailBlur}
          />
          {emailError ? <span className="checkout-field-error">{emailError}</span> : null}
        </label>
        <div id="checkout-phone">
          <PhoneField
            locale={locale}
            countryCode={phoneCountry}
            nationalNumber={phoneNational}
            error={phoneError}
            onCountryChange={onPhoneCountryChange}
            onNationalChange={onPhoneNationalChange}
            onNationalBlur={onPhoneBlur}
          />
        </div>
      </div>
    </section>
  );
}
