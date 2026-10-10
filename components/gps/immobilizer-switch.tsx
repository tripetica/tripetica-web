"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { requestImmobilizerAction } from "@/lib/gps/immobilizer-actions";
import { type GpsCopy } from "@/lib/gps/copy";
import { gpsPresence } from "@/lib/gps/presence";
import { immobilizerView, type ImmobilizerOutput, type ImmobilizerPhase, type ImmobilizerRequest } from "@/lib/teltonika/immobilizer";

export function GpsImmobilizerSwitch({
  copy,
  deviceId,
  surface,
  request,
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
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(request);
  const [currentPhase, setCurrentPhase] = useState(phase);
  const [currentOutput, setCurrentOutput] = useState(output);
  const [currentCommandAt, setCurrentCommandAt] = useState(commandAt);
  const [confirm, setConfirm] = useState<ImmobilizerRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const sending = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!confirm) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirm(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirm]);

  const view = immobilizerView({
    presence: gpsPresence(lastHeartbeatAt, new Date(clock)),
    output: currentOutput,
    phase: currentPhase,
    commandAgeMs: currentCommandAt ? clock - Date.parse(currentCommandAt) : null,
  });
  const verifiedOn = view === "active" && currentOutput === "on";
  const verifiedOff = view === "passive" && currentOutput === "off";
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = !verifiedOn && !verifiedOff;
  }, [verifiedOn, verifiedOff]);
  const status = view === "pending"
    ? copy.immobilizerPending
    : view === "active"
      ? copy.immobilizerActive
      : view === "passive"
        ? copy.immobilizerPassive
        : view === "error"
          ? copy.immobilizerError
          : view === "offline"
            ? copy.immobilizerOffline
            : copy.immobilizerUnknown;

  async function send(next: ImmobilizerRequest) {
    if (sending.current) return;
    sending.current = true;
    setConfirm(null);
    setError(null);
    try {
      const result = await requestImmobilizerAction({
        deviceId,
        surface,
        request: next,
        confirmed: true,
      });
      if (!result.ok) {
        setError(result.error === "duplicate" ? copy.immobilizerDuplicate : copy.immobilizerDenied);
        return;
      }
      setCurrentRequest(result.panel.request);
      setCurrentPhase(result.panel.phase);
      setCurrentOutput(result.panel.output);
      setCurrentCommandAt(result.panel.commandAt);
    } catch {
      setError(copy.immobilizerDenied);
    } finally {
      sending.current = false;
    }
  }

  return (
    <div className="gps-immobilizer">
      <div>
        <h3>{copy.immobilizer}</h3>
        <p>{status}</p>
        <p className="gps-inline-note">{copy.immobilizerDisclaimer}</p>
        {currentPhase === "withheld" ? <p className="gps-inline-note">{copy.immobilizerWithheld}</p> : null}
        {error ? <p className="ops-form-error">{error}</p> : null}
      </div>
      <label className="booking-switch">
        <input
          ref={inputRef}
          type="checkbox"
          role="switch"
          className="booking-switch-input"
          checked={verifiedOn}
          aria-checked={verifiedOn ? "true" : verifiedOff ? "false" : "mixed"}
          aria-label={copy.immobilizer}
          onChange={() => setConfirm(verifiedOn ? "off" : "on")}
        />
        <span className="booking-switch-track" aria-hidden="true" />
      </label>
      {confirm && mounted ? createPortal(
        <div className="ops-modal-backdrop" role="presentation" onClick={() => setConfirm(null)}>
          <div className="ops-modal gps-wifi-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
            <h2 id={titleId}>{confirm === "on" ? copy.immobilizerConfirmOnTitle : copy.immobilizerConfirmOffTitle}</h2>
            <p>{confirm === "on" ? copy.immobilizerConfirmOnBody : copy.immobilizerConfirmOffBody}</p>
            <div className="ops-modal-actions">
              <button type="button" className="ops-btn-secondary" onClick={() => setConfirm(null)}>{copy.wifiShareCancel}</button>
              <button type="button" className={confirm === "on" ? "ops-btn-danger" : "ops-btn"} onClick={() => void send(confirm)}>
                {copy.immobilizerConfirm}
              </button>
            </div>
          </div>
        </div>,
        document.getElementById("portal-root") ?? document.body,
      ) : null}
    </div>
  );
}
