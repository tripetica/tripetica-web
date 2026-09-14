"use client";

export function NonTrpAssignPanelHeader({
  title,
  closeLabel,
  disabled,
  onClose,
}: {
  title: string;
  closeLabel: string;
  disabled?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="partner-job-assign-panel-head">
      <p className="partner-job-assign-kind">{title}</p>
      <button
        type="button"
        className="partner-job-assign-panel-close"
        aria-label={closeLabel}
        title={closeLabel}
        disabled={disabled}
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
