"use client";

import type { ReactNode } from "react";
import styles from "./driver-subscription-controls.module.css";

import {
  formatUetdsSubscriptionFee,
  serializeSubscriptionPeriodsForForm,
  subscriptionPeriodLabel,
  subscriptionUiWindow,
  UETDS_SUBSCRIPTION_CURRENCIES,
  UETDS_SUBSCRIPTION_PERIOD_STATUSES,
  type UetdsDriverSubscriptionState,
  type UetdsSubscriptionCurrency,
  type UetdsSubscriptionPeriodStatus,
} from "@/lib/uetds/driver-subscription";

export type DriverSubscriptionDraft = {
  enrolled: boolean;
  monthlyFee: string;
  currency: UetdsSubscriptionCurrency;
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
    monthlyFee: formatUetdsSubscriptionFee(state?.monthlyFee ?? 9),
    currency: state?.currency ?? "USD",
    periodStatuses,
  };
}

export function driverSubscriptionDraftEquals(a: DriverSubscriptionDraft, b: DriverSubscriptionDraft) {
  if (a.enrolled !== b.enrolled) return false;
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

type DriverSubscriptionEditorProps = {
  membershipControl?: ReactNode;
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
  onChange: (next: DriverSubscriptionDraft) => void;
};

export function DriverUetdsSubscriptionSection({
  membershipControl,
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
  onChange,
}: DriverSubscriptionEditorProps) {
  const window = subscriptionUiWindow();
  const locked = disabled || readOnly;

  return (
    <section className="uetds-driver-subscription" aria-label={sectionTitle}>
      {!membershipControl ? <h2 className="uetds-driver-subscription-title">{sectionTitle}</h2> : null}

      {readOnly ? (
        value.enrolled ? (
          <p className="partner-billing-value">
            {feeLabel}: {value.monthlyFee || "—"} {value.currency}
          </p>
        ) : (
          <p className="partner-billing-value">{enrollHint}</p>
        )
      ) : (
        <>
          <div className={membershipControl ? styles.controls : undefined}>
          <label className={membershipControl ? styles.enroll : "ops-field uetds-driver-subscription-enroll"}>
            {membershipControl ? <span>{sectionTitle}</span> : null}
            <span className="uetds-driver-subscription-check">
              <input
                type="checkbox"
                checked={value.enrolled}
                disabled={locked}
                onChange={(event) =>
                  onChange({ ...value, enrolled: event.target.checked })
                }
              />
              {!membershipControl ? enrollLabel : null}
            </span>
          </label>
          {membershipControl}
          </div>
          {!membershipControl && !value.enrolled ? <p className="ops-muted">{enrollHint}</p> : null}

          {value.enrolled ? (
            <div className="uetds-driver-subscription-fee-row">
              <label className="ops-field">
                <span>{feeLabel}</span>
                <input
                  name="uetdsSubscriptionMonthlyFee"
                  inputMode="decimal"
                  value={value.monthlyFee}
                  disabled={locked}
                  onChange={(event) =>
                    onChange({ ...value, monthlyFee: event.target.value })
                  }
                />
              </label>
              <label className="ops-field">
                <span>{currencyLabel}</span>
                <select
                  name="uetdsSubscriptionCurrency"
                  value={value.currency}
                  disabled={locked}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      currency: event.target.value as UetdsSubscriptionCurrency,
                    })
                  }
                >
                  {UETDS_SUBSCRIPTION_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </>
      )}

      {value.enrolled ? (
        <div className="uetds-driver-subscription-months">
          <p className="partner-billing-label">{monthsLabel}</p>
          <div className="uetds-driver-subscription-scroller" role="list">
            {window.map((key) => {
              const token = periodToken(key.year, key.month);
              const status = value.periodStatuses[token] ?? "unpaid";
              return (
                <div key={token} className="uetds-driver-subscription-month" role="listitem">
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
                      disabled={locked || !value.enrolled}
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
      ) : null}

      {!readOnly ? (
        <>
          <input type="hidden" name="uetdsSubscriptionEnrolled" value={value.enrolled ? "1" : "0"} />
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
