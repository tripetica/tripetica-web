"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type BookingDraftView } from "@/lib/booking/draft-view";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

type EditReview = {
  mode: "cash_update" | "zero_diff" | "additional_payment" | "refund";
  reservationCode: string;
  newTotal: number;
  newCurrency: string;
  netCollected: number;
  collectedCurrency: string | null;
  amountDue: number;
  amountRefund: number;
  cashPayableTotal: number | null;
};

function moneyLabel(amount: number, currency: string) {
  return `${amount} ${currency}`.trim();
}

export function EditFinalizePanel({
  locale,
  draft,
  onValidateBeforeCommit,
}: {
  locale: Locale;
  draft: BookingDraftView;
  homeHref: string;
  /** Same checkout validation + draft flush used by normal booking submit. */
  onValidateBeforeCommit: () => Promise<boolean>;
}) {
  const copy = checkoutCopy[locale];
  const router = useRouter();
  const [review, setReview] = useState<EditReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    void fetch("/api/booking/edit/finalize")
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean;
          review?: EditReview;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok || !payload.review) {
          setError(copy.editFinalizeError);
          return;
        }
        setReview(payload.review);
      })
      .catch(() => {
        if (!cancelled) {
          setError(copy.editFinalizeError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [copy.editFinalizeError, draft.appliedVehicleTotal, draft.currency]);

  async function confirm() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const valid = await onValidateBeforeCommit();
      if (!valid) {
        return;
      }
      const response = await fetch("/api/booking/edit/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalAccepted: true }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        outcome?: string;
        paymentUrl?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        if (payload.error === "legal_required") {
          setError(copy.legalRequired);
          return;
        }
        if (payload.error === "checkout" || payload.error === "invalid") {
          setError(copy.completeError);
          return;
        }
        setError(copy.editFinalizeError);
        return;
      }
      if (payload.outcome === "payment_required" && payload.paymentUrl) {
        window.location.assign(payload.paymentUrl);
        return;
      }
      if (draft.opsEditMode && draft.editReservationId) {
        router.push(
          localizedPath(locale, `/ops/reservations/${draft.editReservationId}`),
        );
        router.refresh();
        return;
      }
      if (payload.outcome === "committed" && review?.mode === "zero_diff") {
        router.push(localizedPath(locale, "/booking/success"));
        router.refresh();
        return;
      }
      router.push(localizedPath(locale, "/account/reservations"));
      router.refresh();
    } catch {
      setError(copy.editFinalizeError);
    } finally {
      setBusy(false);
    }
  }

  const ctaLabel = (() => {
    if (!review) {
      return copy.editCtaUpdateReservation;
    }
    if (review.mode === "additional_payment") {
      return copy.proceedToPayment;
    }
    if (review.mode === "refund") {
      return copy.editCtaRequestRefund;
    }
    if (review.mode === "cash_update" || review.mode === "zero_diff") {
      return copy.editCtaCashConfirm;
    }
    return copy.editCtaUpdateReservation;
  })();

  const busyLabel =
    review?.mode === "additional_payment"
      ? copy.proceedingToPayment
      : copy.completingReservation;

  const ctaDisabled = busy || loading || !review;

  return (
    <section
      className="checkout-card glass-surface"
      aria-labelledby="checkout-edit-review-title"
    >
      <h2 id="checkout-edit-review-title" className="checkout-card-title">
        {copy.editReviewTitle}
      </h2>
      {loading ? (
        <p className="checkout-edit-review-body">…</p>
      ) : review ? (
        <dl className="checkout-edit-review-grid">
          <div>
            <dt>{copy.editReviewNewTotal}</dt>
            <dd>{moneyLabel(review.newTotal, review.newCurrency)}</dd>
          </div>
          {review.mode === "cash_update" ? (
            <div>
              <dt>{copy.editReviewCashPayable}</dt>
              <dd>
                {moneyLabel(
                  review.cashPayableTotal ?? review.newTotal,
                  review.newCurrency,
                )}
              </dd>
            </div>
          ) : (
            <>
              <div>
                <dt>{copy.editReviewNetCollected}</dt>
                <dd>
                  {moneyLabel(
                    review.netCollected,
                    review.collectedCurrency ?? review.newCurrency,
                  )}
                </dd>
              </div>
              {review.mode === "additional_payment" ? (
                <div>
                  <dt>{copy.editReviewAmountDue}</dt>
                  <dd>{moneyLabel(review.amountDue, review.newCurrency)}</dd>
                </div>
              ) : null}
              {review.mode === "refund" ? (
                <div>
                  <dt>{copy.editReviewAmountRefund}</dt>
                  <dd>
                    {moneyLabel(
                      review.amountRefund,
                      review.collectedCurrency ?? review.newCurrency,
                    )}
                  </dd>
                </div>
              ) : null}
              {review.mode === "zero_diff" ? (
                <div>
                  <dt>{copy.editReviewDifference}</dt>
                  <dd>{copy.editReviewNoDifference}</dd>
                </div>
              ) : null}
            </>
          )}
        </dl>
      ) : null}
      <p className="checkout-edit-review-body">
        {review?.mode === "refund"
          ? copy.editReviewRefundBody.replaceAll(
              "{amount}",
              moneyLabel(
                review.amountRefund,
                review.collectedCurrency ?? review.newCurrency,
              ),
            )
          : copy.editReviewPendingBody}
      </p>
      {error ? <p className="checkout-form-error">{error}</p> : null}
      <div className="checkout-finish checkout-edit-finish">
        <button
          type="button"
          className="checkout-finish-cta"
          disabled={ctaDisabled}
          aria-busy={busy}
          onClick={() => void confirm()}
        >
          {busy ? busyLabel : ctaLabel}
        </button>
      </div>
    </section>
  );
}
