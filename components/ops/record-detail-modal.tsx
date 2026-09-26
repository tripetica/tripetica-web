"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  deleteReservationRecordAction,
  getProcessRecordDetailAction,
  getReservationRecordDetailAction,
  opsStartReservationEditAction,
  requestReservationRefundAction,
  saveProcessRecordAction,
  saveReservationRecordAction,
  setReservationStatusAction,
} from "@/lib/ops/actions";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { opsReservationPdfHref } from "@/lib/ops/ops-pdf-query";
import { type OpsCopy } from "@/lib/ops/copy";
import { type OpsRecordEditInput } from "@/lib/ops/record-edit";
import { opsDetailToolbarMode } from "@/lib/ops/record-edit-form";
import {
  isReservationCancelled,
  isReservationOpsFinalStatus,
  type OpsCancelDialogKind,
  type OpsRecordDetail,
  type OpsRefundDialogKind,
} from "@/lib/ops/record-detail";
import { RecordDetail } from "@/components/ops/record-detail";
import { RecordDetailEdit } from "@/components/ops/record-detail-edit";

type StatusConfirmKind = "cancel" | "activate";
type RefundDialogState = OpsRefundDialogKind | "ack";

function cancelDialogCopy(copy: OpsCopy, kind: OpsCancelDialogKind | null) {
  if (kind === "bosphorus-outside") {
    return {
      title: copy.cancelReservationOutsideTitle,
      body: copy.cancelReservationOutsideBody,
      yes: copy.cancelReservationOutsideYes,
    };
  }
  if (kind === "late-window") {
    return {
      title: copy.cancelReservationLateTitle,
      body: copy.cancelReservationLateBody,
      yes: copy.cancelReservationLateYes,
    };
  }
  if (kind === "bosphorus-within") {
    return {
      title: copy.cancelReservationTitle,
      body: copy.cancelReservationWithinBody,
      yes: copy.cancelReservationYes,
    };
  }
  return {
    title: copy.cancelReservationTitle,
    body: copy.cancelReservationBody,
    yes: copy.cancelReservationYes,
  };
}

function refundBlockedCopy(copy: OpsCopy, kind: OpsRefundDialogKind | null) {
  if (kind === "blocked-not-cancelled") {
    return {
      title: copy.refundNotCancelledTitle,
      body: copy.refundNotCancelledBody,
      mode: "ack" as const,
    };
  }
  if (kind === "blocked-cash") {
    return {
      title: copy.refundCashTitle,
      body: copy.refundCashBody,
      mode: "ack" as const,
    };
  }
  if (kind === "blocked-already") {
    return {
      title: copy.refundAlreadyTitle,
      body: copy.refundAlreadyBody,
      mode: "ack" as const,
    };
  }
  if (kind === "blocked-not-paid") {
    return {
      title: copy.refundNotPaidTitle,
      body: copy.refundNotPaidBody,
      mode: "ack" as const,
    };
  }
  if (kind === "confirm-override") {
    return {
      title: copy.refundOverrideTitle,
      body: copy.refundOverrideBody,
      mode: "confirm-override" as const,
    };
  }
  return {
    title: copy.refundConfirmTitle,
    body: copy.refundConfirmBody,
    mode: "confirm-normal" as const,
  };
}

type RecordDetailModalProps = {
  locale: Locale;
  copy: OpsCopy;
  kind: "process" | "reservation";
  id: string | null;
  onClose: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
};

function OpsDetailPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }
  const shell = document.querySelector(".ops-shell");
  const target = shell instanceof HTMLElement ? shell : document.body;
  return createPortal(children, target);
}

export function RecordDetailModal({
  locale,
  copy,
  kind,
  id,
  onClose,
  onDeleted,
  onUpdated,
}: RecordDetailModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [refundPending, startRefund] = useTransition();
  const [editStarting, startEdit] = useTransition();
  const [detail, setDetail] = useState<OpsRecordDetail | null>(null);
  const [edit, setEdit] = useState<OpsRecordEditInput | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmKind | null>(null);
  const [editLateConfirm, setEditLateConfirm] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refundDialog, setRefundDialog] = useState<RefundDialogState | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<OpsRecordEditInput | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [pricingVisible, setPricingVisible] = useState(false);
  const [toolbarScrolled, setToolbarScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setDetail(null);
      setEdit(null);
      setEditing(false);
      setDeleteOpen(false);
      setDeleteError(null);
      setStatusConfirm(null);
      setEditLateConfirm(false);
      setStatusError(null);
      setRefundDialog(null);
      setRefundError(null);
      setError(null);
      setSaveError(null);
      setEditDraft(null);
      setEditDirty(false);
      setContactsVisible(false);
      setPricingVisible(false);
      setToolbarScrolled(false);
      if (!id) {
        setCanEdit(false);
        setCanDelete(false);
      }
    });
    if (!id) {
      return;
    }
    startTransition(async () => {
      const result =
        kind === "process"
          ? await getProcessRecordDetailAction(id, locale)
          : await getReservationRecordDetailAction(id, locale);
      if (result.error || !result.detail) {
        setError(copy.detailError);
        return;
      }
      setDetail(result.detail);
      setEdit(result.edit);
      setCanEdit(result.canEdit);
      setCanDelete(result.canDelete);
    });
  }, [copy.detailError, id, kind, locale]);

  useEffect(() => {
    if (!id || kind !== "reservation") {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || editing || saving) {
        return;
      }
      void getReservationRecordDetailAction(id, locale).then((result) => {
        if (result.detail) {
          setDetail(result.detail);
        }
      });
    }, 6000);
    return () => window.clearInterval(timer);
  }, [editing, id, kind, locale, saving]);

  useEffect(() => {
    if (!id) {
      return;
    }
    document.body.classList.add("ops-detail-open");
    const shell = document.querySelector(".ops-shell");
    if (shell instanceof HTMLElement) {
      shell.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    return () => {
      document.body.classList.remove("ops-detail-open");
    };
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || saving || deleting || statusPending || refundPending) {
        return;
      }
      if (deleteOpen) {
        event.preventDefault();
        setDeleteOpen(false);
        setDeleteError(null);
        return;
      }
      if (statusConfirm) {
        event.preventDefault();
        setStatusConfirm(null);
        setStatusError(null);
        return;
      }
      if (refundDialog) {
        event.preventDefault();
        setRefundDialog(null);
        setRefundError(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    deleteOpen,
    deleting,
    id,
    onClose,
    refundDialog,
    refundPending,
    saving,
    statusConfirm,
    statusPending,
  ]);

  useEffect(() => {
    if (!id) {
      return;
    }
    const shell = document.querySelector(".ops-shell");
    if (!(shell instanceof HTMLElement)) {
      return;
    }
    const onShellScroll = () => {
      if (!window.matchMedia("(max-width: 720px)").matches) {
        return;
      }
      setToolbarScrolled(shell.scrollTop > 8);
    };
    shell.addEventListener("scroll", onShellScroll, { passive: true });
    return () => shell.removeEventListener("scroll", onShellScroll);
  }, [id]);

  function handleSave(value?: OpsRecordEditInput) {
    const payload = value ?? editDraft ?? edit;
    if (!payload) {
      return;
    }
    setSaveError(null);
    startSave(async () => {
      const result =
        kind === "process"
          ? await saveProcessRecordAction(payload, locale)
          : await saveReservationRecordAction(payload, locale);
      if (result.error) {
        setSaveError(copy.editSaveError);
        setEditDirty(true);
        return;
      }
      setDetail(result.detail);
      setEdit(result.edit);
      setEditDraft(result.edit);
      setEditDirty(false);
      setEditing(false);
      onUpdated?.();
    });
  }

  function startOpsBookingEdit() {
    if (!id || kind !== "reservation") {
      return;
    }
    setSaveError(null);
    setEditLateConfirm(false);
    startEdit(async () => {
      const result = await opsStartReservationEditAction(id, locale);
      if (!result.ok) {
        setSaveError(copy.editSaveError);
        return;
      }
      onClose();
      router.push(localizedPath(locale, "/"));
      router.refresh();
    });
  }

  function requestOpsBookingEdit() {
    if (!id || kind !== "reservation") {
      return;
    }
    if (detail?.actionContext?.mutationWindowOpen === false) {
      setSaveError(null);
      setEditLateConfirm(true);
      return;
    }
    startOpsBookingEdit();
  }
  function handleConfirmDelete() {
    if (!id || kind !== "reservation") {
      return;
    }
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteReservationRecordAction(id, locale);
      if (result.error) {
        setDeleteError(copy.deleteReservationError);
        return;
      }
      setDeleteOpen(false);
      onClose();
      onDeleted?.();
    });
  }

  function handleConfirmStatus() {
    if (!id || kind !== "reservation" || !statusConfirm) {
      return;
    }
    setStatusError(null);
    startStatus(async () => {
      const nextStatus = statusConfirm === "cancel" ? "cancelled" : "confirmed";
      const result = await setReservationStatusAction(id, nextStatus, locale);
      if (result.error) {
        setStatusError(
          statusConfirm === "cancel"
            ? copy.cancelReservationError
            : copy.activateReservationError,
        );
        return;
      }
      if (result.detail) {
        setDetail(result.detail);
      }
      if (result.edit) {
        setEdit(result.edit);
      }
      setStatusConfirm(null);
      onUpdated?.();
    });
  }

  function openRefundDialog() {
    const ctx = detail?.actionContext;
    if (!ctx || ctx.refundButton === "hidden") {
      return;
    }
    setRefundError(null);
    if (ctx.refundButton === "disabled-cash") {
      setRefundDialog("blocked-cash");
      return;
    }
    setRefundDialog(ctx.refundDialog);
  }

  function handleConfirmRefund() {
    if (!id || kind !== "reservation" || !refundDialog) {
      return;
    }
    if (
      refundDialog !== "confirm-normal" &&
      refundDialog !== "confirm-override"
    ) {
      setRefundDialog(null);
      return;
    }
    setRefundError(null);
    startRefund(async () => {
      const result = await requestReservationRefundAction(id, locale, {
        confirmAdminOverride: refundDialog === "confirm-override",
      });
      if (result.detail) {
        setDetail(result.detail);
      }
      if (result.edit) {
        setEdit(result.edit);
      }
      if (result.error) {
        if (result.reason === "not-cancelled") {
          setRefundDialog("blocked-not-cancelled");
          return;
        }
        if (result.reason === "cash") {
          setRefundDialog("blocked-cash");
          return;
        }
        if (result.reason === "already-refunded") {
          setRefundDialog("blocked-already");
          return;
        }
        if (
          result.reason === "not-paid" ||
          result.reason === "missing-order" ||
          result.reason === "missing-amount"
        ) {
          setRefundDialog("blocked-not-paid");
          return;
        }
        if (result.reason === "override-required") {
          setRefundDialog("confirm-override");
          return;
        }
        setRefundError(copy.refundError);
        return;
      }
      setRefundDialog(null);
      onUpdated?.();
    });
  }

  if (!id) {
    return null;
  }

  const showActions = Boolean(detail && !editing);
  const toolbarMode = opsDetailToolbarMode({ editing, dirty: editDirty });
  const isReservation = kind === "reservation";
  const cancelled = isReservationCancelled(detail?.status);
  const opsFinal = isReservationOpsFinalStatus(detail?.status);
  const actionContext = detail?.actionContext ?? null;
  const cancelCopy = cancelDialogCopy(copy, actionContext?.cancelDialog ?? "generic");
  const refundCopy = refundBlockedCopy(
    copy,
    refundDialog === "ack" ? null : refundDialog,
  );
  const refundAmountToken = actionContext?.paymentAmountDisplay ?? "—";
  const refundBody = refundCopy.body.replaceAll("{amount}", refundAmountToken);
  const busy = deleting || statusPending || refundPending;
  const opsPdfHref =
    detail && isReservation
      ? opsReservationPdfHref(detail.pdfHref, {
          includeContact: contactsVisible,
          includePricing: pricingVisible,
        })
      : detail?.pdfHref ?? "#";

  const pdfActions =
    showActions && isReservation && detail ? (
      <div className="ops-detail-action-row is-pdf">
        <a className="ops-btn-secondary" href={opsPdfHref}>
          {copy.opsPdf}
        </a>
        {detail.voucherPdfHref ? (
          <a className="ops-btn-secondary" href={detail.voucherPdfHref}>
            {copy.voucherPdf}
          </a>
        ) : null}
      </div>
    ) : null;

  const manageActions =
    showActions && (canEdit || (isReservation && canDelete)) ? (
      <div className="ops-detail-action-row is-manage">
        {canEdit ? (
          <button
            type="button"
            className="ops-btn-secondary"
            disabled={editStarting}
            onClick={() => {
              if (isReservation) {
                requestOpsBookingEdit();
                return;
              }
              setEditing(true);
            }}
          >
            {copy.edit}
          </button>
        ) : null}
        {isReservation && canEdit && !opsFinal ? (
          cancelled ? (
            <button
              type="button"
              className="ops-btn-activate"
              onClick={() => {
                setStatusError(null);
                setStatusConfirm("activate");
              }}
            >
              {copy.activateReservation}
            </button>
          ) : (
            <button
              type="button"
              className="ops-btn-cancel-soft"
              onClick={() => {
                setStatusError(null);
                setStatusConfirm("cancel");
              }}
            >
              {copy.cancelReservation}
            </button>
          )
        ) : null}
        {isReservation && canDelete ? (
          <button
            type="button"
            className="ops-btn-danger"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            {copy.delete}
          </button>
        ) : null}
      </div>
    ) : null;

  const processActions = !isReservation && detail ? (
    toolbarMode === "detail" ? (
      <div className="ops-detail-action-row is-process">
        <a className="ops-btn-secondary" href={opsPdfHref}>
          {copy.downloadPdf}
        </a>
        {canEdit ? (
          <button
            type="button"
            className="ops-btn-secondary"
            onClick={() => {
              setSaveError(null);
              setEditDraft(edit);
              setEditDirty(false);
              setEditing(true);
            }}
          >
            {copy.edit}
          </button>
        ) : null}
      </div>
    ) : toolbarMode === "edit-dirty" ? (
      <button
        type="button"
        className="ops-btn-primary"
        disabled={saving}
        onClick={() => handleSave()}
      >
        {saving ? copy.saving : copy.saveChanges}
      </button>
    ) : null
  ) : null;

  return (
    <OpsDetailPortal>
      <div
        className="ops-detail-backdrop"
        role="presentation"
        onClick={() => {
          if (!saving && !busy && !deleteOpen && !statusConfirm && !refundDialog) {
            onClose();
          }
        }}
      >
        <div
          className="ops-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-record-detail-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={`ops-detail-toolbar${toolbarScrolled ? " is-scrolled" : ""}${
              isReservation ? " is-reservation" : " is-process"
            }`}
          >
            <div className="ops-detail-toolbar-start">
              {isReservation ? (
                <>
                  {pdfActions}
                  {manageActions}
                </>
              ) : (
                processActions
              )}
            </div>
            <button
              type="button"
              className="ops-btn-ghost ops-detail-close"
              onClick={onClose}
              disabled={busy}
              aria-label={copy.close}
            >
              <span className="ops-detail-close-label">{copy.close}</span>
              <span className="ops-detail-close-icon" aria-hidden="true">
                ×
              </span>
            </button>
          </div>
          <div
            className="ops-detail-scroll"
            ref={scrollRef}
            onScroll={(event) => {
              if (window.matchMedia("(max-width: 720px)").matches) {
                return;
              }
              setToolbarScrolled(event.currentTarget.scrollTop > 4);
            }}
          >
            {pending && !detail ? <p className="ops-empty">{copy.loadingDetail}</p> : null}
            {error ? <p className="ops-form-error">{error}</p> : null}
            {detail && editing && edit ? (
              <div id="ops-record-detail-title">
                <header className="ops-detail-hero">
                  <p className="ops-detail-brand">Tripetica</p>
                  <h2>{detail.title}</h2>
                  {detail.code ? <p className="ops-detail-code">{detail.code}</p> : null}
                </header>
                <RecordDetailEdit
                  locale={locale}
                  copy={copy}
                  initial={edit}
                  saving={saving}
                  error={saveError}
                  onCancel={() => {
                    setSaveError(null);
                    setEditDraft(edit);
                    setEditDirty(false);
                    setEditing(false);
                  }}
                  onFormChange={(value, dirty) => {
                    setEditDraft(value);
                    setEditDirty(dirty);
                  }}
                />
              </div>
            ) : null}
            {detail && !editing ? (
              <div id="ops-record-detail-title">
                <RecordDetail
                  locale={locale}
                  copy={copy}
                  detail={detail}
                  showFooterPdf={false}
                  contactsVisible={isReservation ? contactsVisible : true}
                  onToggleContacts={
                    isReservation
                      ? () => setContactsVisible((value) => !value)
                      : undefined
                  }
                  pricingVisible={isReservation ? pricingVisible : true}
                  onTogglePricing={
                    isReservation
                      ? () => setPricingVisible((value) => !value)
                      : undefined
                  }
                  onPaymentHistoryUpdated={(next) => {
                    setDetail(next);
                    onUpdated?.();
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
        {deleteOpen ? (
          <div
            className="ops-detail-confirm-backdrop"
            role="presentation"
            onClick={() => {
              if (!deleting) {
                setDeleteOpen(false);
                setDeleteError(null);
              }
            }}
          >
            <div
              className="ops-modal ops-detail-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ops-reservation-delete-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="ops-reservation-delete-title">{copy.deleteReservationConfirm}</h2>
              {deleteError ? <p className="ops-form-error">{deleteError}</p> : null}
              <div className="ops-modal-actions">
                <button
                  type="button"
                  className="ops-btn-secondary"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                >
                  {copy.deleteReservationNo}
                </button>
                <button
                  type="button"
                  className="ops-btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? copy.deleting : copy.deleteReservationYes}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {statusConfirm ? (
          <div
            className="ops-detail-confirm-backdrop"
            role="presentation"
            onClick={() => {
              if (!statusPending) {
                setStatusConfirm(null);
                setStatusError(null);
              }
            }}
          >
            <div
              className="ops-modal ops-detail-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ops-reservation-status-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="ops-reservation-status-title">
                {statusConfirm === "cancel"
                  ? cancelCopy.title
                  : copy.activateReservationTitle}
              </h2>
              <p className="ops-detail-confirm-body" style={{ whiteSpace: "pre-line" }}>
                {statusConfirm === "cancel"
                  ? cancelCopy.body
                  : copy.activateReservationBody}
              </p>
              {detail?.code ? (
                <p className="ops-detail-confirm-code">{detail.code}</p>
              ) : null}
              {statusError ? <p className="ops-form-error">{statusError}</p> : null}
              <div className="ops-modal-actions">
                <button
                  type="button"
                  className="ops-btn-secondary"
                  onClick={() => {
                    setStatusConfirm(null);
                    setStatusError(null);
                  }}
                  disabled={statusPending}
                >
                  {statusConfirm === "cancel"
                    ? copy.cancelReservationNo
                    : copy.activateReservationNo}
                </button>
                <button
                  type="button"
                  className={
                    statusConfirm === "cancel" ? "ops-btn-cancel-soft" : "ops-btn-activate"
                  }
                  onClick={handleConfirmStatus}
                  disabled={statusPending}
                >
                  {statusPending
                    ? statusConfirm === "cancel"
                      ? copy.cancelling
                      : copy.activating
                    : statusConfirm === "cancel"
                      ? cancelCopy.yes
                      : copy.activateReservationYes}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {editLateConfirm ? (
          <div
            className="ops-detail-confirm-backdrop"
            role="presentation"
            onClick={() => {
              if (!editStarting) {
                setEditLateConfirm(false);
              }
            }}
          >
            <div
              className="ops-modal ops-detail-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ops-reservation-edit-late-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="ops-reservation-edit-late-title">
                {copy.editReservationLateTitle}
              </h2>
              <p className="ops-detail-confirm-body" style={{ whiteSpace: "pre-line" }}>
                {copy.editReservationLateBody}
              </p>
              {detail?.code ? (
                <p className="ops-detail-confirm-code">{detail.code}</p>
              ) : null}
              {saveError ? <p className="ops-form-error">{saveError}</p> : null}
              <div className="ops-modal-actions">
                <button
                  type="button"
                  className="ops-btn-secondary"
                  onClick={() => setEditLateConfirm(false)}
                  disabled={editStarting}
                >
                  {copy.editReservationLateNo}
                </button>
                <button
                  type="button"
                  className="ops-btn-secondary"
                  onClick={startOpsBookingEdit}
                  disabled={editStarting}
                >
                  {copy.editReservationLateYes}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {refundDialog ? (
          <div
            className="ops-detail-confirm-backdrop"
            role="presentation"
            onClick={() => {
              if (!refundPending) {
                setRefundDialog(null);
                setRefundError(null);
              }
            }}
          >
            <div
              className="ops-modal ops-detail-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ops-reservation-refund-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="ops-reservation-refund-title">{refundCopy.title}</h2>
              <p className="ops-detail-confirm-body" style={{ whiteSpace: "pre-line" }}>
                {refundBody}
              </p>
              {detail?.code ? (
                <p className="ops-detail-confirm-code">{detail.code}</p>
              ) : null}
              {refundError ? <p className="ops-form-error">{refundError}</p> : null}
              <div className="ops-modal-actions">
                {refundCopy.mode === "ack" ? (
                  <button
                    type="button"
                    className="ops-btn-secondary"
                    onClick={() => {
                      setRefundDialog(null);
                      setRefundError(null);
                    }}
                    disabled={refundPending}
                  >
                    {copy.refundOk}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ops-btn-secondary"
                      onClick={() => {
                        setRefundDialog(null);
                        setRefundError(null);
                      }}
                      disabled={refundPending}
                    >
                      {copy.refundConfirmNo}
                    </button>
                    <button
                      type="button"
                      className="ops-btn-activate"
                      onClick={handleConfirmRefund}
                      disabled={refundPending}
                    >
                      {refundPending
                        ? copy.refunding
                        : refundCopy.mode === "confirm-override"
                          ? copy.refundOverrideYes
                          : copy.refundConfirmYes}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </OpsDetailPortal>
  );
}
