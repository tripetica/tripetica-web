"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { beginImmobilizerEnableAction, readImmobilizerPanelAction, requestImmobilizerAction } from "@/lib/gps/immobilizer-actions";
import { type GpsCopy } from "@/lib/gps/copy";
import { gpsPresence } from "@/lib/gps/presence";
import { immobilizerSwitchPresentation, immobilizerView, type ImmobilizerOutput, type ImmobilizerPhase, type ImmobilizerReadiness, type ImmobilizerRequest } from "@/lib/teltonika/immobilizer";

export function GpsImmobilizerSwitch({
  copy,
  deviceId,
  surface,
  output,
  phase,
  commandAt,
  lastHeartbeatAt,
}: {
  copy: GpsCopy;
  deviceId: string;
  surface: "ops" | "partner";
  request: ImmobilizerRequest;
  output: ImmobilizerOutput;
  phase: ImmobilizerPhase;
  commandAt: string | null;
  lastHeartbeatAt: string | null;
  readiness: ImmobilizerReadiness;
  starterCircuitVerified: boolean;
}) {
  const titleId = useId();
  const partner = surface === "partner";
  const [mounted, setMounted] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(phase);
  const [currentOutput, setCurrentOutput] = useState(output);
  const [currentCommandAt, setCurrentCommandAt] = useState(commandAt);
  const [heartbeatAt, setHeartbeatAt] = useState(lastHeartbeatAt);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const sending = useRef(false);
  const openGeneration = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancel = false;
    async function pull() {
      if (sending.current) return;
      const result = await readImmobilizerPanelAction({ deviceId, surface });
      if (cancel || !result.ok) return;
      setCurrentPhase(result.panel.phase);
      setCurrentOutput(result.panel.output);
      setCurrentCommandAt(result.panel.commandAt);
      setHeartbeatAt(result.panel.lastHeartbeatAt);
      if (result.panel.phase === "acknowledged" || result.panel.phase === "queued" || result.panel.phase === "sent") {
        setError(null);
      }
    }
    const timer = window.setInterval(() => void pull(), 5_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [deviceId, surface]);

  useEffect(() => {
    if (!confirmOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeConfirm();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen]);

  const view = immobilizerView({
    presence: gpsPresence(heartbeatAt, new Date(clock)),
    output: currentOutput,
    phase: currentPhase,
    commandAgeMs: currentCommandAt ? clock - Date.parse(currentCommandAt) : null,
  });
  const presented = immobilizerSwitchPresentation({ view, output: currentOutput });
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = presented.indeterminate;
  }, [presented.indeterminate]);
  const blocked = null;
  const status = partner
      ? presented.status === "pending"
        ? copy.immobilizerProcessing
        : presented.status === "active"
          ? copy.immobilizerResultActive
          : presented.status === "passive"
            ? copy.immobilizerResultClosed
            : copy.immobilizerStatusUnknown
      : presented.status === "pending"
        ? copy.immobilizerPending
        : presented.status === "active"
          ? copy.immobilizerActive
          : presented.status === "passive"
            ? copy.immobilizerPassive
            : view === "error"
              ? copy.immobilizerError
              : view === "offline"
                ? copy.immobilizerOffline
                : copy.immobilizerUnknown;
  const failure = error
    ?? (currentPhase === "timeout"
      ? copy.immobilizerCommandTimeout
      : currentPhase === "rejected"
        ? copy.immobilizerCommandRejected
        : view === "error"
          ? copy.immobilizerCommandFailed
          : null);
  const locked = blocked !== null || busy || view === "pending";

  function closeConfirm() {
    openGeneration.current += 1;
    setConfirmOpen(false);
    setConfirmationId(null);
  }

  async function openEnable() {
    if (locked) return;
    const generation = openGeneration.current + 1;
    openGeneration.current = generation;
    setConfirmOpen(true);
    setConfirmationId(null);
    setError(null);
    try {
      const begun = await beginImmobilizerEnableAction({ deviceId, surface });
      if (generation !== openGeneration.current) return;
      if (!begun.ok) {
        closeConfirm();
        setError(begun.error === "forbidden" ? copy.immobilizerDenied : copy.immobilizerConfirmExpired);
        return;
      }
      setConfirmationId(begun.confirmationId);
    } catch {
      if (generation !== openGeneration.current) return;
      closeConfirm();
      setError(copy.immobilizerDenied);
    }
  }

  async function send(next: ImmobilizerRequest) {
    if (sending.current || locked) return;
    if (next === "on" && !confirmationId) return;
    const enableConfirmation = next === "on" ? confirmationId : null;
    sending.current = true;
    setBusy(true);
    setConfirmOpen(false);
    setConfirmationId(null);
    setError(null);
    try {
      const result = await requestImmobilizerAction({
        deviceId,
        surface,
        request: next,
        confirmationId: enableConfirmation,
      });
      if (!result.ok) {
        setError(result.error === "duplicate"
          ? copy.immobilizerDuplicate
          : result.error === "confirm"
            ? copy.immobilizerConfirmExpired
            : result.error === "unsafe"
              ? copy.immobilizerUnsafe
              : result.error === "not_ready"
                ? (blocked ?? copy.immobilizerServiceOff)
                : copy.immobilizerDenied);
        return;
      }
      setCurrentPhase(result.panel.phase);
      setCurrentOutput(result.panel.output);
      setCurrentCommandAt(result.panel.commandAt);
      if (result.panel.phase === "timeout") {
        setError(copy.immobilizerCommandTimeout);
      } else if (result.panel.phase === "rejected") {
        setError(copy.immobilizerCommandRejected);
      } else if (result.panel.phase === "withheld") {
        setError(copy.immobilizerCommandFailed);
      }
    } catch {
      setError(copy.immobilizerDenied);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const switchControl = (
    <label className="booking-switch">
      <input
        ref={inputRef}
        type="checkbox"
        role="switch"
        className="booking-switch-input"
        checked={presented.checked}
        disabled={blocked !== null || busy || view === "pending"}
        aria-checked={presented.checked ? "true" : presented.indeterminate ? "mixed" : "false"}
        aria-label={copy.immobilizer}
        onChange={() => {
          if (locked) return;
          if (presented.checked) {
            void send("off");
            return;
          }
          void openEnable();
        }}
      />
      <span className="booking-switch-track" aria-hidden="true" />
    </label>
  );

  return (
    <div className={partner ? "gps-immobilizer is-partner" : "gps-immobilizer"}>
      <div>
        {partner ? (
          <div className="gps-immobilizer-line">
            <h3>{copy.immobilizer}</h3>
            {switchControl}
          </div>
        ) : <h3>{copy.immobilizer}</h3>}
        <p className={partner ? "gps-immobilizer-status" : undefined}>{status}</p>
        {partner ? null : <p className="gps-inline-note">{copy.immobilizerDispatchClosed}</p>}
        {partner ? null : <p className="gps-inline-note">{copy.immobilizerDisclaimer}</p>}
        {partner || currentPhase !== "withheld" ? null : <p className="gps-inline-note">{copy.immobilizerWithheld}</p>}
        {failure ? <p className="ops-form-error">{failure}</p> : null}
      </div>
      {partner ? null : switchControl}
      {confirmOpen && mounted ? createPortal(
        <div className="ops-modal-backdrop" role="presentation" onClick={closeConfirm}>
          <div className="ops-modal gps-wifi-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
            <h2 id={titleId}>{copy.immobilizerConfirmOnTitle}</h2>
            <p>{copy.immobilizerConfirmOnQuestion}</p>
            <p>{copy.immobilizerConfirmOnBody}</p>
            <div className="ops-modal-actions">
              <button type="button" className="ops-btn-secondary" onClick={closeConfirm}>{copy.wifiShareCancel}</button>
              <button type="button" className="ops-btn-danger" disabled={!confirmationId || busy} onClick={() => void send("on")}>
                {copy.immobilizerConfirmEnable}
              </button>
            </div>
          </div>
        </div>,
        document.getElementById("portal-root") ?? document.body,
      ) : null}
    </div>
  );
}
