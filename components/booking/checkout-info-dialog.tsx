"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type CheckoutInfoDialogProps = {
  title: string;
  body: string;
  closeLabel: string;
  onClose: () => void;
};

export function CheckoutInfoDialog({
  title,
  body,
  closeLabel,
  onClose,
}: CheckoutInfoDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes?.length) {
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="checkout-info-overlay" role="presentation">
      <button
        type="button"
        className="checkout-info-backdrop"
        tabIndex={-1}
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="checkout-info-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="checkout-info-close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          >
            <path d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>
        <h2 id={titleId} className="checkout-info-title">
          {title}
        </h2>
        <p className="checkout-info-body">{body}</p>
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
