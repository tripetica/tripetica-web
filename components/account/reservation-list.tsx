"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  accountReservationDetailAction,
  accountReservationSetStatusAction,
  accountStartReservationEditAction,
} from "@/lib/account/actions";
import { accountCopy } from "@/lib/account/copy";
import {
  accountPaymentMethodLabel,
  accountPaymentStatusLabel,
  accountReservationStatusBadgeClass,
  accountReservationStatusLabel,
  isAccountReservationCancelled,
  isOnlineAccountPayment,
} from "@/lib/account/reservation-labels";
import {
  type AccountReservationDetail,
  type AccountReservationListItem,
} from "@/lib/account/reservations";
import { formatOpsDateTime } from "@/lib/ops/format";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { useRouter } from "next/navigation";

function DetailRow({
  label,
  value,
  hideEmpty = true,
}: {
  label: string;
  value: string;
  hideEmpty?: boolean;
}) {
  if (hideEmpty && !value.trim()) {
    return null;
  }
  return (
    <div className="account-detail-row">
      <dt>{label}</dt>
      <dd>{value.trim() || "—"}</dd>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4.5 4.5l9 9M13.5 4.5l-9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReservationDetailModal({
  locale,
  detail,
  notice,
  statusMessage,
  statusBusy,
  editBusy,
  onClose,
  onEdit,
  onCancel,
  onReactivate,
}: {
  locale: Locale;
  detail: AccountReservationDetail;
  notice: string | null;
  statusMessage: string | null;
  statusBusy: boolean;
  editBusy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onReactivate: () => void;
}) {
  const copy = accountCopy[locale];
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cancelled = isAccountReservationCancelled(detail.status);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [onClose]);

  const pickupLine = [detail.pickupName, detail.pickupAddress]
    .filter(Boolean)
    .join(" — ");
  const dropoffLine = [detail.dropoffName, detail.dropoffAddress]
    .filter(Boolean)
    .join(" — ");
  const statusLabel = accountReservationStatusLabel(detail.status, copy);
  const flightLabel = detail.pickupIsAirport
    ? detail.flightCode?.trim() || copy.flightNotProvided
    : "";
  const meetLabel = detail.pickupIsAirport
    ? detail.meetAndGreet
      ? copy.yes
      : copy.no
    : "";
  const voucherHref = localizedPath(
    locale,
    `/account/reservations/${detail.id}/voucher-pdf`,
  );
  const online = isOnlineAccountPayment(detail.paymentMethod);
  const paymentMethodText =
    accountPaymentMethodLabel(detail.paymentMethod, copy) ||
    detail.paymentMethodLabel;
  const paymentStatusText = accountPaymentStatusLabel(detail.paymentStatus, copy);
  const refundStatusText = detail.finance?.refundStatus
    ? detail.finance.refundStatus === "completed"
      ? copy.financeRefundStatusCompleted
      : detail.finance.refundStatus === "failed"
        ? copy.financeRefundStatusFailed
        : detail.finance.refundStatus === "partial"
          ? copy.financeRefundStatusPartial
          : copy.financeRefundStatusSubmitted
    : null;

  const statusHint = cancelled
    ? detail.reactivateBlockedReason === "within_six_hours"
      ? copy.reactivateBlockedSixHours
      : detail.reactivateBlockedReason === "bosphorus_after_cutoff"
        ? copy.reactivateBlockedBosphorusCutoff
        : null
    : detail.cancelBlockedReason === "within_six_hours"
      ? copy.cancelBlockedSixHours
      : null;

  return createPortal(
    <div className="account-detail-modal-root" role="presentation">
      <button
        type="button"
        className="account-detail-modal-backdrop"
        aria-label={copy.closeModal}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="account-detail-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={copy.detailTitle}
      >
        <div className="account-detail-modal-toolbar">
          <div className="account-detail-modal-actions">
            <a
              className="account-btn-primary account-detail-action"
              href={voucherHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy.downloadVoucherPdf}
            </a>
            <button
              type="button"
              className="account-btn-ghost account-detail-action"
              disabled={editBusy || cancelled || !detail.canEdit}
              onClick={onEdit}
            >
              {copy.editReservation}
            </button>
            {cancelled ? (
              <button
                type="button"
                className="account-btn-ghost account-detail-action"
                disabled={statusBusy || !detail.canReactivate}
                onClick={onReactivate}
              >
                {copy.activateReservation}
              </button>
            ) : (
              <button
                type="button"
                className="account-btn-ghost account-detail-action is-danger-action"
                disabled={statusBusy || !detail.canCancel}
                onClick={onCancel}
              >
                {copy.cancelReservation}
              </button>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="account-detail-modal-icon-close account-detail-action"
            aria-label={copy.closeModal}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="account-detail-modal-body">
          {notice ? <p className="account-form-info">{notice}</p> : null}
          {statusMessage ? (
            <p className="account-form-error">{statusMessage}</p>
          ) : null}
          {statusHint ? <p className="account-form-muted">{statusHint}</p> : null}

          <dl className="account-detail-grid">
            <DetailRow label={copy.code} value={detail.reservationCode} />
            <div className="account-detail-row">
              <dt>{copy.status}</dt>
              <dd>
                <span className={accountReservationStatusBadgeClass(detail.status)}>
                  {statusLabel}
                </span>
              </dd>
            </div>
            <DetailRow label={copy.service} value={detail.serviceTypeLabel} />
            <DetailRow label={copy.when} value={detail.dateTime} />
            <DetailRow label={copy.pickup} value={pickupLine} />
            <DetailRow label={copy.dropoff} value={dropoffLine} />
            {detail.showVehicleClass ? (
              <DetailRow label={copy.vehicle} value={detail.vehicleLabel} />
            ) : null}
            {detail.packageCoverageValue ? null : (
              <DetailRow label={copy.duration} value={detail.durationValue ?? ""} />
            )}
            {detail.packageCoverageValue ? (
              <div className="account-detail-row account-detail-passengers">
                <dt>{copy.packageInfo}</dt>
                <dd>
                  <strong>{detail.packageCoverageValue}</strong>
                  {detail.packageNotes.length ? (
                    <ul className="account-detail-passenger-list">
                      {detail.packageNotes.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {detail.participantBreakdownHeading &&
            detail.participantBreakdown?.length ? (
              <div className="account-detail-row account-detail-passengers">
                <dt>{detail.participantBreakdownHeading}</dt>
                <dd>
                  <ul className="account-detail-passenger-list">
                    {detail.participantBreakdown.map((line, index) => (
                      <li key={`${index}-${line}`}>{line}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            {detail.includedSectionTitle && detail.includedItems?.length ? (
              <div className="account-detail-row account-detail-passengers">
                <dt>{detail.includedSectionTitle}</dt>
                <dd>
                  <ul className="account-detail-passenger-list">
                    {detail.includedItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            {detail.serviceInfoSectionTitle &&
            detail.serviceInfoGroups?.length ? (
              <div className="account-detail-row account-detail-passengers">
                <dt>{detail.serviceInfoSectionTitle}</dt>
                <dd className="account-detail-info-groups">
                  {detail.serviceInfoGroups.map((group) => (
                    <section key={group.title}>
                      <strong>{group.title}</strong>
                      <p>{group.body}</p>
                    </section>
                  ))}
                </dd>
              </div>
            ) : null}

            <div
              className={`account-detail-counts${detail.isBosphorusDinner ? " is-passenger-only" : ""}`}
              role="group"
            >
              <div className="account-detail-count">
                <dt>{copy.passengerCount}</dt>
                <dd>{detail.passengerCount}</dd>
              </div>
              {detail.isBosphorusDinner ? null : (
                <>
                  <div className="account-detail-count">
                    <dt>{copy.luggageCount}</dt>
                    <dd>{detail.luggageCount}</dd>
                  </div>
                  <div className="account-detail-count">
                    <dt>{copy.babySeatCount}</dt>
                    <dd>{detail.babySeatCount}</dd>
                  </div>
                </>
              )}
            </div>

            {detail.passengerNames.length > 0 ? (
              <div className="account-detail-row account-detail-passengers">
                <dt>{copy.passengers}</dt>
                <dd>
                  <ul className="account-detail-passenger-list">
                    {detail.passengerNames.map((name, index) => (
                      <li key={`${index}-${name}`}>{name}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            {detail.pickupIsAirport ? (
              <DetailRow
                label={copy.flightCode}
                value={flightLabel}
                hideEmpty={false}
              />
            ) : null}
            {detail.pickupIsAirport ? (
              <DetailRow label={copy.meetAndGreet} value={meetLabel} />
            ) : null}
            <DetailRow label={copy.selectedPrice} value={detail.totalLabel} />
            {!online && detail.otherCurrencyLine ? (
              <div className="account-detail-row account-detail-alt-currencies">
                <dt>{copy.alternatePaymentHintCustomer}</dt>
                <dd>{detail.otherCurrencyLine}</dd>
              </div>
            ) : null}

            <DetailRow label={copy.paymentMethod} value={paymentMethodText} />
            {online ? (
              <DetailRow
                label={copy.paymentStatus}
                value={paymentStatusText || "—"}
                hideEmpty={false}
              />
            ) : null}
            {refundStatusText ? (
              <DetailRow label={copy.financeRefundStatus} value={refundStatusText} />
            ) : null}

            {detail.finance &&
            (detail.finance.totalPaid > 0 ||
              detail.finance.refunded > 0 ||
              detail.finance.refundRequested > 0) ? (
              <div className="account-detail-payment-group" role="group">
                <div className="account-detail-count">
                  <dt>{copy.financeTotalPaid}</dt>
                  <dd>
                    {detail.finance.totalPaid} {detail.finance.currency ?? ""}
                  </dd>
                </div>
                {detail.finance.refundRequested > 0 ? (
                  <div className="account-detail-count">
                    <dt>{copy.financeRefundRequested}</dt>
                    <dd>
                      {detail.finance.refundRequested}{" "}
                      {detail.finance.currency ?? ""}
                    </dd>
                  </div>
                ) : null}
                {detail.finance.refunded > 0 ? (
                  <div className="account-detail-count">
                    <dt>{copy.financeRefunded}</dt>
                    <dd>
                      {detail.finance.refunded} {detail.finance.currency ?? ""}
                    </dd>
                  </div>
                ) : null}
              </div>
            ) : null}

            <DetailRow label={copy.notes} value={detail.notes ?? ""} />
          </dl>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AccountReservationList({
  locale,
  items: initialItems,
}: {
  locale: Locale;
  items: AccountReservationListItem[];
}) {
  const copy = accountCopy[locale];
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [itemsSource, setItemsSource] = useState(initialItems);
  const [detail, setDetail] = useState<AccountReservationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [statusBusy, setStatusBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (itemsSource !== initialItems) {
    setItemsSource(initialItems);
    setItems(initialItems);
  }

  if (items.length === 0) {
    return <p className="account-empty">{copy.emptyReservations}</p>;
  }

  function syncListStatus(id: string, status: string | null) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }

  function openDetail(id: string) {
    setError(null);
    setNotice(null);
    setStatusMessage(null);
    setLoadingId(id);
    startTransition(async () => {
      const result = await accountReservationDetailAction(id, locale);
      setLoadingId(null);
      if (!result.ok) {
        setError(
          result.error === "unauthenticated"
            ? copy.error_unauthenticated
            : copy.error_not_found,
        );
        return;
      }
      setDetail(result.detail);
      syncListStatus(result.detail.id, result.detail.status);
    });
  }

  function applyStatus(nextStatus: "confirmed" | "cancelled") {
    if (!detail) {
      return;
    }
    setStatusMessage(null);
    setStatusBusy(true);
    startTransition(async () => {
      const result = await accountReservationSetStatusAction(
        detail.id,
        nextStatus,
        locale,
      );
      setStatusBusy(false);
      if (!result.ok) {
        if (result.error === "within_six_hours") {
          setStatusMessage(
            nextStatus === "cancelled"
              ? copy.cancelBlockedSixHours
              : copy.reactivateBlockedSixHours,
          );
          return;
        }
        if (result.error === "bosphorus_after_cutoff") {
          setStatusMessage(copy.reactivateBlockedBosphorusCutoff);
          return;
        }
        if (result.error === "refund_failed") {
          setStatusMessage(copy.cancelRefundFailed);
          return;
        }
        if (result.error === "pending_cancel_failed") {
          setStatusMessage(copy.cancelPendingFailed);
          return;
        }
        setStatusMessage(copy.statusUpdateFailed);
        return;
      }
      setShowCancelConfirm(false);
      setDetail(result.detail);
      syncListStatus(result.detail.id, result.detail.status);
    });
  }

  function requestCancel() {
    if (!detail || !detail.canCancel) {
      if (detail?.cancelBlockedReason === "within_six_hours") {
        setStatusMessage(copy.cancelBlockedSixHours);
      }
      return;
    }
    setStatusMessage(null);
    setShowCancelConfirm(true);
  }

  function requestEdit() {
    if (!detail) {
      return;
    }
    setStatusMessage(null);
    if (!detail.canEdit) {
      setStatusMessage(
        detail.editBlockedReason === "within_six_hours"
          ? copy.editBlockedSixHours
          : copy.editStartFailed,
      );
      return;
    }
    setShowEditInfo(true);
  }

  function confirmEdit() {
    if (!detail || editBusy) {
      return;
    }
    setEditBusy(true);
    setStatusMessage(null);
    startTransition(async () => {
      try {
        const result = await accountStartReservationEditAction(
          detail.id,
          locale,
        );
        if (!result.ok) {
          setShowEditInfo(false);
          if (result.error === "within_six_hours") {
            setStatusMessage(copy.editBlockedSixHours);
            return;
          }
          setStatusMessage(copy.editStartFailed);
          return;
        }
        setShowEditInfo(false);
        router.push(localizedPath(locale, "/"));
        router.refresh();
      } catch {
        setShowEditInfo(false);
        setStatusMessage(copy.editStartFailed);
      } finally {
        setEditBusy(false);
      }
    });
  }

  return (
    <>
      {error ? <p className="account-form-error">{error}</p> : null}
      <ul className="account-reservation-list">
        {items.map((item) => {
          const cancelled = isAccountReservationCancelled(item.status);
          const online = isOnlineAccountPayment(item.paymentMethod);
          const paymentMethodText = accountPaymentMethodLabel(
            item.paymentMethod,
            copy,
          );
          const paymentStatusText = accountPaymentStatusLabel(
            item.paymentStatus,
            copy,
          );
          return (
            <li
              key={item.id}
              className={`account-reservation-card${cancelled ? " is-cancelled" : ""}`}
            >
              <div className="account-reservation-card-top">
                <div className="account-reservation-card-top-start">
                  <strong>
                    {item.reservationCode ?? item.id.slice(0, 8)}
                  </strong>
                  <span
                    className={accountReservationStatusBadgeClass(item.status)}
                  >
                    {accountReservationStatusLabel(item.status, copy) || "—"}
                  </span>
                </div>
                <div className="account-reservation-card-top-end">
                  <span>{formatOpsDateTime(item.pickupAt, locale)}</span>
                  <button
                    type="button"
                    className="account-btn-ghost account-reservation-detail-btn account-detail-action"
                    disabled={pending && loadingId === item.id}
                    onClick={() => openDetail(item.id)}
                  >
                    {copy.detail}
                  </button>
                </div>
              </div>
              <p>
                <span className="account-muted">{copy.service}:</span>{" "}
                {item.serviceTypeLabel || "—"}
              </p>
              <p>
                <span className="account-muted">{copy.pickup}:</span>{" "}
                {item.pickupLabel ?? "—"}
              </p>
              <p>
                <span className="account-muted">{copy.dropoff}:</span>{" "}
                {item.dropoffLabel ?? "—"}
              </p>
              <div className="account-reservation-card-meta">
                <span>
                  {copy.total}: {item.totalPrice ?? "—"} {item.currency ?? ""}
                </span>
                {paymentMethodText ? (
                  <span>
                    {copy.paymentMethod}: {paymentMethodText}
                  </span>
                ) : null}
                {online && paymentStatusText ? (
                  <span>
                    {copy.paymentStatus}: {paymentStatusText}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {detail ? (
        <ReservationDetailModal
          locale={locale}
          detail={detail}
          notice={notice}
          statusMessage={statusMessage}
          statusBusy={statusBusy || pending}
          editBusy={editBusy || pending}
          onClose={() => {
            setDetail(null);
            setNotice(null);
            setStatusMessage(null);
            setShowEditInfo(false);
            setShowCancelConfirm(false);
          }}
          onEdit={requestEdit}
          onCancel={requestCancel}
          onReactivate={() => applyStatus("confirmed")}
        />
      ) : null}
      {showCancelConfirm && detail
        ? createPortal(
            <div className="account-detail-modal-root" role="presentation">
              <button
                type="button"
                className="account-detail-modal-backdrop"
                aria-label={copy.closeModal}
                onClick={() => setShowCancelConfirm(false)}
              />
              <div
                className="account-detail-modal-panel account-edit-info-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-cancel-confirm-title"
              >
                <div className="account-detail-modal-body">
                  <h2
                    id="account-cancel-confirm-title"
                    className="account-edit-info-title"
                  >
                    {copy.cancelConfirmTitle}
                  </h2>
                  <p className="account-cancel-confirm-body">
                    {detail.cancelWillRefund
                      ? copy.cancelConfirmWithRefund
                      : copy.cancelConfirm}
                  </p>
                  <div className="account-edit-info-actions">
                    <button
                      type="button"
                      className="account-btn-ghost"
                      disabled={statusBusy || pending}
                      onClick={() => setShowCancelConfirm(false)}
                    >
                      {copy.cancelConfirmDismiss}
                    </button>
                    <button
                      type="button"
                      className="account-btn-primary account-cancel-confirm-submit"
                      disabled={statusBusy || pending}
                      onClick={() => applyStatus("cancelled")}
                    >
                      {copy.cancelConfirmSubmit}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {showEditInfo && detail
        ? createPortal(
            <div className="account-detail-modal-root" role="presentation">
              <button
                type="button"
                className="account-detail-modal-backdrop"
                aria-label={copy.closeModal}
                onClick={() => setShowEditInfo(false)}
              />
              <div
                className="account-detail-modal-panel account-edit-info-panel"
                role="dialog"
                aria-modal="true"
                aria-label={copy.editInfoTitle}
              >
                <div className="account-detail-modal-body">
                  <h2 className="account-edit-info-title">{copy.editInfoTitle}</h2>
                  <p>{copy.editInfoBody1}</p>
                  <p>{copy.editInfoBody2}</p>
                  <div className="account-edit-info-actions">
                    <button
                      type="button"
                      className="account-btn-ghost"
                      disabled={editBusy || pending}
                      onClick={() => setShowEditInfo(false)}
                    >
                      {copy.editInfoCancel}
                    </button>
                    <button
                      type="button"
                      className="account-btn-primary"
                      disabled={editBusy || pending}
                      onClick={confirmEdit}
                    >
                      {copy.editInfoContinue}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
