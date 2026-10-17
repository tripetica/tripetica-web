"use client";

import { useState, type ReactNode } from "react";
import styles from "./driver-subscription-controls.module.css";

import {
  formatUetdsSubscriptionFee,
  parseUetdsSubscriptionFee,
  serializeSubscriptionPeriodsForForm,
  subscriptionPeriodLabel,
  subscriptionUiWindow,
  UETDS_SUBSCRIPTION_CURRENCIES,
  UETDS_SUBSCRIPTION_PERIOD_STATUSES,
  type UetdsDriverSubscriptionState,
  type UetdsSubscriptionCurrency,
  type UetdsSubscriptionPeriodStatus,
} from "@/lib/uetds/driver-subscription";
import {
  emptyDriverServices,
  selectedServiceTotal,
  SERVICE_PRICE_PLACEHOLDER,
  type DriverServiceSelection,
} from "@/lib/uetds/service-subscriptions";

export type DriverSubscriptionDraft = {
  enrolled: boolean;
  monthlyFee: string;
  currency: UetdsSubscriptionCurrency;
  services: DriverServiceSelection;
  /** key "YYYY-MM" -> status */
  periodStatuses: Record<string, UetdsSubscriptionPeriodStatus>;
};

function periodToken(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function driverSubscriptionDraftFromState(
  state: UetdsDriverSubscriptionState | null | undefined,
): DriverSubscriptionDraft {
  const window = subscriptionUiWindow();
  const periodStatuses: Record<string, UetdsSubscriptionPeriodStatus> = {};
  for (const key of window) {
    const token = periodToken(key.year, key.month);
    const found = state?.periods.find((p) => p.year === key.year && p.month === key.month);
    periodStatuses[token] = found?.status ?? "unpaid";
  }
  return {
    enrolled: Boolean(state?.enrolled),
    monthlyFee: formatUetdsSubscriptionFee(state?.monthlyFee ?? 0),
    currency: state?.currency ?? "USD",
    services: state?.services ?? emptyDriverServices(),
    periodStatuses,
  };
}

export function driverSubscriptionDraftEquals(a: DriverSubscriptionDraft, b: DriverSubscriptionDraft) {
  if (a.enrolled !== b.enrolled) return false;
  if (JSON.stringify(a.services) !== JSON.stringify(b.services)) return false;
  if (a.monthlyFee.trim() !== b.monthlyFee.trim()) return false;
  if (a.currency !== b.currency) return false;
  const keys = new Set([...Object.keys(a.periodStatuses), ...Object.keys(b.periodStatuses)]);
  for (const key of keys) {
    if ((a.periodStatuses[key] ?? "unpaid") !== (b.periodStatuses[key] ?? "unpaid")) return false;
  }
  return true;
}

export function serializeDriverSubscriptionDraft(draft: DriverSubscriptionDraft) {
  const window = subscriptionUiWindow();
  return serializeSubscriptionPeriodsForForm(
    window,
    window.map((key) => ({
      year: key.year,
      month: key.month,
      status: draft.periodStatuses[periodToken(key.year, key.month)] ?? "unpaid",
      amountSnapshot: null,
      currencySnapshot: null,
    })),
  );
}

type StatusLabels = {
  unpaid: string;
  paid: string;
  free: string;
};

const SERVICE_ROWS = [
  ["standard", "standardEnabled", "standardFee"],
  ["advanced", "advancedEnabled", "advancedFee"],
  ["gpsAts", "gpsAtsEnabled", "gpsAtsFee"],
  ["mobile", "mobileEnabled", "mobileFee"],
] as const;

type DriverSubscriptionEditorProps = {
  membershipControl?: ReactNode;
  serviceLabels: { standard: string; advanced: string; gpsAts: string; mobile: string; total: string };
  locale: "tr" | "en" | "ru";
  value: DriverSubscriptionDraft;
  disabled?: boolean;
  readOnly?: boolean;
  sectionTitle: string;
  enrollLabel: string;
  feeLabel: string;
  currencyLabel: string;
  monthsLabel: string;
  statusLabels: StatusLabels;
  enrollHint: string;
  gpsAtsSelectable?: boolean;
  gpsAtsLockedText?: string;
  onChange: (next: DriverSubscriptionDraft) => void;
};

export function DriverUetdsSubscriptionSection({
  membershipControl,
  serviceLabels,
  locale,
  value,
  disabled = false,
  readOnly = false,
  sectionTitle,
  enrollLabel,
  feeLabel,
  currencyLabel,
  monthsLabel,
  statusLabels,
  enrollHint,
  gpsAtsSelectable = true,
  gpsAtsLockedText = "",
  onChange,
}: DriverSubscriptionEditorProps) {
  const window = subscriptionUiWindow();
  const locked = disabled || readOnly;
  const total = selectedServiceTotal(value.services);
  const periodChosen = Object.values(value.periodStatuses).some((status) => status === "paid" || status === "free");
  const enrolledForSave = value.enrolled || periodChosen;
  function toggleService(
    enabledKey: "standardEnabled" | "advancedEnabled" | "gpsAtsEnabled" | "mobileEnabled",
    feeKey: "standardFee" | "advancedFee" | "gpsAtsFee" | "mobileFee",
    checked: boolean,
  ) {
    const fee = value.services[feeKey];
    onChange({
      ...value,
      services: {
        ...value.services,
        [enabledKey]: checked,
        [feeKey]: checked && fee == null ? SERVICE_PRICE_PLACEHOLDER : fee,
      },
    });
  }

  return (
    <section className="uetds-driver-subscription" aria-label={sectionTitle}>
      {!membershipControl ? <h2 className="uetds-driver-subscription-title">{sectionTitle}</h2> : null}

      <div className="uetds-driver-subscription-services">
        {SERVICE_ROWS.map(([name, enabledKey, feeKey]) => {
          const gpsAtsLocked = name === "gpsAts" && !gpsAtsSelectable && !value.services.gpsAtsEnabled;
          return (
          <div key={name} className="uetds-driver-subscription-fee-row">
            <div className="uetds-driver-subscription-choice" title={gpsAtsLocked ? gpsAtsLockedText : undefined}>
              <label className="uetds-driver-subscription-check">
                <input
                  type="checkbox"
                  checked={value.services[enabledKey]}
                  disabled={locked || gpsAtsLocked}
                  aria-describedby={gpsAtsLocked ? "gps-ats-device-note" : undefined}
                  onChange={(event) => toggleService(enabledKey, feeKey, event.target.checked)}
                />
                <span>{serviceLabels[name]}</span>
              </label>
              {gpsAtsLocked ? (
                <p id="gps-ats-device-note" className="uetds-driver-subscription-lock-note">{gpsAtsLockedText}</p>
              ) : null}
            </div>
            <label className="ops-field">
              <span>{feeLabel}</span>
              {readOnly ? (
                <p className="partner-billing-value">
                  {value.services[enabledKey] ? formatUetdsSubscriptionFee(value.services[feeKey], locale) || "—" : "—"} {value.currency}
                </p>
              ) : (
                <SubscriptionFeeInput
                  locale={locale}
                  value={value.services[feeKey]}
                  disabled={locked || !value.services[enabledKey]}
                  onFee={(fee) => onChange({
                    ...value,
                    services: { ...value.services, [feeKey]: fee },
                  })}
                />
              )}
            </label>
          </div>
          );
        })}
        <p className="partner-billing-value">{serviceLabels.total}: {total == null ? "—" : formatUetdsSubscriptionFee(total, locale)} {value.currency}</p>
        {!readOnly ? (
          <label className="ops-field">
            <span>{currencyLabel}</span>
            <select
              name="uetdsSubscriptionCurrency"
              value={value.currency}
              disabled={locked}
              onChange={(event) => onChange({ ...value, currency: event.target.value as UetdsSubscriptionCurrency })}
            >
              {UETDS_SUBSCRIPTION_CURRENCIES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="uetds-driver-subscription-months">
        <p className="partner-billing-label">{monthsLabel}</p>
        <div className="uetds-driver-subscription-scroller" role="list">
          {window.map((key, index) => {
            const token = periodToken(key.year, key.month);
            const status = value.periodStatuses[token] ?? "unpaid";
            return (
              <div key={token} className={index < 2 ? "uetds-driver-subscription-month is-lead" : "uetds-driver-subscription-month"} role="listitem">
                <p className="uetds-driver-subscription-month-label">
                  {subscriptionPeriodLabel(key, locale)}
                </p>
                {readOnly ? (
                  <p className="uetds-driver-subscription-month-status">
                    {statusLabels[status]}
                  </p>
                ) : (
                  <select
                    aria-label={subscriptionPeriodLabel(key, locale)}
                    value={status}
                    disabled={locked}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        periodStatuses: {
                          ...value.periodStatuses,
                          [token]: event.target.value as UetdsSubscriptionPeriodStatus,
                        },
                      })
                    }
                  >
                    {UETDS_SUBSCRIPTION_PERIOD_STATUSES.map((code) => (
                      <option key={code} value={code}>
                        {statusLabels[code]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!readOnly ? (
        <>
          <input type="hidden" name="uetdsSubscriptionEnrolled" value={enrolledForSave ? "1" : "0"} />
          <input type="hidden" name="serviceStandardEnabled" value={value.services.standardEnabled ? "1" : "0"} />
          <input type="hidden" name="serviceAdvancedEnabled" value={value.services.advancedEnabled ? "1" : "0"} />
          <input type="hidden" name="serviceGpsAtsEnabled" value={value.services.gpsAtsEnabled ? "1" : "0"} />
          <input type="hidden" name="serviceMobileEnabled" value={value.services.mobileEnabled ? "1" : "0"} />
          <input type="hidden" name="serviceStandardFee" value={value.services.standardFee ?? ""} />
          <input type="hidden" name="serviceAdvancedFee" value={value.services.advancedFee ?? ""} />
          <input type="hidden" name="serviceGpsAtsFee" value={value.services.gpsAtsFee ?? ""} />
          <input type="hidden" name="serviceMobileFee" value={value.services.mobileFee ?? ""} />
          <input type="hidden" name="uetdsSubscriptionPeriods" value={serializeDriverSubscriptionDraft(value)} />
          {!value.enrolled ? (
            <>
              <input type="hidden" name="uetdsSubscriptionMonthlyFee" value={value.monthlyFee} />
              <input type="hidden" name="uetdsSubscriptionCurrency" value={value.currency} />
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function SubscriptionFeeInput({
  locale,
  value,
  disabled,
  onFee,
}: {
  locale: "tr" | "en" | "ru";
  value: number | null;
  disabled: boolean;
  onFee: (fee: number | null) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value == null ? "" : formatUetdsSubscriptionFee(value, locale));
  return (
    <input
      inputMode="decimal"
      value={shown}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw.trim() === "") {
          setText("");
          onFee(null);
          return;
        }
        if (!/^\d*([.,]\d{0,2})?$/.test(raw.trim())) return;
        setText(raw);
        const parsed = parseUetdsSubscriptionFee(raw);
        if (parsed != null) onFee(parsed);
      }}
      onBlur={() => setText(null)}
    />
  );
}
