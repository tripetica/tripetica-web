"use client";

type OpsConfirmDialogProps = {
  title: string;
  error?: string | null;
  pending: boolean;
  cancelLabel: string;
  confirmLabel: string;
  confirmFormId: string;
  confirmTone?: "danger" | "positive";
  onClose: () => void;
};

export function OpsConfirmDialog({
  title,
  error,
  pending,
  cancelLabel,
  confirmLabel,
  confirmFormId,
  confirmTone = "danger",
  onClose,
}: OpsConfirmDialogProps) {
  return (
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
        aria-labelledby="ops-entity-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="ops-entity-delete-title">{title}</h2>
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
            type="submit"
            form={confirmFormId}
            className={confirmTone === "positive" ? "ops-btn-positive" : "ops-btn-danger"}
            disabled={pending}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
