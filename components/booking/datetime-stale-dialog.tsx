"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type DatetimeStaleDialogProps = {
  title: string;
  body: string;
  nearestLabel: string;
  nearestValue: string;
  useNearestLabel: string;
  pickOtherLabel: string;
  onUseNearest: () => void;
  onPickOther: () => void;
  onDismiss: () => void;
};

export function DatetimeStaleDialog({
  title,
  body,
  nearestLabel,
  nearestValue,
  useNearestLabel,
  pickOtherLabel,
  onUseNearest,
  onPickOther,
  onDismiss,
}: DatetimeStaleDialogProps) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [onDismiss]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="checkout-info-overlay" role="presentation">
      <button
        type="button"
        className="checkout-info-backdrop"
        tabIndex={-1}
        aria-label={title}
        onClick={onDismiss}
      />
      <div
        className="checkout-info-dialog datetime-stale-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="checkout-info-title">
          {title}
        </h2>
        <p className="checkout-info-body">{body}</p>
        <div className="datetime-stale-nearest">
          <p className="datetime-stale-nearest-label">{nearestLabel}</p>
          <p className="datetime-stale-nearest-value">{nearestValue}</p>
        </div>
        <div className="checkout-pickup-prep-actions datetime-stale-actions">
          <button
            ref={primaryRef}
            type="button"
            className="booking-cta datetime-stale-primary"
            onClick={onUseNearest}
          >
            {useNearestLabel}
          </button>
          <button
            type="button"
            className="booking-cta-secondary datetime-stale-secondary"
            onClick={onPickOther}
          >
            {pickOtherLabel}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
