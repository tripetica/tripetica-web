"use client";

import { useId, useRef, useState } from "react";
import { CountryPicker } from "@/components/booking/country-picker";
import { checkoutCopy, phoneCopyFor } from "@/lib/booking/checkout-copy";
import { formatNationalInput } from "@/lib/booking/phone";
import { type Locale } from "@/lib/i18n/config";

type PhoneFieldProps = {
  locale: Locale;
  countryCode: string | null;
  nationalNumber: string;
  error?: string | null;
  /** Prefer anchored dropdown under the phone control (e.g. inside auth modal). */
  pickerLayout?: "auto" | "anchored";
  onCountryChange: (iso2: string) => void;
  onNationalChange: (value: string) => void;
  onNationalBlur?: () => void;
};

export function PhoneField({
  locale,
  countryCode,
  nationalNumber,
  error = null,
  pickerLayout = "auto",
  onCountryChange,
  onNationalChange,
  onNationalBlur,
}: PhoneFieldProps) {
  const copy = phoneCopyFor(locale);
  const labels = checkoutCopy[locale];
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const locked = !countryCode;
  const [hint, setHint] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  function showHint() {
    if (locked) {
      setHint(true);
    }
  }

  return (
    <div className="checkout-phone">
      <span id={labelId} className="checkout-label">
        {labels.phoneLabel} *
      </span>
      <div
        ref={controlRef}
        className={`checkout-phone-control${locked ? " is-locked" : ""}${error ? " is-invalid" : ""}`}
      >
        <CountryPicker
          locale={locale}
          variant="phone"
          value={countryCode}
          labelledBy={labelId}
          ariaLabel={copy.selectCode}
          anchorRef={controlRef}
          layout={pickerLayout}
          onChange={(iso2) => {
            setHint(false);
            onCountryChange(iso2);
          }}
        />
        <div className="checkout-phone-divider" aria-hidden="true" />
        {locked ? (
          <button
            type="button"
            className="checkout-phone-placeholder"
            aria-describedby={hint ? hintId : undefined}
            onMouseEnter={showHint}
            onFocus={showHint}
            onClick={showHint}
            onPointerDown={showHint}
          >
            {copy.phonePlaceholder}
          </button>
        ) : (
          <input
            className="checkout-phone-input ltr-isolate"
            dir="ltr"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={nationalNumber}
            placeholder={copy.phonePlaceholder}
            aria-label={copy.phonePlaceholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) =>
              onNationalChange(formatNationalInput(countryCode, event.target.value))
            }
            onBlur={onNationalBlur}
          />
        )}
      </div>
      {error ? (
        <p id={errorId} className="checkout-field-error" role="alert">
          {error}
        </p>
      ) : locked && hint ? (
        <p id={hintId} className="checkout-phone-hint" role="status">
          {copy.selectCodeFirst}
        </p>
      ) : null}
    </div>
  );
}
