"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type CheckoutPickupPrepDialogProps = {
  title: string;
  body: string;
  backLabel: string;
  confirmLabel: string;
  confirming: boolean;
  onBack: () => void;
  onConfirm: () => void;
};

export function CheckoutPickupPrepDialog({
  title,
  body,
  backLabel,
  confirmLabel,
  confirming,
  onBack,
  onConfirm,
}: CheckoutPickupPrepDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !confirming) {
        event.preventDefault();
        onBack();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [confirming, onBack]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="checkout-info-overlay" role="presentation">
      <button
        type="button"
        className="checkout-info-backdrop"
        tabIndex={-1}
        aria-label={backLabel}
        disabled={confirming}
        onClick={() => {
          if (!confirming) {
            onBack();
          }
        }}
      />
      <div
        ref={dialogRef}
        className="checkout-info-dialog checkout-pickup-prep-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="checkout-info-title">
          {title}
        </h2>
        <p className="checkout-info-body">{body}</p>
        <div className="checkout-pickup-prep-actions">
          <button
            type="button"
            className="booking-cta-secondary checkout-pickup-prep-back"
            disabled={confirming}
            onClick={onBack}
          >
            {backLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="booking-cta checkout-pickup-prep-confirm"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
