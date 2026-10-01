"use client";

import { useActionState, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import { type PartnerCopy } from "@/lib/partner/copy";
import { deleteOpsEdevletAuthorityAction } from "@/lib/uetds/ops-authority-actions";
import {
  type OpsEdevletAuthoritySummary,
  type PartnerEdevletAuthorityState,
} from "@/lib/uetds/partner-authority-fields";

type OpsEdevletAuthorityListProps = {
  locale: Locale;
  copy: OpsCopy;
  partnerCopy: PartnerCopy;
  authorities: OpsEdevletAuthoritySummary[];
  canManage: boolean;
};

const INITIAL: PartnerEdevletAuthorityState = { ok: false, error: null };

export function OpsEdevletAuthorityList({
  locale,
  copy,
  partnerCopy,
  authorities,
  canManage,
}: OpsEdevletAuthorityListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteState, deleteAction, deleting] = useActionState(deleteOpsEdevletAuthorityAction, INITIAL);
  const target = authorities.find((authority) => authority.id === deleteId) ?? null;

  return (
    <>
      <div className="ops-page-head">
        <h2>{copy.uetdsEdevletAuthorities}</h2>
      </div>
      {authorities.length === 0 ? (
        <div className="partner-empty">
          <p className="partner-empty-lead">{copy.uetdsEdevletAuthoritiesEmpty}</p>
        </div>
      ) : (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>{copy.fullName}</th>
                <th>{copy.partnerColumn}</th>
                <th>{partnerCopy.driverNationalId}</th>
                <th>{partnerCopy.edevletAuthorityCompanies}</th>
                <th>{partnerCopy.driverStatus}</th>
                {canManage ? <th>{copy.edit}</th> : null}
                {canManage ? <th>{copy.delete}</th> : null}
              </tr>
            </thead>
            <tbody>
              {authorities.map((authority) => (
                <tr key={authority.id}>
                  <td>{authority.fullName}</td>
                  <td>{authority.partnerName}</td>
                  <td>{authority.maskedIdentity}</td>
                  <td>
                    {authority.companies.length > 0
                      ? authority.companies.map((company) => company.shortName).join(", ")
                      : partnerCopy.edevletAuthorityNoCompanies}
                  </td>
                  <td>
                    <span className={`ops-status-badge ${authority.status === "active" ? "is-active" : "is-inactive"}`}>
                      {authority.status === "active" ? copy.active : copy.inactive}
                    </span>
                  </td>
                  {canManage ? (
                    <td>
                      <a
                        className="ops-row-detail"
                        href={localizedPath(locale, `/ops/uetds/authorities/${authority.id}`)}
                      >
                        {copy.edit}
                      </a>
                    </td>
                  ) : null}
                  {canManage ? (
                    <td>
                      <button type="button" className="ops-btn-danger" onClick={() => setDeleteId(authority.id)}>
                        {copy.delete}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form action={deleteAction} id="ops-edevlet-authority-delete" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={target?.id ?? ""} />
      </form>
      {target ? (
        <OpsConfirmDialog
          title={partnerCopy.edevletAuthorityDeleteConfirm}
          error={deleteState.error ? partnerCopy.edevletAuthorityDeleteFailed : null}
          pending={deleting}
          cancelLabel={partnerCopy.cancelEdit}
          confirmLabel={partnerCopy.deleteDriverYes}
          confirmFormId="ops-edevlet-authority-delete"
          onClose={() => setDeleteId(null)}
        />
      ) : null}
    </>
  );
}
