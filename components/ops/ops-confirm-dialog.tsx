"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type OpsConfirmDialogProps = {
  title: string;
  error?: string | null;
  children?: ReactNode;
  pending: boolean;
  cancelLabel: string;
  confirmLabel: string;
  confirmFormId?: string;
  onConfirm?: () => void;
  confirmTone?: "danger" | "positive";
  onClose: () => void;
};

export function OpsConfirmDialog({
  title,
  error,
  children,
  pending,
  cancelLabel,
  confirmLabel,
  confirmFormId,
  onConfirm,
  confirmTone = "danger",
  onClose,
}: OpsConfirmDialogProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="ops-detail-confirm-backdrop"
      role="presentation"
      onClick={() => {
        if (!pending) {
          onClose();
        }
      }}
    >
      <div
        className="ops-modal ops-detail-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
        {error ? <p className="ops-form-error">{error}</p> : null}
        <div className="ops-modal-actions">
          <button
            type="button"
            className="ops-btn-secondary"
            onClick={onClose}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type={onConfirm ? "button" : "submit"}
            form={onConfirm ? undefined : confirmFormId}
            className={confirmTone === "positive" ? "ops-btn-positive" : "ops-btn-danger"}
            disabled={pending}
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
