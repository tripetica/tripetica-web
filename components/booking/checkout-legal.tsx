"use client";

import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { legalNavLabels, legalPath, legalSlugs } from "@/lib/legal/catalog";

type CheckoutLegalProps = {
  locale: Locale;
  accepted: boolean;
  error?: string | null;
  onAcceptedChange: (accepted: boolean) => void;
};

export function CheckoutLegal({ locale, accepted, error = null, onAcceptedChange }: CheckoutLegalProps) {
  const copy = checkoutCopy[locale];
  const labels = legalNavLabels[locale];
  const last = legalSlugs.length - 1;
  return (
    <section
      id="checkout-legal"
      className={`checkout-card glass-surface${error ? " is-invalid" : ""}`}
      aria-labelledby="checkout-legal-title"
    >
      <h2 id="checkout-legal-title" className="checkout-card-title">
        {copy.legalTitle}
      </h2>
      <label className="checkout-legal">
        <input
          type="checkbox"
          className="checkout-legal-check"
          checked={accepted}
          onChange={(event) => onAcceptedChange(event.target.checked)}
        />
        <span className="checkout-legal-text">
          {copy.legalAcceptStart}
          {legalSlugs.map((slug, index) => (
            <span key={slug}>
              {index > 0 ? (index === last ? copy.legalAcceptLastJoin : copy.legalAcceptJoin) : null}
              <a
                href={localizedPath(locale, legalPath(slug))}
                className="checkout-legal-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {labels[slug]}
              </a>
            </span>
          ))}
          {copy.legalAcceptEnd}
        </span>
      </label>
      {error ? (
        <p className="checkout-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
