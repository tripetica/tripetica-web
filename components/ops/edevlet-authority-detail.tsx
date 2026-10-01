"use client";

import { useActionState, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { EdevletAuthorityForm } from "@/components/partner/edevlet-authority-form";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import {
  deleteOpsEdevletAuthorityAction,
  setOpsEdevletAuthorityStatusAction,
  updateOpsEdevletAuthorityAction,
} from "@/lib/uetds/ops-authority-actions";
import {
  type OpsEdevletAuthoritySummary,
  type PartnerEdevletAuthorityState,
} from "@/lib/uetds/partner-authority-fields";

type OpsEdevletAuthorityDetailProps = {
  locale: Locale;
  copy: OpsCopy;
  partnerCopy: PartnerCopy;
  authority: OpsEdevletAuthoritySummary;
  companies: readonly UetdsCompanyRef[];
  canManage: boolean;
};

const INITIAL: PartnerEdevletAuthorityState = { ok: false, error: null };

export function OpsEdevletAuthorityDetail({
  locale,
  copy,
  partnerCopy,
  authority,
  companies,
  canManage,
}: OpsEdevletAuthorityDetailProps) {
  const [current, setCurrent] = useState(authority);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const listHref = localizedPath(locale, "/ops/uetds/authorities");
  const [statusState, statusAction, statusPending] = useActionState<
    PartnerEdevletAuthorityState,
    FormData
  >(async (previous, form) => {
    const result = await setOpsEdevletAuthorityStatusAction(previous, form);
    if (result.ok && result.authority) {
      setCurrent((item) => ({
        ...item,
        ...result.authority,
        partnerId: item.partnerId,
        partnerName: item.partnerName,
      }));
    }
    return result;
  }, INITIAL);
  const [deleteState, deleteAction, deleting] = useActionState(deleteOpsEdevletAuthorityAction, INITIAL);
  const nextStatus = current.status === "active" ? "inactive" : "active";

  return (
    <section className="partner-billing-card partner-profile-card">
      <div className="ops-page-head">
        <h2>{current.fullName}</h2>
      </div>
      {editing && canManage ? (
        <EdevletAuthorityForm
          locale={locale}
          copy={partnerCopy}
          companies={companies}
          mode="edit"
          authority={current}
          updateAction={updateOpsEdevletAuthorityAction}
          onSaved={(saved) => {
            setCurrent((item) => ({
              ...item,
              ...saved,
              partnerId: item.partnerId,
              partnerName: item.partnerName,
            }));
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{copy.partnerColumn}</p>
            <p className="partner-billing-value">{current.partnerName}</p>
          </div>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{partnerCopy.driverFullName}</p>
            <p className="partner-billing-value">{current.fullName}</p>
          </div>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{partnerCopy.driverNationalId}</p>
            <p className="partner-billing-value">{current.maskedIdentity}</p>
          </div>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{partnerCopy.edevletAuthorityPassword}</p>
            <p className="partner-billing-value">••••••••</p>
          </div>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{partnerCopy.driverStatus}</p>
            <p className="partner-billing-value">
              {current.status === "active" ? copy.active : copy.inactive}
            </p>
          </div>
          <div className="partner-profile-row">
            <p className="partner-billing-label">{partnerCopy.edevletAuthorityCompanies}</p>
            <p className="partner-billing-value">
              {current.companies.length > 0
                ? current.companies.map((company) => company.shortName).join(", ")
                : partnerCopy.edevletAuthorityNoCompanies}
            </p>
          </div>
          {statusState.error ? (
            <p className="ops-form-error" role="alert">
              {partnerCopy.edevletAuthoritySaveFailed}
            </p>
          ) : null}
          <div className="partner-profile-actions partner-driver-status-actions">
            {canManage ? (
              <button type="button" className="ops-btn-secondary" onClick={() => setEditing(true)}>
                {copy.edit}
              </button>
            ) : null}
            {canManage ? (
              <form action={statusAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={current.id} />
                <input type="hidden" name="status" value={nextStatus} />
                <button
                  type="submit"
                  className={current.status === "active" ? "ops-btn-cancel-soft" : "ops-btn-activate"}
                  disabled={statusPending}
                >
                  {current.status === "active" ? partnerCopy.deactivateDriver : partnerCopy.activateDriver}
                </button>
              </form>
            ) : null}
            {canManage ? (
              <button type="button" className="ops-btn-danger" onClick={() => setDeleteOpen(true)}>
                {copy.delete}
              </button>
            ) : null}
            <a className="ops-btn-secondary" href={listHref}>
              {partnerCopy.closeDriver}
            </a>
          </div>
        </>
      )}
      <form action={deleteAction} id="ops-edevlet-authority-detail-delete" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={current.id} />
      </form>
      {deleteOpen ? (
        <OpsConfirmDialog
          title={partnerCopy.edevletAuthorityDeleteConfirm}
          error={deleteState.error ? partnerCopy.edevletAuthorityDeleteFailed : null}
          pending={deleting}
          cancelLabel={partnerCopy.cancelEdit}
          confirmLabel={partnerCopy.deleteDriverYes}
          confirmFormId="ops-edevlet-authority-detail-delete"
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </section>
  );
}
