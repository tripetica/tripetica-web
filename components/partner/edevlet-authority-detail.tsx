"use client";

import { useActionState, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { EdevletAuthorityForm } from "@/components/partner/edevlet-authority-form";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import {
  deletePartnerEdevletAuthorityAction,
  setPartnerEdevletAuthorityStatusAction,
} from "@/lib/uetds/partner-authority-actions";
import {
  type PartnerEdevletAuthorityState,
  type PartnerEdevletAuthoritySummary,
} from "@/lib/uetds/partner-authority-fields";

type EdevletAuthorityDetailProps = {
  locale: Locale;
  copy: PartnerCopy;
  authority: PartnerEdevletAuthoritySummary;
  companies: readonly UetdsCompanyRef[];
};

const INITIAL: PartnerEdevletAuthorityState = { ok: false, error: null };

export function EdevletAuthorityDetail({
  locale,
  copy,
  authority,
  companies,
}: EdevletAuthorityDetailProps) {
  const [current, setCurrent] = useState(authority);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const listHref = localizedPath(locale, "/partner/edevlet-authorities");
  const [statusState, statusAction, statusPending] = useActionState<
    PartnerEdevletAuthorityState,
    FormData
  >(async (previous, form) => {
    const result = await setPartnerEdevletAuthorityStatusAction(previous, form);
    if (result.ok && result.authority) setCurrent(result.authority);
    return result;
  }, INITIAL);
  const [deleteState, deleteAction, deleting] = useActionState(
    deletePartnerEdevletAuthorityAction,
    INITIAL,
  );
  const nextStatus = current.status === "active" ? "inactive" : "active";

  return (
    <section className="partner-billing-card partner-profile-card">
      <div className="ops-page-head">
        <h1>{current.fullName}</h1>
      </div>
      {editing ? (
        <EdevletAuthorityForm
          locale={locale}
          copy={copy}
          companies={companies}
          mode="edit"
          authority={current}
          onSaved={(saved) => {
            setCurrent(saved);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{copy.driverFullName}</p>
            <p className="partner-billing-value">{current.fullName}</p>
          </div>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{copy.driverNationalId}</p>
            <p className="partner-billing-value">{current.maskedIdentity}</p>
          </div>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{copy.edevletAuthorityPassword}</p>
            <p className="partner-billing-value">••••••••</p>
          </div>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{copy.driverStatus}</p>
            <p className="partner-billing-value">
              {current.status === "active" ? copy.driverActive : copy.driverInactive}
            </p>
          </div>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{copy.edevletAuthorityCompanies}</p>
            <p className="partner-billing-value">
              {current.companies.length > 0
                ? current.companies.map((company) => company.shortName).join(", ")
                : copy.edevletAuthorityNoCompanies}
            </p>
          </div>
          {statusState.error ? (
            <p className="ops-form-error" role="alert">
              {copy.edevletAuthoritySaveFailed}
            </p>
          ) : null}
          <div className="partner-profile-actions partner-driver-status-actions">
            <button type="button" className="ops-btn-secondary" onClick={() => setEditing(true)}>
              {copy.editField}
            </button>
            <form action={statusAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={current.id} />
              <input type="hidden" name="status" value={nextStatus} />
              <button
                type="submit"
                className={current.status === "active" ? "ops-btn-cancel-soft" : "ops-btn-activate"}
                disabled={statusPending}
              >
                {current.status === "active" ? copy.deactivateDriver : copy.activateDriver}
              </button>
            </form>
            <button type="button" className="ops-btn-danger" onClick={() => setDeleteOpen(true)}>
              {copy.deleteDriver}
            </button>
            <a className="ops-btn-secondary" href={listHref}>
              {copy.closeDriver}
            </a>
          </div>
        </>
      )}
      <form action={deleteAction} id="edevlet-authority-delete-form" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={current.id} />
      </form>
      {deleteOpen ? (
        <OpsConfirmDialog
          title={copy.edevletAuthorityDeleteConfirm}
          error={deleteState.error ? copy.edevletAuthorityDeleteFailed : null}
          pending={deleting}
          cancelLabel={copy.cancelEdit}
          confirmLabel={copy.deleteDriverYes}
          confirmFormId="edevlet-authority-delete-form"
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </section>
  );
}
