"use client";

import { type PartnerBusinessType } from "@/lib/partner/constants";

type PartnerBusinessTypeFieldProps = {
  name?: string;
  legend: string;
  value: PartnerBusinessType | "";
  individualLabel: string;
  companyLabel: string;
  onChange: (value: PartnerBusinessType) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
};

const OPTIONS = [
  ["individual", "individualLabel"],
  ["company", "companyLabel"],
] as const;

export function PartnerBusinessTypeField({
  name = "businessType",
  legend,
  value,
  individualLabel,
  companyLabel,
  onChange,
  required = false,
  disabled = false,
  error,
}: PartnerBusinessTypeFieldProps) {
  const labels = { individualLabel, companyLabel };

  return (
    <fieldset
      className={`ops-field partner-business-type${error ? " is-invalid" : ""}`}
      data-register-field="businessType"
    >
      <legend>{legend}</legend>
      <div className="partner-business-type-options">
        {OPTIONS.map(([option, labelKey]) => {
          const selected = value === option;
          return (
            <label
              key={option}
              className={
                selected
                  ? "partner-business-type-option is-selected"
                  : "partner-business-type-option"
              }
            >
              <input
                className="ops-sr-only"
                type="radio"
                name={name}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                required={required}
                disabled={disabled}
              />
              <span>{labels[labelKey]}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="ops-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
