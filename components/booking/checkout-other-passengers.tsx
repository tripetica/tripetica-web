"use client";

import { useState } from "react";
import { CheckoutInfoDialog } from "@/components/booking/checkout-info-dialog";
import {
  CheckoutPassengerForm,
  emptyPassengerForm,
  isPassengerFormComplete,
  type PassengerFormValue,
} from "@/components/booking/checkout-passenger-form";
import { checkoutCopy, extraPassengerTitle } from "@/lib/booking/checkout-copy";
import { type Locale } from "@/lib/i18n/config";

type ExtraMode = "now" | "later";

type CheckoutOtherPassengersProps = {
  locale: Locale;
  sequences: number[];
  mode: ExtraMode | null;
  openSequence: number | null;
  values: Record<number, PassengerFormValue>;
  onModeChange: (mode: ExtraMode) => void;
  onToggle: (sequence: number) => void;
  onChange: (sequence: number, value: PassengerFormValue) => void;
  onPersist: (sequence: number, value: PassengerFormValue) => void;
};

export function CheckoutOtherPassengers({
  locale,
  sequences,
  mode,
  openSequence,
  values,
  onModeChange,
  onToggle,
  onChange,
  onPersist,
}: CheckoutOtherPassengersProps) {
  const copy = checkoutCopy[locale];
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    <section className="checkout-card glass-surface" aria-labelledby="checkout-other-title">
      <h2 id="checkout-other-title" className="checkout-card-title">
        {copy.otherPassengersTitle}
      </h2>
      <p className="checkout-blurb">{copy.otherPassengersBlurb}</p>
      <button
        type="button"
        className="checkout-why-link"
        aria-haspopup="dialog"
        aria-expanded={whyOpen}
        onClick={() => setWhyOpen(true)}
      >
        {copy.whyPassengerInfo}
      </button>
      {whyOpen ? (
        <CheckoutInfoDialog
          title={copy.whyPassengerInfo}
          body={copy.whyPassengerInfoBody}
          closeLabel={copy.closeSelector}
          onClose={() => setWhyOpen(false)}
        />
      ) : null}
      <div className="checkout-choice" role="group" aria-labelledby="checkout-other-title">
        <button
          type="button"
          className={`checkout-choice-btn${mode === "now" ? " is-selected" : ""}`}
          aria-pressed={mode === "now"}
          onClick={() => onModeChange("now")}
        >
          {copy.enterNow}
        </button>
        <button
          type="button"
          className={`checkout-choice-btn${mode === "later" ? " is-selected" : ""}`}
          aria-pressed={mode === "later"}
          onClick={() => onModeChange("later")}
        >
          {copy.provideLater}
        </button>
      </div>
      {mode === "now"
        ? sequences.map((sequence) => (
            <ExtraPassengerRow
              key={sequence}
              locale={locale}
              copy={copy}
              sequence={sequence}
              open={openSequence === sequence}
              initialValue={values[sequence] ?? emptyPassengerForm(null, locale)}
              onToggle={() => onToggle(sequence)}
              onChange={(value) => onChange(sequence, value)}
              onPersist={(value) => onPersist(sequence, value)}
            />
          ))
        : null}
    </section>
  );
}

function extraFieldValue(sequence: number, field: "first" | "last" | "identity") {
  const input = document.getElementById(`extra-${sequence}-${field}`);
  return input instanceof HTMLInputElement ? input.value : null;
}

function ExtraPassengerRow({
  locale,
  copy,
  sequence,
  open,
  initialValue,
  onToggle,
  onChange,
  onPersist,
}: {
  locale: Locale;
  copy: (typeof checkoutCopy)[Locale];
  sequence: number;
  open: boolean;
  initialValue: PassengerFormValue;
  onToggle: () => void;
  onChange: (value: PassengerFormValue) => void;
  onPersist: (value: PassengerFormValue) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const done = isPassengerFormComplete(value);
  const title = extraPassengerTitle(locale, sequence);

  function mergeDom(next: PassengerFormValue): PassengerFormValue {
    return {
      ...next,
      firstName: extraFieldValue(sequence, "first") ?? next.firstName,
      lastName: extraFieldValue(sequence, "last") ?? next.lastName,
      identityNumber: extraFieldValue(sequence, "identity") ?? next.identityNumber,
    };
  }

  function update(next: PassengerFormValue) {
    const merged = mergeDom(next);
    setValue(merged);
    onChange(merged);
  }

  return (
    <div className="checkout-accordion">
      <button
        type="button"
        className="checkout-accordion-header"
        aria-expanded={open}
        aria-controls={`checkout-passenger-${sequence}`}
        id={`checkout-passenger-btn-${sequence}`}
        onClick={() => {
          if (open) {
            const merged = mergeDom(value);
            setValue(merged);
            onChange(merged);
            onPersist(merged);
          }
          onToggle();
        }}
      >
        <span className="checkout-accordion-title">
          {title}
          <svg
            className="checkout-accordion-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
        {done ? <span className="checkout-complete">{copy.completed}</span> : null}
      </button>
      <div
        id={`checkout-passenger-${sequence}`}
        role="region"
        hidden={!open}
        inert={!open}
        aria-labelledby={`checkout-passenger-btn-${sequence}`}
      >
        <CheckoutPassengerForm
          locale={locale}
          title={title}
          required={false}
          showTitle={false}
          active={open}
          idPrefix={`extra-${sequence}`}
          value={value}
          onChange={update}
          onPersist={onPersist}
        />
      </div>
    </div>
  );
}
