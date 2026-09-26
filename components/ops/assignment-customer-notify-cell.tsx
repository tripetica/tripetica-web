"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingPopover } from "@/components/partner/floating-popover";
import { useReservationAction } from "@/components/ops/use-reservation-action";
import { type Locale } from "@/lib/i18n/config";
import {
  opsSendAssignmentCustomerNotificationAction,
  type OpsAssignmentNotifyFormState,
} from "@/lib/ops/assignment-customer-notification-actions";
import {
  assignmentNotifyDefaultIncludeDriver,
  assignmentNotifyUiState,
  buildAssignmentNotifyOutgoing,
  isAssignmentNotifyNoChange,
  scopedAssignmentCustomerNotification,
  type AssignmentCustomerNotificationSent,
} from "@/lib/ops/assignment-customer-notification-view";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  type JobDriverAssignmentView,
  type JobVehicleAssignmentView,
} from "@/lib/partner/job-assignment-view";

function notifyErrorText(
  error: OpsAssignmentNotifyFormState["error"],
  copy: OpsCopy,
) {
  if (!error) {
    return null;
  }
  if (error === "forbidden") {
    return copy.assignmentForbidden;
  }
  if (error === "no-change") {
    return copy.passengerNotifyNoChange;
  }
  if (error === "no-vehicle") {
    return copy.passengerNotifyNeedVehicle;
  }
  if (error === "no-driver") {
    return copy.passengerNotifyNeedDriver;
  }
  if (error === "missing-email") {
    return copy.passengerNotifyMissingEmail;
  }
  if (error === "locked") {
    return copy.passengerNotifyLocked;
  }
  return copy.passengerNotifyFailed;
}

function triggerLabel(
  kind: ReturnType<typeof assignmentNotifyUiState>["kind"],
  copy: OpsCopy,
) {
  if (kind === "resend") {
    return copy.passengerNotifyResend;
  }
  if (kind === "sent") {
    return copy.passengerNotifySent;
  }
  if (kind === "need-vehicle") {
    return copy.passengerNotifyNeedVehicle;
  }
  if (kind === "need-email") {
    return copy.passengerNotifyNeedEmail;
  }
  if (kind === "locked") {
    return copy.passengerNotifyLocked;
  }
  if (kind === "forbidden") {
    return copy.passengerNotifySend;
  }
  return copy.passengerNotifySend;
}

const INITIAL_NOTIFY_STATE: OpsAssignmentNotifyFormState = {
  error: null,
  ok: false,
  reservationId: "",
};

export function OpsAssignmentCustomerNotifyCell({
  locale,
  copy,
  reservationId,
  customerEmail,
  locked,
  canAssign,
  driver,
  vehicle,
  lastSent,
  assignmentUpdatedAt,
}: {
  locale: Locale;
  copy: OpsCopy;
  reservationId: string;
  customerEmail: string | null;
  locked: boolean;
  canAssign: boolean;
  driver: JobDriverAssignmentView;
  vehicle: JobVehicleAssignmentView;
  lastSent: AssignmentCustomerNotificationSent | null;
  assignmentUpdatedAt: string | null;
}) {
  const router = useRouter();
  const cellRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [includeDriver, setIncludeDriver] = useState(() =>
    assignmentNotifyDefaultIncludeDriver(driver),
  );
  const [state, action, pending] = useReservationAction(
    opsSendAssignmentCustomerNotificationAction,
    INITIAL_NOTIFY_STATE,
    reservationId,
  );
  const scopedLastSent = scopedAssignmentCustomerNotification(lastSent, reservationId);
  const ui = assignmentNotifyUiState({
    vehicle,
    driver,
    lastSent: scopedLastSent,
    assignmentUpdatedAt,
    customerEmail,
    locked,
    canAssign,
  });

  useEffect(() => {
    setIncludeDriver(assignmentNotifyDefaultIncludeDriver(driver));
    setOpen(false);
  }, [reservationId, lastSent?.id, vehicle.selection, driver.selection, driver.kind, driver.fullName, driver.phone]);

  useEffect(() => {
    if (state.ok && state.reservationId === reservationId) {
      setOpen(false);
      router.refresh();
    }
  }, [reservationId, router, state.ok, state.reservationId]);

  const error = notifyErrorText(state.error, copy);
  const selectedOutgoing = buildAssignmentNotifyOutgoing({
    vehicle,
    driver,
    scope: includeDriver && ui.driverReady ? "vehicle_and_driver" : "vehicle_only",
  });
  const selectionNoChange =
    !("error" in selectedOutgoing) &&
    isAssignmentNotifyNoChange(scopedLastSent, selectedOutgoing);
  const canSubmit =
    ui.vehicleReady &&
    (!includeDriver || ui.driverReady) &&
    !pending &&
    !selectionNoChange;

  function submit() {
    if (!canSubmit) {
      return;
    }
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", reservationId);
    if (includeDriver) {
      fd.set("includeDriver", "1");
    }
    action(fd);
  }

  return (
    <div
      ref={cellRef}
      className={`ops-passenger-notify-cell partner-job-assign-cell${pending ? " is-busy" : ""}${ui.canOpen ? "" : " is-locked"}`}
      onClick={(event) => event.stopPropagation()}
    >
      {ui.canOpen ? (
        <>
          <button
            type="button"
            className={`partner-job-assign-trigger${ui.kind === "resend" ? " is-changed" : ""}`}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="partner-job-assign-trigger-label">
              {triggerLabel(ui.kind, copy)}
            </span>
          </button>
          <FloatingPopover
            open={open}
            anchorRef={cellRef}
            onDismiss={() => {
              if (!pending) {
                setOpen(false);
              }
            }}
            className="partner-job-assign-layer partner-job-assign-picker ops-passenger-notify-layer"
            minWidth={260}
            maxWidth={320}
          >
            <form
              className="ops-passenger-notify-form"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <p className="ops-passenger-notify-title">{copy.passengerNotifyTitle}</p>
              <label className="ops-passenger-notify-option">
                <input type="checkbox" checked readOnly disabled />
                <span>{copy.passengerNotifyVehicle}</span>
              </label>
              <label
                className={`ops-passenger-notify-option${ui.driverReady ? "" : " is-disabled"}`}
              >
                <input
                  type="checkbox"
                  checked={includeDriver && ui.driverReady}
                  disabled={!ui.driverReady || pending}
                  onChange={(event) => setIncludeDriver(event.target.checked)}
                />
                <span>
                  {copy.passengerNotifyDriver}
                  {ui.driverReady ? "" : ` · ${copy.passengerNotifyNeedDriver}`}
                </span>
              </label>
              {error ? <p className="ops-passenger-notify-error">{error}</p> : null}
              {selectionNoChange && !error ? (
                <p className="ops-passenger-notify-error">{copy.passengerNotifyNoChange}</p>
              ) : null}
              <button
                type="submit"
                className="ops-btn-primary ops-passenger-notify-submit"
                disabled={!canSubmit}
              >
                {pending ? copy.passengerNotifySending : copy.passengerNotifySubmit}
              </button>
            </form>
          </FloatingPopover>
        </>
      ) : (
        <span className="ops-passenger-notify-idle" title={triggerLabel(ui.kind, copy)}>
          {triggerLabel(ui.kind, copy)}
        </span>
      )}
    </div>
  );
}
