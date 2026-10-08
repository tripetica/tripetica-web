"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { queueGpsWifiShareAction } from "@/lib/gps/actions";
import { GPS_WIFI_SHARE_WAIT_MS, wifiShareConfirmKind } from "@/lib/gps/commands";
import { type GpsCopy } from "@/lib/gps/copy";
import { type GpsWifiShareCommand } from "@/lib/gps/live";

export function GpsWifiShareSwitch({
  copy,
  deviceId,
  surface,
  enabled,
  batteryPercent,
  lowBatteryState,
  shareCommand,
}: {
  copy: GpsCopy;
  deviceId: string;
  surface: "ops" | "partner";
  enabled: boolean | null;
  batteryPercent: number | null;
  lowBatteryState: string | null;
  shareCommand: GpsWifiShareCommand | null;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"off" | "low" | null>(null);
  const [pending, setPending] = useState<{ mode: "on" | "off"; commandId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pending) return;
    if (pending.mode === "off" && enabled === false) {
      setPending(null);
      setError(null);
      return;
    }
    if (pending.mode === "on" && enabled === true) {
      setPending(null);
      setError(null);
      return;
    }
    if (
      shareCommand &&
      shareCommand.id === pending.commandId &&
      (shareCommand.status === "failed" || shareCommand.status === "expired" || shareCommand.status === "cancelled")
    ) {
      setPending(null);
      setError(copy.wifiShareFailed);
    }
  }, [copy.wifiShareFailed, enabled, pending, shareCommand]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      setPending(null);
      setError(copy.wifiShareFailed);
    }, GPS_WIFI_SHARE_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [copy.wifiShareFailed, pending]);

  useEffect(() => {
    if (!confirmKind) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmKind(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmKind]);

  async function send(mode: "on" | "off") {
    if (sending.current) return;
    sending.current = true;
    setError(null);
    setConfirmKind(null);
    setPending({ mode, commandId: "" });
    try {
      const result = await queueGpsWifiShareAction({ deviceId, surface, mode });
      if (!result.ok) {
        setPending(null);
        setError(copy.wifiShareFailed);
        return;
      }
      setPending({ mode, commandId: result.commandId });
    } finally {
      sending.current = false;
    }
  }

  function request(next: "on" | "off") {
    if (enabled === null || pending) return;
    if (next === enabledMode(enabled)) return;
    const kind = wifiShareConfirmKind(next, batteryPercent, lowBatteryState);
    if (kind === "off" || kind === "low") {
      setConfirmKind(kind);
      return;
    }
    void send(next);
  }

  const label = pending
    ? (pending.mode === "off" ? copy.wifiShareClosing : copy.wifiShareOpening)
    : enabled === true
      ? copy.wifiOn
      : enabled === false
        ? copy.wifiOff
        : copy.unavailable;

  return (
    <>
      <div className="gps-wifi-share">
        <span className="gps-wifi-share-label">{label}</span>
        {enabled === null ? null : (
          <label className={`booking-switch${pending ? " is-locked" : ""}`}>
            <input
              type="checkbox"
              role="switch"
              className="booking-switch-input"
              checked={enabled === true}
              disabled={pending !== null}
              aria-label={copy.wifi}
              onChange={(event) => request(event.target.checked ? "on" : "off")}
            />
            <span className="booking-switch-track" aria-hidden="true" />
          </label>
        )}
      </div>
      {error ? <p className="ops-form-error gps-wifi-share-error">{error}</p> : null}
      {confirmKind && mounted ? createPortal(
        <div className="ops-modal-backdrop" role="presentation" onClick={() => setConfirmKind(null)}>
          <div
            className="ops-modal gps-wifi-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId}>{confirmKind === "low" ? copy.wifiLowTitle : copy.wifiShareConfirmTitle}</h2>
            <p>
              {confirmKind === "low"
                ? copy.wifiLowBody.replace("{percent}", String(batteryPercent ?? ""))
                : copy.wifiShareConfirmBody}
            </p>
            <div className="ops-modal-actions">
              <button type="button" className="ops-btn-secondary" onClick={() => setConfirmKind(null)}>
                {copy.wifiShareCancel}
              </button>
              {confirmKind === "low" ? (
                <button type="button" className="ops-btn" disabled={pending !== null} onClick={() => void send("on")}>
                  {copy.wifiLowConfirm}
                </button>
              ) : (
                <button type="button" className="ops-btn-danger" disabled={pending !== null} onClick={() => void send("off")}>
                  {copy.wifiShareConfirm}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.getElementById("portal-root") ?? document.body,
      ) : null}
    </>
  );
}

function enabledMode(enabled: boolean): "on" | "off" {
  return enabled ? "on" : "off";
}
