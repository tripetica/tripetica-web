"use client";

import { useState, useTransition } from "react";
import {
  requestReservationPaymentTxnCancelAction,
  requestReservationPaymentTxnRefundAction,
} from "@/lib/ops/actions";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  formatPaymentHistoryAmount,
  formatPaymentHistoryWhen,
  paymentMovementStatusLabel,
  type OpsPaymentHistoryRow,
  type OpsPaymentHistorySection,
} from "@/lib/ops/payment-history";
import { type OpsRecordDetail } from "@/lib/ops/record-detail";

type PaymentHistorySectionProps = {
  locale: Locale;
  copy: OpsCopy;
  reservationId: string;
  section: OpsPaymentHistorySection;
  onUpdated?: (detail: OpsRecordDetail) => void;
};

function parseAmountInput(raw: string) {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(2));
}

export function PaymentHistorySection({
  locale,
  copy,
  reservationId,
  section,
  onUpdated,
}: PaymentHistorySectionProps) {
  const [refundRow, setRefundRow] = useState<OpsPaymentHistoryRow | null>(null);
  const [cancelRow, setCancelRow] = useState<OpsPaymentHistoryRow | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [fullChecked, setFullChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openRefund(row: OpsPaymentHistoryRow) {
    setCancelRow(null);
    setRefundRow(row);
    setAmountInput("");
    setFullChecked(false);
    setError(null);
  }

  function openCancel(row: OpsPaymentHistoryRow) {
    setRefundRow(null);
    setCancelRow(row);
    setError(null);
  }

  function applyFullAmount(next: boolean, row: OpsPaymentHistoryRow) {
    setFullChecked(next);
    if (next) {
      setAmountInput(String(row.refundableAmount));
    }
  }

  function submitRefund() {
    if (!refundRow || pending) {
      return;
    }
    const amount = parseAmountInput(amountInput);
    if (amount == null || !(amount > 0)) {
      setError(copy.paymentRefundInvalidAmount);
      return;
    }
    if (amount > refundRow.refundableAmount) {
      setError(copy.paymentRefundExceedsMax);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await requestReservationPaymentTxnRefundAction(
        reservationId,
        refundRow.paymentTransactionId,
        amount,
        locale,
      );
      if (result.error || !result.detail) {
        setError(copy.paymentRefundFailed);
        if (result.detail) {
          onUpdated?.(result.detail);
        }
        return;
      }
      onUpdated?.(result.detail);
      setRefundRow(null);
    });
  }

  function submitCancel() {
    if (!cancelRow || pending) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await requestReservationPaymentTxnCancelAction(
        reservationId,
        cancelRow.paymentTransactionId,
        locale,
      );
      if (result.error || !result.detail) {
        setError(copy.paymentCancelFailed);
        if (result.detail) {
          onUpdated?.(result.detail);
        }
        return;
      }
      onUpdated?.(result.detail);
      setCancelRow(null);
    });
  }

  const currency = section.summary.currency;

  return (
    <section className="ops-payment-history">
      <h3>{copy.paymentHistoryTitle}</h3>

      <div className="ops-payment-history-metrics" role="group" aria-label={copy.paymentHistorySummaryTitle}>
        <div className="ops-payment-metric">
          <span className="ops-payment-metric-label">
            {copy.paymentHistoryReservationTotal}
          </span>
          <span className="ops-payment-metric-value">
            {section.summary.reservationTotal != null
              ? formatPaymentHistoryAmount(
                  section.summary.reservationTotal,
                  currency,
                  locale,
                )
              : "—"}
          </span>
        </div>
        <div className="ops-payment-metric">
          <span className="ops-payment-metric-label">
            {copy.paymentHistoryGrossPaid}
          </span>
          <span className="ops-payment-metric-value">
            {formatPaymentHistoryAmount(
              section.summary.grossSuccessful,
              currency,
              locale,
            )}
          </span>
        </div>
        <div className="ops-payment-metric">
          <span className="ops-payment-metric-label">
            {copy.paymentHistoryCompletedRefunds}
          </span>
          <span className="ops-payment-metric-value">
            {formatPaymentHistoryAmount(
              section.summary.completedRefunds,
              currency,
              locale,
            )}
          </span>
        </div>
        <div className="ops-payment-metric">
          <span className="ops-payment-metric-label">
            {copy.paymentHistoryNetCollected}
          </span>
          <span className="ops-payment-metric-value">
            {formatPaymentHistoryAmount(
              section.summary.netCollected,
              currency,
              locale,
            )}
          </span>
        </div>
        <div className="ops-payment-metric">
          <span className="ops-payment-metric-label">
            {copy.paymentHistoryRemainingDue}
          </span>
          <span className="ops-payment-metric-value">
            {section.summary.remainingDue != null
              ? formatPaymentHistoryAmount(
                  section.summary.remainingDue,
                  currency,
                  locale,
                )
              : "—"}
          </span>
        </div>
      </div>

      {section.rows.length === 0 ? (
        <p className="ops-empty">{copy.paymentHistoryEmpty}</p>
      ) : (
        <div className="ops-table-wrap ops-payment-history-table-wrap">
          <table className="ops-table ops-payment-history-table">
            <thead>
              <tr>
                <th>{copy.paymentHistoryDate}</th>
                <th>{copy.paymentHistoryOrderId}</th>
                <th>{copy.paymentHistoryAmount}</th>
                <th>{copy.paymentHistoryStatus}</th>
                <th>{copy.paymentHistoryAction}</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.paymentTransactionId}>
                  <td>{formatPaymentHistoryWhen(row.createdAt, locale)}</td>
                  <td>{row.providerOrderId?.trim() || "—"}</td>
                  <td>
                    {formatPaymentHistoryAmount(row.amount, row.currency, locale)}
                  </td>
                  <td>
                    <span
                      className={`ops-status-badge ${
                        row.displayStatus === "paid"
                          ? "is-active"
                          : row.displayStatus === "pending"
                            ? "is-pending"
                            : row.displayStatus === "cancelled" ||
                                row.displayStatus === "failed"
                              ? "is-cancelled"
                              : "is-pending"
                      }`}
                    >
                      {paymentMovementStatusLabel(row.displayStatus, copy)}
                    </span>
                  </td>
                  <td>
                    {row.action === "cancel_order" ? (
                      <button
                        type="button"
                        className="ops-btn-secondary ops-payment-action"
                        disabled={pending}
                        onClick={() => openCancel(row)}
                      >
                        {copy.paymentCancelOrder}
                      </button>
                    ) : row.action === "cancel_order_unsupported" ? (
                      <button
                        type="button"
                        className="ops-btn-ghost ops-payment-action"
                        disabled
                        title={copy.paymentCancelOrderUnsupported}
                      >
                        {copy.paymentCancelOrder}
                      </button>
                    ) : row.action === "refund" ? (
                      <button
                        type="button"
                        className="ops-btn-secondary ops-payment-action"
                        onClick={() => openRefund(row)}
                      >
                        {copy.paymentRefundAction}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cancelRow ? (
        <div className="ops-detail-confirm-backdrop" role="presentation">
          <div
            className="ops-detail-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-payment-cancel-title"
          >
            <h3 id="ops-payment-cancel-title">{copy.paymentCancelConfirmTitle}</h3>
            <p>
              {copy.paymentCancelConfirmBody}
              {cancelRow.providerOrderId
                ? ` (${cancelRow.providerOrderId})`
                : ""}
            </p>
            {error ? <p className="ops-form-error">{error}</p> : null}
            <div className="ops-detail-confirm-actions">
              <button
                type="button"
                className="ops-btn-ghost"
                disabled={pending}
                onClick={() => setCancelRow(null)}
              >
                {copy.paymentCancelConfirmDismiss}
              </button>
              <button
                type="button"
                className="ops-btn-danger"
                disabled={pending}
                onClick={submitCancel}
              >
                {pending
                  ? copy.paymentCancelSubmitting
                  : copy.paymentCancelConfirmSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {refundRow ? (
        <div className="ops-detail-confirm-backdrop" role="presentation">
          <div
            className="ops-detail-confirm-dialog ops-payment-refund-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-payment-refund-title"
          >
            <h3 id="ops-payment-refund-title">{copy.paymentRefundModalTitle}</h3>
            <dl className="ops-payment-refund-facts">
              <div className="ops-kv">
                <dt>{copy.paymentRefundCollected}</dt>
                <dd>
                  {formatPaymentHistoryAmount(
                    refundRow.collectedAmount,
                    refundRow.currency,
                    locale,
                  )}
                </dd>
              </div>
              <div className="ops-kv">
                <dt>{copy.paymentRefundAlready}</dt>
                <dd>
                  {formatPaymentHistoryAmount(
                    refundRow.completedRefundedAmount,
                    refundRow.currency,
                    locale,
                  )}
                </dd>
              </div>
              <div className="ops-kv">
                <dt>{copy.paymentRefundMax}</dt>
                <dd>
                  {formatPaymentHistoryAmount(
                    refundRow.refundableAmount,
                    refundRow.currency,
                    locale,
                  )}
                </dd>
              </div>
            </dl>
            <label className="ops-payment-refund-amount-label">
              <span>
                {copy.paymentRefundAmount} ({refundRow.currency})
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                disabled={pending || fullChecked}
                onChange={(event) => {
                  setFullChecked(false);
                  setAmountInput(event.target.value);
                }}
              />
            </label>
            <label className="ops-payment-refund-full">
              <input
                type="checkbox"
                checked={fullChecked}
                disabled={pending}
                onChange={(event) =>
                  applyFullAmount(event.target.checked, refundRow)
                }
              />
              <span>{copy.paymentRefundFull}</span>
            </label>
            {error ? <p className="ops-form-error">{error}</p> : null}
            <div className="ops-detail-confirm-actions">
              <button
                type="button"
                className="ops-btn-ghost"
                disabled={pending}
                onClick={() => setRefundRow(null)}
              >
                {copy.paymentRefundCancel}
              </button>
              <button
                type="button"
                className="ops-btn-primary"
                disabled={pending}
                onClick={submitRefund}
              >
                {pending ? copy.paymentRefundSubmitting : copy.paymentRefundSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
