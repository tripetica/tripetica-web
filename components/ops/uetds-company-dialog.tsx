"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { OpsPasswordField } from "@/components/ops/password-field";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  saveUetdsCompanyAction,
  type UetdsCompanyFormState,
} from "@/lib/ops/uetds-company-actions";
import {
  UETDS_AUTHORITY_TYPES,
  type UetdsCompanyEditor,
} from "@/lib/ops/uetds-company-fields";

type UetdsCompanyDialogProps = {
  locale: Locale;
  copy: OpsCopy;
  company: UetdsCompanyEditor | null;
  onClose: () => void;
  onSaved: () => void;
};

const INITIAL: UetdsCompanyFormState = { error: null, ok: false, id: "" };

export function UetdsCompanyDialog({
  locale,
  copy,
  company,
  onClose,
  onSaved,
}: UetdsCompanyDialogProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [state, formAction, pending] = useActionState(saveUetdsCompanyAction, INITIAL);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (state.ok) {
      onSaved();
    }
  }, [onSaved, state.ok]);

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
        className="ops-modal ops-uetds-company-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{company ? copy.uetdsEditCompany : copy.uetdsNewCompany}</h2>
        <form action={formAction} className="ops-record-edit">
          <input type="hidden" name="locale" value={locale} />
          {company ? <input type="hidden" name="id" value={company.id} /> : null}

          <section className="ops-edit-section">
            <h3>{copy.uetdsCompanyInfo}</h3>
            <div className="ops-edit-grid">
              <label className="ops-field">
                <span>{copy.uetdsShortName}</span>
                <input name="shortName" required defaultValue={company?.shortName ?? ""} />
              </label>
              <label className="ops-field ops-field-wide">
                <span>{copy.uetdsLegalName}</span>
                <input name="legalName" required defaultValue={company?.legalName ?? ""} />
              </label>
              <label className="ops-field">
                <span>{copy.uetdsTaxNumber}</span>
                <input name="taxNumber" required defaultValue={company?.taxNumber ?? ""} />
              </label>
              <label className="ops-field">
                <span>{copy.uetdsAuthorityType}</span>
                <select
                  name="authorityDocumentType"
                  defaultValue={company?.authorityDocumentType ?? "D2"}
                >
                  {UETDS_AUTHORITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ops-field">
                <span>{copy.uetdsAuthorityNumber}</span>
                <input
                  name="authorityDocumentNumber"
                  required
                  defaultValue={company?.authorityDocumentNumber ?? ""}
                />
              </label>
              <label className="ops-field">
                <span>{copy.status}</span>
                <select name="status" defaultValue={company?.status ?? "active"}>
                  <option value="active">{copy.active}</option>
                  <option value="inactive">{copy.inactive}</option>
                </select>
              </label>
            </div>
          </section>

          <section className="ops-edit-section">
            <h3>{copy.uetdsTestCredentials}</h3>
            <div className="ops-edit-grid">
              <label className="ops-field">
                <span>{copy.uetdsTestUsername}</span>
                <input
                  name="testUsername"
                  autoComplete="off"
                  defaultValue={company?.testUsername ?? ""}
                />
              </label>
              <div>
                <OpsPasswordField
                  label={copy.uetdsTestPassword}
                  name="testPassword"
                  autoComplete="new-password"
                  showPasswordLabel={copy.showPassword}
                  hidePasswordLabel={copy.hidePassword}
                />
                {company?.hasTestPassword ? (
                  <p className="ops-password-saved">{copy.uetdsPasswordSaved}</p>
                ) : null}
                {company ? <p className="partner-field-hint">{copy.uetdsPasswordKeepHint}</p> : null}
              </div>
            </div>
          </section>

          <section className="ops-edit-section">
            <h3>{copy.uetdsLiveCredentials}</h3>
            <div className="ops-edit-grid">
              <label className="ops-field">
                <span>{copy.uetdsLiveUsername}</span>
                <input
                  name="liveUsername"
                  autoComplete="off"
                  defaultValue={company?.liveUsername ?? ""}
                />
              </label>
              <div>
                <OpsPasswordField
                  label={copy.uetdsLivePassword}
                  name="livePassword"
                  autoComplete="new-password"
                  showPasswordLabel={copy.showPassword}
                  hidePasswordLabel={copy.hidePassword}
                />
                {company?.hasLivePassword ? (
                  <p className="ops-password-saved">{copy.uetdsPasswordSaved}</p>
                ) : null}
                {company ? <p className="partner-field-hint">{copy.uetdsPasswordKeepHint}</p> : null}
              </div>
            </div>
          </section>

          {state.error === "forbidden" ? (
            <p className="ops-form-error">{copy.forbidden}</p>
          ) : null}
          {state.error === "invalid" || state.error === "failed" ? (
            <p className="ops-form-error">{copy.uetdsSaveFailed}</p>
          ) : null}

          <div className="ops-modal-actions">
            <button
              type="button"
              className="ops-btn-secondary"
              disabled={pending}
              onClick={onClose}
            >
              {copy.cancel}
            </button>
            <button type="submit" className="ops-btn-primary" disabled={pending}>
              {pending ? copy.saving : copy.save}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
