"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { type UetdsFormCopy } from "@/lib/uetds/copy";
import { uetdsEditMethodOptionIds, type UetdsEditMethodId } from "@/lib/uetds/edit-method-options";

type UetdsEditMethodModalProps = {
  open: boolean;
  copy: UetdsFormCopy;
  formHref: string;
  edevletUrl: string;
  seferNo: string | null;
  /** Server-computed. Standard sessions omit Tripetica AI. */
  showAiEdit: boolean;
  onClose: () => void;
};

const EMPHASIS_CLASS: Record<UetdsEditMethodId, string> = {
  ai: "is-positive-green",
  form: "is-attention-amber",
  edevlet: "is-neutral-teal",
};

export function UetdsEditMethodModal({
  open,
  copy,
  formHref,
  edevletUrl,
  seferNo,
  showAiEdit,
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

  const visibleSeferNo = seferNo?.trim() || null;
  const seferLine = visibleSeferNo
    ? copy.editMethodSeferNo.replaceAll("{seferNo}", visibleSeferNo)
    : null;

  function optionCopy(id: UetdsEditMethodId) {
    if (id === "ai") {
      return {
        title: copy.editMethodAiTitle,
        body: copy.editMethodAiBody,
        emphasis: copy.editMethodNotifyUnchanged,
      };
    }
    if (id === "form") {
      return {
        title: copy.editMethodFormTitle,
        body: copy.editMethodFormBody,
        emphasis: copy.editMethodNotifyChanged,
      };
    }
    return {
      title: copy.editMethodEdevletTitle,
      body: copy.editMethodEdevletBody,
      emphasis: copy.editMethodNotifyUnchanged,
    };
  }

  function optionBody(id: UetdsEditMethodId) {
    const content = optionCopy(id);
    return (
      <>
        <span className="uetds-edit-method-option-title">{content.title}</span>
        <span className="uetds-edit-method-option-body">{content.body}</span>
        {seferLine ? <span className="uetds-edit-method-sefer">{seferLine}</span> : null}
        <span className="uetds-edit-method-option-note">
          {copy.editMethodPassengerUpdatePrefix}{" "}
          <span className={`uetds-edit-method-emphasis ${EMPHASIS_CLASS[id]}`}>{content.emphasis}</span>
        </span>
      </>
    );
  }

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
        <div className="uetds-edit-method-options">
          {uetdsEditMethodOptionIds(showAiEdit).map((id) => {
            if (id === "form") {
              return (
                <a key={id} className="uetds-edit-method-option" href={formHref}>
                  {optionBody(id)}
                </a>
              );
            }
            if (id === "edevlet") {
              return (
                <button key={id} type="button" className="uetds-edit-method-option" onClick={openEdevlet}>
                  {optionBody(id)}
                </button>
              );
            }
            return (
              <button key={id} type="button" className="uetds-edit-method-option">
                {optionBody(id)}
              </button>
            );
          })}
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
