"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  patchOpsDriverSubscriptionCurrencyAction,
  patchOpsDriverSubscriptionFeeAction,
  patchOpsDriverSubscriptionNextStatusAction,
  patchOpsDriverSubscriptionStatusAction,
} from "@/lib/ops/driver-actions";
import { type Locale } from "@/lib/i18n/config";
import {
  addSubscriptionMonths,
  formatUetdsSubscriptionFee,
  istanbulSubscriptionPeriodKey,
  parseUetdsSubscriptionFee,
  subscriptionPeriodLabel,
  UETDS_SUBSCRIPTION_CURRENCIES,
  UETDS_SUBSCRIPTION_PERIOD_STATUSES,
  type UetdsDriverSubscriptionListSummary,
  type UetdsSubscriptionCurrency,
  type UetdsSubscriptionPeriodStatus,
} from "@/lib/uetds/driver-subscription";

export type DriverSubscriptionListLabels = {
  fee: string;
  currency: string;
  unpaid: string;
  paid: string;
  free: string;
  notManaged: string;
  invalidFee: string;
  saveFailed: string;
};

type Props = {
  locale: Locale;
  driverId: string;
  canManage: boolean;
  summary: UetdsDriverSubscriptionListSummary;
  labels: DriverSubscriptionListLabels;
  onSummaryChange: (driverId: string, summary: UetdsDriverSubscriptionListSummary) => void;
};

function panelLocale(locale: Locale): "tr" | "en" | "ru" {
  return locale === "en" || locale === "ru" ? locale : "tr";
}

export function OpsDriverSubscriptionInlineCells({
  locale,
  driverId,
  canManage,
  summary,
  labels,
  onSummaryChange,
}: Props) {
  const period = istanbulSubscriptionPeriodKey();
  const periodLabel = subscriptionPeriodLabel(period, panelLocale(locale));
  const [feeDraft, setFeeDraft] = useState(
    formatUetdsSubscriptionFee(summary.monthlyFee) || "",
  );
  const [currencyDraft, setCurrencyDraft] = useState<UetdsSubscriptionCurrency | "">(
    summary.currency ?? "",
  );
  const [statusDraft, setStatusDraft] = useState<UetdsSubscriptionPeriodStatus | "">(
    summary.currentPeriodStatus ?? "",
  );
  const [nextStatusDraft, setNextStatusDraft] = useState<UetdsSubscriptionPeriodStatus | "">(
    summary.nextPeriodStatus ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingField, setPendingField] = useState<"fee" | "currency" | "status" | "next" | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const requestSeq = useRef(0);
  const enrolled = summary.enrolled;
  const editable = canManage && enrolled;

  useEffect(() => {
    setFeeDraft(formatUetdsSubscriptionFee(summary.monthlyFee) || "");
    setCurrencyDraft(summary.currency ?? "");
    setStatusDraft(summary.currentPeriodStatus ?? "");
    setNextStatusDraft(summary.nextPeriodStatus ?? "");
    setError(null);
  }, [
    summary.monthlyFee,
    summary.currency,
    summary.currentPeriodStatus,
    summary.nextPeriodStatus,
    summary.enrolled,
    driverId,
  ]);

  function applyServerSummary(next: UetdsDriverSubscriptionListSummary) {
    onSummaryChange(driverId, next);
    setFeeDraft(formatUetdsSubscriptionFee(next.monthlyFee) || "");
    setCurrencyDraft(next.currency ?? "");
    setStatusDraft(next.currentPeriodStatus ?? "");
    setNextStatusDraft(next.nextPeriodStatus ?? "");
    setError(null);
  }

  function revertFee() {
    setFeeDraft(formatUetdsSubscriptionFee(summary.monthlyFee) || "");
  }

  function saveFee() {
    if (!editable || pendingField) return;
    const parsed = parseUetdsSubscriptionFee(feeDraft);
    const current = formatUetdsSubscriptionFee(summary.monthlyFee);
    if (parsed == null) {
      setError(labels.invalidFee);
      revertFee();
      return;
    }
    if (formatUetdsSubscriptionFee(parsed) === current) {
      setFeeDraft(current);
      setError(null);
      return;
    }
    const seq = ++requestSeq.current;
    setPendingField("fee");
    startTransition(async () => {
      const result = await patchOpsDriverSubscriptionFeeAction({
        locale,
        driverId,
        monthlyFee: feeDraft,
      });
      if (seq !== requestSeq.current) return;
      setPendingField(null);
      if (!result.ok || result.driverId !== driverId) {
        setError(result.error === "invalid-subscription-fee" ? labels.invalidFee : labels.saveFailed);
        revertFee();
        return;
      }
      applyServerSummary(result.summary);
    });
  }

  function saveCurrency(next: string) {
    if (!editable || pendingField) return;
    if (!next || next === summary.currency) {
      setCurrencyDraft(summary.currency ?? "");
      return;
    }
    const seq = ++requestSeq.current;
    setCurrencyDraft(next as UetdsSubscriptionCurrency);
    setPendingField("currency");
    startTransition(async () => {
      const result = await patchOpsDriverSubscriptionCurrencyAction({
        locale,
        driverId,
        currency: next,
      });
      if (seq !== requestSeq.current) return;
      setPendingField(null);
      if (!result.ok || result.driverId !== driverId) {
        setError(labels.saveFailed);
        setCurrencyDraft(summary.currency ?? "");
        return;
      }
      applyServerSummary(result.summary);
    });
  }

  function saveStatus(next: string) {
    if (!editable || pendingField) return;
    if (!next || next === summary.currentPeriodStatus) {
      setStatusDraft(summary.currentPeriodStatus ?? "");
      return;
    }
    const seq = ++requestSeq.current;
    setStatusDraft(next as UetdsSubscriptionPeriodStatus);
    setPendingField("status");
    startTransition(async () => {
      const result = await patchOpsDriverSubscriptionStatusAction({
        locale,
        driverId,
        status: next,
        year: period.year,
        month: period.month,
      });
      if (seq !== requestSeq.current) return;
      setPendingField(null);
      if (!result.ok || result.driverId !== driverId) {
        setError(labels.saveFailed);
        setStatusDraft(summary.currentPeriodStatus ?? "");
        return;
      }
      applyServerSummary(result.summary);
    });
  }

  const nextPeriod = addSubscriptionMonths(period, 1);
  const nextPeriodLabel = subscriptionPeriodLabel(nextPeriod, panelLocale(locale));

  function saveNextStatus(nextStatus: string) {
    if (!editable || pendingField) return;
    if (!nextStatus || nextStatus === summary.nextPeriodStatus) {
      setNextStatusDraft(summary.nextPeriodStatus ?? "");
      return;
    }
    const seq = ++requestSeq.current;
    setNextStatusDraft(nextStatus as UetdsSubscriptionPeriodStatus);
    setPendingField("next");
    startTransition(async () => {
      const result = await patchOpsDriverSubscriptionNextStatusAction({
        locale,
        driverId,
        status: nextStatus,
        year: nextPeriod.year,
        month: nextPeriod.month,
      });
      if (seq !== requestSeq.current) return;
      setPendingField(null);
      if (!result.ok || result.driverId !== driverId) {
        setError(labels.saveFailed);
        setNextStatusDraft(summary.nextPeriodStatus ?? "");
        return;
      }
      applyServerSummary(result.summary);
    });
  }

  const busy = isPending || pendingField != null;
  const statusLabels: Record<UetdsSubscriptionPeriodStatus, string> = {
    unpaid: labels.unpaid,
    paid: labels.paid,
    free: labels.free,
  };

  if (!enrolled) {
    return (
      <>
        <td className="ops-driver-sub-fee" title={labels.notManaged}>
          —
        </td>
        <td className="ops-driver-sub-currency" title={labels.notManaged}>
          —
        </td>
        <td className="ops-driver-sub-status" title={labels.notManaged}>
          <span className="ops-driver-sub-period-label">{periodLabel}:</span> —
        </td>
        <td className="ops-driver-sub-status" title={labels.notManaged}>
          <span className="ops-driver-sub-period-label">{nextPeriodLabel}:</span> —
        </td>
      </>
    );
  }

  return (
    <>
      <td className="ops-driver-sub-fee">
        {editable ? (
          <input
            className="ops-driver-sub-input"
            inputMode="decimal"
            aria-label={labels.fee}
            value={feeDraft}
            disabled={busy}
            onChange={(event) => setFeeDraft(event.target.value)}
            onBlur={() => saveFee()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
              if (event.key === "Escape") {
                revertFee();
                setError(null);
              }
            }}
          />
        ) : (
          formatUetdsSubscriptionFee(summary.monthlyFee) || "—"
        )}
        {error && pendingField === null ? (
          <span className="ops-driver-sub-error" role="alert">
            {error}
          </span>
        ) : null}
      </td>
      <td className="ops-driver-sub-currency">
        {editable ? (
          <select
            className="ops-driver-sub-select"
            aria-label={labels.currency}
            value={currencyDraft || summary.currency || "USD"}
            disabled={busy}
            onChange={(event) => saveCurrency(event.target.value)}
          >
            {UETDS_SUBSCRIPTION_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        ) : (
          summary.currency || "—"
        )}
      </td>
      <td className="ops-driver-sub-status">
        <span className="ops-driver-sub-period-label">{periodLabel}:</span>{" "}
        {editable ? (
          <select
            className="ops-driver-sub-select"
            aria-label={`${periodLabel} ${labels.unpaid}`}
            value={statusDraft || summary.currentPeriodStatus || "unpaid"}
            disabled={busy}
            onChange={(event) => saveStatus(event.target.value)}
          >
            {UETDS_SUBSCRIPTION_PERIOD_STATUSES.map((code) => (
              <option key={code} value={code}>
                {statusLabels[code]}
              </option>
            ))}
          </select>
        ) : (
          statusLabels[(summary.currentPeriodStatus ?? "unpaid") as UetdsSubscriptionPeriodStatus]
        )}
      </td>
      <td className="ops-driver-sub-status">
        <span className="ops-driver-sub-period-label">{nextPeriodLabel}:</span>{" "}
        {editable ? (
          <select
            className="ops-driver-sub-select"
            aria-label={nextPeriodLabel}
            value={nextStatusDraft || summary.nextPeriodStatus || "unpaid"}
            disabled={busy}
            onChange={(event) => saveNextStatus(event.target.value)}
          >
            {UETDS_SUBSCRIPTION_PERIOD_STATUSES.map((code) => (
              <option key={code} value={code}>
                {statusLabels[code]}
              </option>
            ))}
          </select>
        ) : (
          statusLabels[(summary.nextPeriodStatus ?? "unpaid") as UetdsSubscriptionPeriodStatus]
        )}
      </td>
    </>
  );
}

export function PartnerDriverSubscriptionReadOnlyCells({
  locale,
  summary,
  labels,
}: {
  locale: Locale;
  summary: UetdsDriverSubscriptionListSummary | null | undefined;
  labels: DriverSubscriptionListLabels;
}) {
  const period = istanbulSubscriptionPeriodKey();
  const nextPeriod = addSubscriptionMonths(period, 1);
  const periodLabel = subscriptionPeriodLabel(period, panelLocale(locale));
  const nextPeriodLabel = subscriptionPeriodLabel(nextPeriod, panelLocale(locale));
  const nextStatus =
    summary?.nextPeriodStatus === "paid"
      ? labels.paid
      : summary?.nextPeriodStatus === "free"
        ? labels.free
        : labels.unpaid;
  if (!summary?.enrolled) {
    return (
      <>
        <td className="ops-driver-sub-fee" title={labels.notManaged}>
          —
        </td>
        <td className="ops-driver-sub-currency" title={labels.notManaged}>
          —
        </td>
        <td className="ops-driver-sub-status" title={labels.notManaged}>
          <span className="ops-driver-sub-period-label">{periodLabel}:</span> —
        </td>
        <td className="ops-driver-sub-status" title={labels.notManaged}>
          <span className="ops-driver-sub-period-label">{nextPeriodLabel}:</span> —
        </td>
      </>
    );
  }
  const status =
    summary.currentPeriodStatus === "paid"
      ? labels.paid
      : summary.currentPeriodStatus === "free"
        ? labels.free
        : labels.unpaid;
  return (
    <>
      <td className="ops-driver-sub-fee">
        {formatUetdsSubscriptionFee(summary.monthlyFee) || "—"}
      </td>
      <td className="ops-driver-sub-currency">{summary.currency || "—"}</td>
      <td className="ops-driver-sub-status">
        <span className="ops-driver-sub-period-label">{periodLabel}:</span> {status}
      </td>
      <td className="ops-driver-sub-status">
        <span className="ops-driver-sub-period-label">{nextPeriodLabel}:</span> {nextStatus}
      </td>
    </>
  );
}
