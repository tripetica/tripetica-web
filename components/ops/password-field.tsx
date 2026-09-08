"use client";

import { useState } from "react";

type OpsPasswordFieldProps = {
  label: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
  minLength?: number;
  showPasswordLabel: string;
  hidePasswordLabel: string;
};

export function OpsPasswordField({
  label,
  name,
  autoComplete,
  required,
  autoFocus,
  minLength,
  showPasswordLabel,
  hidePasswordLabel,
}: OpsPasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="ops-field">
      <span>{label}</span>
      <span className="ops-password-wrap">
        <input
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          minLength={minLength}
        />
        <button
          type="button"
          className="ops-password-toggle"
          aria-label={visible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            {visible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
                <path d="M9.9 5.1A11 11 0 0 1 12 5c5 0 9.3 3.1 11 7-0.5 1.1-1.2 2.1-2.1 3" />
                <path d="M6.1 6.1C4.5 7.3 3.1 8.9 2 12c1.7 3.9 6 7 10 7 1.4 0 2.8-.3 4.1-.9" />
              </>
            ) : (
              <>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </span>
    </label>
  );
}
