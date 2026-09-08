"use client";

import { useEffect, useId, useRef } from "react";
import { CountryPicker } from "@/components/booking/country-picker";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type BookingPassengerView } from "@/lib/booking/draft-view";
import { defaultCountryIso2ForLocale } from "@/lib/geo/locale-defaults";
import { type Locale } from "@/lib/i18n/config";

export type PassengerFormValue = {
  countryCode: string | null;
  identityNumber: string;
  firstName: string;
  lastName: string;
  gender: "female" | "male";
};

export type PassengerFieldErrors = {
  countryCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type CheckoutPassengerFormProps = {
  locale: Locale;
  title: string;
  required: boolean;
  showTitle?: boolean;
  active?: boolean;
  idPrefix?: string;
  value: PassengerFormValue;
  fieldErrors?: PassengerFieldErrors;
  onChange: (value: PassengerFormValue) => void;
  onPersist: (value: PassengerFormValue) => void;
  onRequiredBlur?: (field: keyof PassengerFieldErrors) => void;
};

export function isPassengerFormComplete(value: PassengerFormValue | undefined) {
  return Boolean(
    value?.countryCode &&
      value.firstName?.trim() &&
      value.lastName?.trim() &&
      (value.gender === "female" || value.gender === "male"),
  );
}

export function firstIncompleteExtraSequence(
  sequences: readonly number[],
  values: Record<number, PassengerFormValue | undefined>,
) {
  for (const sequence of sequences) {
    if (!isPassengerFormComplete(values[sequence])) {
      return sequence;
    }
  }
  return null;
}

export function emptyPassengerForm(
  passenger?: BookingPassengerView | null,
  locale?: Locale,
): PassengerFormValue {
  return {
    countryCode:
      passenger?.countryCode ??
      (locale ? defaultCountryIso2ForLocale(locale) : null),
    identityNumber: passenger?.identityNumber ?? "",
    firstName: passenger?.firstName ?? "",
    lastName: passenger?.lastName ?? "",
    gender: passenger?.gender === "male" ? "male" : "female",
  };
}

export function CheckoutPassengerForm({
  locale,
  title,
  required,
  showTitle = true,
  active = true,
  idPrefix,
  value,
  fieldErrors,
  onChange,
  onPersist,
  onRequiredBlur,
}: CheckoutPassengerFormProps) {
  const copy = checkoutCopy[locale];
  const generatedId = useId();
  const prefix = idPrefix ?? generatedId;
  const nationalityId = `${prefix}-nationality`;
  const identityId = `${prefix}-identity`;
  const firstId = `${prefix}-first`;
  const lastId = `${prefix}-last`;
  const genderId = `${prefix}-gender`;
  const autoSection = idPrefix ? `section-${idPrefix} ` : "";
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function patch(partial: Partial<PassengerFormValue>, persist = false) {
    const next = { ...valueRef.current, ...partial };
    valueRef.current = next;
    onChange(next);
    if (persist) {
      onPersist(next);
    }
  }

  function persistField<K extends "identityNumber" | "firstName" | "lastName">(
    field: K,
    fieldValue: string,
  ) {
    const next = { ...valueRef.current, [field]: fieldValue };
    valueRef.current = next;
    onChange(next);
    onPersist(next);
  }

  return (
    <section className="checkout-passenger-form" aria-labelledby={nationalityId + "-title"}>
      {showTitle ? (
        <h3 id={nationalityId + "-title"} className="checkout-card-title">
          {title}
        </h3>
      ) : (
        <span id={nationalityId + "-title"} className="sr-only">
          {title}
        </span>
      )}
      <div className="checkout-grid">
        <div className="checkout-field checkout-field-nationality" id={`${prefix}-nationality-field`}>
          <span id={nationalityId} className="checkout-label">
            {copy.nationalityLabel}
            {required ? " *" : ""}
          </span>
          <CountryPicker
            locale={locale}
            variant="nationality"
            value={value.countryCode}
            labelledBy={nationalityId}
            ariaLabel={copy.nationalityLabel}
            active={active}
            invalid={Boolean(fieldErrors?.countryCode)}
            onChange={(iso2) => patch({ countryCode: iso2 }, true)}
            onEmptyBlur={required ? () => onRequiredBlur?.("countryCode") : undefined}
          />
          {fieldErrors?.countryCode ? (
            <span className="checkout-field-error">{fieldErrors.countryCode}</span>
          ) : null}
        </div>
        <label className="checkout-field" htmlFor={identityId}>
          <span className="checkout-label">{copy.identityLabel}</span>
          <input
            id={identityId}
            className="checkout-input"
            value={value.identityNumber}
            placeholder={copy.identityPlaceholder}
            autoComplete={`${autoSection}off`.trim()}
            onChange={(event) => patch({ identityNumber: event.target.value })}
            onBlur={(event) => persistField("identityNumber", event.currentTarget.value)}
          />
        </label>
        <label className="checkout-field" htmlFor={firstId}>
          <span className="checkout-label">
            {copy.firstNameLabel}
            {required ? " *" : ""}
          </span>
          <input
            id={firstId}
            className={`checkout-input${fieldErrors?.firstName ? " is-invalid" : ""}`}
            value={value.firstName}
            placeholder={copy.firstNamePlaceholder}
            autoComplete={`${autoSection}given-name`}
            aria-invalid={fieldErrors?.firstName ? true : undefined}
            onChange={(event) => patch({ firstName: event.target.value })}
            onBlur={(event) => {
              persistField("firstName", event.currentTarget.value);
              if (required) {
                onRequiredBlur?.("firstName");
              }
            }}
          />
          {fieldErrors?.firstName ? (
            <span className="checkout-field-error">{fieldErrors.firstName}</span>
          ) : null}
        </label>
        <label className="checkout-field" htmlFor={lastId}>
          <span className="checkout-label">
            {copy.lastNameLabel}
            {required ? " *" : ""}
          </span>
          <input
            id={lastId}
            className={`checkout-input${fieldErrors?.lastName ? " is-invalid" : ""}`}
            value={value.lastName}
            placeholder={copy.lastNamePlaceholder}
            autoComplete={`${autoSection}family-name`}
            aria-invalid={fieldErrors?.lastName ? true : undefined}
            onChange={(event) => patch({ lastName: event.target.value })}
            onBlur={(event) => {
              persistField("lastName", event.currentTarget.value);
              if (required) {
                onRequiredBlur?.("lastName");
              }
            }}
          />
          {fieldErrors?.lastName ? (
            <span className="checkout-field-error">{fieldErrors.lastName}</span>
          ) : null}
        </label>
        <fieldset className="checkout-field checkout-field-gender">
          <legend id={genderId} className="checkout-label">
            {copy.genderLabel}
            {required ? " *" : ""}
          </legend>
          <div className="checkout-gender" role="radiogroup" aria-labelledby={genderId}>
            <label className={`checkout-gender-option${value.gender === "female" ? " is-selected" : ""}`}>
              <input
                type="radio"
                name={genderId}
                value="female"
                checked={value.gender === "female"}
                onChange={() => patch({ gender: "female" }, true)}
              />
              {copy.female}
            </label>
            <label className={`checkout-gender-option${value.gender === "male" ? " is-selected" : ""}`}>
              <input
                type="radio"
                name={genderId}
                value="male"
                checked={value.gender === "male"}
                onChange={() => patch({ gender: "male" }, true)}
              />
              {copy.male}
            </label>
          </div>
        </fieldset>
      </div>
    </section>
  );
}
