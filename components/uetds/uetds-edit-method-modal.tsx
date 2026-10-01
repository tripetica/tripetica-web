"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { type UetdsFormCopy } from "@/lib/uetds/copy";

type UetdsEditMethodModalProps = {
  open: boolean;
  showAiEdit?: boolean;
  copy: UetdsFormCopy;
  formHref: string;
  aiEditHref?: string | null;
  edevletUrl: string;
  seferReferansNo: string;
  onClose: () => void;
};

export function UetdsEditMethodModal({
  open,
  showAiEdit = false,
  copy,
  formHref,
  aiEditHref = null,
  edevletUrl,
  seferReferansNo,
  onClose,
}: UetdsEditMethodModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPopupBlocked(false);
    }
  }, [open]);

  if (!mounted || !open) {
    return null;
  }

  function openEdevlet() {
    setPopupBlocked(false);
    const popup = window.open(edevletUrl, "_blank");
    if (!popup) {
      setPopupBlocked(true);
    }
  }

  const seferNo = seferReferansNo.trim();

  return createPortal(
    <div
      className="ops-detail-confirm-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="ops-modal ops-detail-confirm-dialog uetds-edit-method-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{copy.editMethodTitle}</h2>
        {seferNo ? (
          <p className="uetds-edit-method-sefer">
            {copy.editMethodSeferNo.replaceAll("{seferNo}", seferNo)}
          </p>
        ) : null}
        <div className="uetds-edit-method-options">
          {showAiEdit && aiEditHref ? (
            <a className="uetds-edit-method-option is-ai" href={aiEditHref}>
              <span className="uetds-edit-method-option-title">{copy.editMethodAiTitle}</span>
              <span className="uetds-edit-method-option-body">{copy.editMethodAiBody}</span>
              <span className="uetds-edit-method-impact is-safe">{copy.editMethodAiImpact}</span>
            </a>
          ) : null}
          <a className="uetds-edit-method-option is-form" href={formHref}>
            <span className="uetds-edit-method-option-title">{copy.editMethodFormTitle}</span>
            <span className="uetds-edit-method-option-body">{copy.editMethodFormBody}</span>
            <span className="uetds-edit-method-impact is-warn">{copy.editMethodFormImpact}</span>
          </a>
          <button type="button" className="uetds-edit-method-option is-manual" onClick={openEdevlet}>
            <span className="uetds-edit-method-option-title">{copy.editMethodEdevletTitle}</span>
            <span className="uetds-edit-method-option-body">{copy.editMethodEdevletBody}</span>
            <span className="uetds-edit-method-impact is-neutral">{copy.editMethodEdevletImpact}</span>
          </button>
          {popupBlocked ? (
            <p className="ops-form-error">
              {copy.kamuPopupBlocked}{" "}
              <a href={edevletUrl} target="_blank" rel="noopener noreferrer">
                {copy.kamuLoginFallback}
              </a>
            </p>
          ) : null}
        </div>
        <div className="ops-modal-actions">
          <button type="button" className="ops-btn-secondary" onClick={onClose}>
            {copy.editMethodClose}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
