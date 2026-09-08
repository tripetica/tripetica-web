"use client";

import { useState } from "react";
import {
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { formatOpsAmount } from "@/lib/ops/money";
import {
  recalcManualTotalsFromCurrency,
  type ManualPriceTotals,
} from "@/lib/ops/price-override";

type PriceEditModalProps = {
  locale: Locale;
  copy: OpsCopy;
  open: boolean;
  fxSnapshot: unknown;
  totals: ManualPriceTotals;
  onClose: () => void;
  onApply: (totals: ManualPriceTotals, overridden: boolean) => void;
};

export function PriceEditModal({
  locale,
  copy,
  open,
  fxSnapshot,
  totals,
  onClose,
  onApply,
}: PriceEditModalProps) {
  const [draftTotals, setDraftTotals] = useState<ManualPriceTotals>(totals);
  const [lastEditedCurrency, setLastEditedCurrency] = useState<DisplayCurrency | null>(null);
  const [source, setSource] = useState({ open, totals });

  if (source.open !== open || source.totals !== totals) {
    setSource({ open, totals });
    if (open) {
      setDraftTotals(totals);
      setLastEditedCurrency(null);
    }
  }

  if (!open) {
    return null;
  }

  function updateAmount(code: DisplayCurrency, value: string) {
    setDraftTotals((current) => ({ ...current, [code]: value }));
    setLastEditedCurrency(code);
  }

  function handleRecalc() {
    if (!lastEditedCurrency) {
      return;
    }
    const sourceAmount = draftTotals[lastEditedCurrency];
    if (!sourceAmount) {
      return;
    }
    const next = recalcManualTotalsFromCurrency(
      lastEditedCurrency,
      sourceAmount,
      fxSnapshot,
      draftTotals,
    );
    if (next) {
      setDraftTotals(next);
    }
  }

  return (
    <div className="ops-price-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ops-price-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ops-price-edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ops-price-modal-header">
          <h3 id="ops-price-edit-title">{copy.editPriceTitle}</h3>
          <button type="button" className="ops-btn-ghost" onClick={onClose}>
            {copy.close}
          </button>
        </div>
        <div className="ops-price-rows">
          {DISPLAY_CURRENCIES.map((code) => (
            <label key={code} className="ops-price-row">
              <span className="ops-price-code">{code}</span>
              <input
                type="text"
                inputMode="decimal"
                className="ops-price-input"
                value={draftTotals[code] ?? ""}
                onChange={(event) => updateAmount(code, event.target.value)}
              />
              <span className="ops-price-preview">
                {formatOpsAmount(draftTotals[code], locale) || "—"}
              </span>
            </label>
          ))}
        </div>
        {lastEditedCurrency ? (
          <p className="ops-price-recalc-wrap">
            <button type="button" className="ops-btn-secondary" onClick={handleRecalc}>
              {copy.recalcOtherCurrencies}
            </button>
          </p>
        ) : null}
        <div className="ops-price-actions">
          <button type="button" className="ops-btn-ghost" onClick={onClose}>
            {copy.cancelEdit}
          </button>
          <button
            type="button"
            className="ops-btn-primary"
            onClick={() => {
              const cleaned: ManualPriceTotals = {};
              for (const code of DISPLAY_CURRENCIES) {
                const value = draftTotals[code];
                if (value != null && String(value).trim() !== "") {
                  cleaned[code] = String(value).trim();
                }
              }
              onApply(cleaned, true);
            }}
          >
            {copy.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
}
