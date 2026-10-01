"use client";

import { useActionState, useEffect, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { UetdsEditMethodModal } from "@/components/uetds/uetds-edit-method-modal";
import { uetdsStatusLabel, type UetdsFormCopy } from "@/lib/uetds/copy";
import { formatUetdsSnapshotDateTime } from "@/lib/uetds/edit-policy";
import { resolveKamuEditDeepLink } from "@/lib/uetds/kamu-portal/deep-link";
import { type UetdsNotificationDetail } from "@/lib/uetds/notification-view";
import {
  cancelUetdsNotificationAction,
  retryUetdsFinalVerificationAction,
  deleteCancelledUetdsNotificationsAction,
  type UetdsManageFormState,
} from "@/lib/uetds/notification-actions";

type UetdsNotificationDetailViewProps = {
  notification: UetdsNotificationDetail;
  copy: UetdsFormCopy;
  listHref: string;
  pdfHref: string | null;
  editHref: string | null;
  aiEditHref?: string | null;
  /** Open the edit-method chooser on mount (reservation “Düzenle” deep-link). */
  openEditMethod?: boolean;
  showAiEdit?: boolean;
  actor: "partner" | "ops";
  locale: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function UetdsNotificationDetailView({
  notification,
  copy,
  listHref,
  pdfHref,
  editHref,
  aiEditHref = null,
  openEditMethod = false,
  showAiEdit = false,
  actor,
  locale,
}: UetdsNotificationDetailViewProps) {
  const snapshot = asRecord(JSON.parse(notification.snapshotJson || "{}"));
  const trip = asRecord(snapshot?.trip);
  const ministry = asRecord(snapshot?.ministry);
  const passengers = Array.isArray(snapshot?.passengers) ? snapshot.passengers : [];
  const start = formatUetdsSnapshotDateTime(text(trip?.startDate), text(trip?.startTime));
  const end = formatUetdsSnapshotDateTime(text(trip?.endDate), text(trip?.endTime));
  const seferRef = notification.ministryReference || text(ministry?.seferReferansNo);
  const lastNotify = text(ministry?.lastPassengerNotifiedAt);
  const lastNotifySource = text(ministry?.lastPassengerNotifiedSource);
  const firmaSeferNo =
    notification.reservationId?.trim() ||
    text(trip?.firmaSeferNo) ||
    text(ministry?.firmaSeferNo) ||
    null;
  const edevletLink = resolveKamuEditDeepLink({
    firmaSeferNo,
    ministrySeferRef: seferRef,
    plate: notification.plate,
  });

  const needsVerification = notification.finalVerificationResult === "final-verification-failed";
  const [verificationState, verifyAction, verifying] = useActionState(retryUetdsFinalVerificationAction, { ok: false, verified: false });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editMethodOpen, setEditMethodOpen] = useState(Boolean(openEditMethod && editHref));
  const [deleteState, deleteAction, deleting] = useActionState(deleteCancelledUetdsNotificationsAction, { results: [], attempted: false });
  const [state, action, pending] = useActionState<UetdsManageFormState, FormData>(
    cancelUetdsNotificationAction,
    { ok: false, error: null, message: null },
  );

  const cancelled = notification.status === "cancelled" || state.status === "cancelled";
  useEffect(() => {
    if (state.ok) { setCancelOpen(false); if (state.cancellationVerified) setDeleteOpen(true); }
  }, [state]);
  useEffect(() => {
    if (verificationState.verified) window.location.reload();
  }, [verificationState.verified]);
  useEffect(() => {
    if (deleteState.attempted) setDeleteOpen(false);
  }, [deleteState]);
  useEffect(() => {
    if (openEditMethod && editHref && !cancelled) {
      setEditMethodOpen(true);
    }
  }, [openEditMethod, editHref, cancelled]);

  return (
    <section className="uetds-detail">
      <div className="uetds-sticky-actions">
        {pdfHref ? (
          <a className="ops-btn-secondary" href={`${pdfHref}?download=1`}>
            {copy.ministryPdfDownload}
          </a>
        ) : null}
        {editHref && !cancelled ? (
          <button type="button" className="ops-btn-secondary" onClick={() => setEditMethodOpen(true)}>
            {copy.edit}
          </button>
        ) : null}
        {seferRef && !cancelled ? (
          <button type="button" className="ops-btn-secondary" onClick={() => setCancelOpen(true)}>
            {copy.cancelTrip}
          </button>
        ) : null}
        <a className="ops-btn-secondary" href={listHref}>
          {copy.backToList}
        </a>
      </div>

      {needsVerification && !cancelled ? (
        <div className="uetds-form-info" role="status">
          <p>{copy.finalVerificationFailed}</p>
          <form action={verifyAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="actor" value={actor} />
            <input type="hidden" name="id" value={notification.id} />
            <button className="ops-btn-secondary" disabled={verifying}>{copy.retryVerification}</button>
          </form>
        </div>
      ) : null}
      <dl className="uetds-confirm-dl">
        <div>
          <dt>{copy.seferRef}</dt>
          <dd>{seferRef || "—"}</dd>
        </div>
        <div>
          <dt>{copy.listStatus}</dt>
          <dd>{cancelled ? copy.statusCancelled : notification.finalVerificationResult === "verified" ? copy.verifiedByMinistry : needsVerification ? copy.verificationPending : uetdsStatusLabel(notification.status, copy)}</dd>
        </div>
        <div>
          <dt>{copy.notifyCompany}</dt>
          <dd>{notification.companyShortName}</dd>
        </div>
        <div>
          <dt>{copy.listStart}</dt>
          <dd>{start || "—"}</dd>
        </div>
        <div>
          <dt>{copy.listEnd}</dt>
          <dd>{end || "—"}</dd>
        </div>
        <div>
          <dt>{copy.lastPassengerNotify}</dt>
          <dd>
            {(lastNotifySource === "ministry_pdf" || lastNotifySource === "ministry_ozet") && lastNotify
              ? lastNotify
              : copy.lastPassengerNotifyUnknown}
          </dd>
        </div>
        <div>
          <dt>{copy.origin}</dt>
          <dd>{text(trip?.origin) || notification.routeLabel}</dd>
        </div>
        <div>
          <dt>{copy.destination}</dt>
          <dd>{text(trip?.destination) || "—"}</dd>
        </div>
        <div>
          <dt>{copy.listPlate}</dt>
          <dd>{notification.plate}</dd>
        </div>
        <div>
          <dt>{copy.driver}</dt>
          <dd>{notification.driverName}</dd>
        </div>
        <div>
          <dt>{copy.groupPurpose}</dt>
          <dd>{text(trip?.purpose) || "—"}</dd>
        </div>
        <div>
          <dt>{copy.groupFare}</dt>
          <dd>{text(trip?.fare) || "—"}</dd>
        </div>
      </dl>

      <div className="uetds-form-section">
        <h2>{copy.passengers}</h2>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>{copy.nationality}</th>
                <th>{copy.identity}</th>
                <th>{copy.firstName}</th>
                <th>{copy.lastName}</th>
                <th>{copy.gender}</th>
              </tr>
            </thead>
            <tbody>
              {passengers.map((item, index) => {
                const passenger = asRecord(item);
                return (
                  <tr key={`${text(passenger?.identityNumber)}-${index}`}>
                    <td>{text(passenger?.nationality) || "—"}</td>
                    <td>{text(passenger?.identityNumber) || "—"}</td>
                    <td>{text(passenger?.firstName) || "—"}</td>
                    <td>{text(passenger?.lastName) || "—"}</td>
                    <td>
                      {text(passenger?.gender) === "female"
                        ? copy.genderFemale
                        : text(passenger?.gender) === "male"
                          ? copy.genderMale
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {state.message ? (
        <p className={state.ok ? "uetds-form-info" : "ops-form-error"} role="status">
          {state.status === "cancelled" ? state.cancellationVerified ? copy.cancelVerifiedTitle : copy.cancelUnverified : state.message}
        </p>
      ) : null}

      {deleteState.attempted && !deleteState.results.some(result => result.reason === "deleted") ? <p className="ops-form-error" role="status">{deleteState.results.some(result => result.reason === "still-valid") ? copy.deleteStillValid : copy.deleteUnverified}</p> : null}
      {deleteOpen ? <OpsConfirmDialog title={copy.cancelVerifiedTitle} pending={deleting} confirmLabel={copy.deletePermanently} cancelLabel={copy.keepCancelled} confirmTone="danger" onClose={() => setDeleteOpen(false)} onConfirm={() => (document.getElementById("uetds-delete-form") as HTMLFormElement | null)?.requestSubmit()}>
        <p>{copy.cancelDeletePrompt}</p>
      </OpsConfirmDialog> : null}
      <form id="uetds-delete-form" action={deleteAction} hidden>
        <input type="hidden" name="actor" value={actor} /><input type="hidden" name="locale" value={locale} /><input type="hidden" name="ids" value={notification.id} />
        <input type="hidden" name="returnToList" value="1" />
      </form>
      {cancelOpen ? (
        <OpsConfirmDialog
          title={copy.cancelTrip}
          pending={pending}
          cancelLabel={copy.confirmNo}
          confirmLabel={copy.cancelTripYes}
          confirmTone="danger"
          onConfirm={() => {
            const form = document.getElementById("uetds-cancel-form") as HTMLFormElement | null;
            form?.requestSubmit();
          }}
          onClose={() => setCancelOpen(false)}
        >
          <p>{copy.cancelTripConfirm}</p>
        </OpsConfirmDialog>
      ) : null}

      {editHref && !cancelled ? (
        <UetdsEditMethodModal
          open={editMethodOpen}
          showAiEdit={showAiEdit}
          copy={copy}
          formHref={editHref}
          aiEditHref={aiEditHref}
          edevletUrl={edevletLink.url}
          seferReferansNo={seferRef}
          onClose={() => setEditMethodOpen(false)}
        />
      ) : null}

      <form id="uetds-cancel-form" action={action} hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="actor" value={actor} />
        <input type="hidden" name="id" value={notification.id} />
      </form>
    </section>
  );
}
