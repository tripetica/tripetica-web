"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { setGpsAtsEnabled } from "@/lib/gps/ats-actions";
import { type GpsAtsPanel } from "@/lib/gps/ats-panel-state";
import { type GpsCopy } from "@/lib/gps/copy";
import { gpsClock } from "@/lib/gps/format";

export function GpsAtsPanel({
  copy,
  panel,
  canControl,
}: {
  copy: GpsCopy;
  panel: GpsAtsPanel;
  canControl: boolean;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(panel.enabled);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setEnabled(panel.enabled);
  }, [panel.enabled, panel.deviceId]);

  useEffect(() => {
    if (!confirming) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirming(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  const environment = panel.environment === "test"
    ? copy.atsEnvTest
    : panel.environment === "live"
      ? copy.atsEnvLive
      : copy.atsEnvUnavailable;
  const notice = panel.blockedReason === "no_vehicle"
    ? copy.atsNoVehicle
    : panel.blockedReason === "no_company"
      ? copy.atsNoCompany
      : panel.blockedReason === "other_source"
        ? copy.atsOtherSource
        : null;
  const canToggle = canControl && panel.blockedReason !== "no_vehicle" && panel.blockedReason !== "no_company" && panel.blockedReason !== "other_source";

  async function commit(next: boolean) {
    if (pending) return;
    setPending(true);
    setError(null);
    setConfirming(false);
    try {
      const result = await setGpsAtsEnabled({ deviceId: panel.deviceId, enabled: next });
      if (!result.ok) {
        setError(result.error === "forbidden" ? copy.atsForbidden : copy.errorFailed);
        return;
      }
      setEnabled(next);
    } finally {
      setPending(false);
    }
  }

  function request(next: boolean) {
    if (!canToggle || pending || next === enabled) return;
    if (!next) {
      setConfirming(true);
      return;
    }
    void commit(true);
  }

  return (
    <section className="gps-ats">
      <h3>{copy.atsTitle}</h3>
      <p className="gps-inline-note">{copy.atsDispatchWithheld}</p>
      <dl className="gps-facts">
        <div><dt>{copy.company}</dt><dd>{panel.companyName ?? "—"}</dd></div>
        <div><dt>{copy.atsSending}</dt><dd>{enabled ? copy.atsOn : copy.atsOff}</dd></div>
        <div><dt>{copy.atsSource}</dt><dd>{panel.sourceDeviceCode ?? "—"}</dd></div>
        <div><dt>{copy.atsLastSuccess}</dt><dd>{panel.lastSuccessAt ? gpsClock(panel.lastSuccessAt) : copy.atsNone}</dd></div>
        <div><dt>{copy.atsLastSent}</dt><dd>{panel.lastSentAt ? gpsClock(panel.lastSentAt) : copy.atsNone}</dd></div>
        <div><dt>{copy.atsLastResponse}</dt><dd>{panel.lastResponse ?? copy.atsNone}</dd></div>
        <div><dt>{copy.atsLastError}</dt><dd>{panel.lastError ?? "—"}</dd></div>
        <div><dt>{copy.atsEnvironment}</dt><dd>{environment}</dd></div>
        <div><dt>{copy.atsGpsNow}</dt><dd>{panel.gpsFresh ? copy.atsGpsYes : copy.atsGpsNo}</dd></div>
      </dl>
      {panel.waitingForTrip ? <p className="gps-inline-note">{copy.atsWaitingTrip}</p> : null}
      {panel.gpsWarning ? <p className="gps-ats-warn">{copy.atsGpsGap}</p> : null}
      {panel.warning ? <p className="gps-ats-warn">{copy.atsOpenUnconfirmed}</p> : null}
      {notice ? <p className="gps-inline-note">{notice}</p> : null}
      {canToggle ? (
        <label className={`booking-switch${pending ? " is-locked" : ""}`}>
          <input
            type="checkbox"
            role="switch"
            className="booking-switch-input"
            checked={enabled}
            disabled={pending}
            aria-label={copy.atsSending}
            onChange={(event) => request(event.target.checked)}
          />
          <span className="booking-switch-track" aria-hidden="true" />
        </label>
      ) : null}
      {error ? <p className="ops-form-error">{error}</p> : null}
      {confirming && mounted ? createPortal(
        <div className="ops-modal-backdrop" role="presentation" onClick={() => setConfirming(false)}>
          <div
            className="ops-modal gps-wifi-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId}>{copy.atsDisableTitle}</h2>
            <p>{copy.atsDisableBody}</p>
            <div className="ops-modal-actions">
              <button type="button" className="ops-btn-secondary" onClick={() => setConfirming(false)}>
                {copy.atsCancel}
              </button>
              <button type="button" className="ops-btn-danger" disabled={pending} onClick={() => void commit(false)}>
                {copy.atsDisableConfirm}
              </button>
            </div>
          </div>
        </div>,
        document.getElementById("portal-root") ?? document.body,
      ) : null}
    </section>
  );
}
