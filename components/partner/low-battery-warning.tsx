"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { queueGpsLowBatteryAction } from "@/lib/gps/actions";
import { gpsCopy, type GpsCopy } from "@/lib/gps/copy";
import { GPS_LIVE_POLL_MS } from "@/lib/gps/live";
import { formatGraceClock, graceSecondsRemaining } from "@/lib/gps/low-battery";
import { asPanelLocale, type Locale } from "@/lib/i18n/config";

type WarningDevice = {
  deviceId: string;
  deviceCode: string;
  plate: string | null;
  batteryPercent: number | null;
  lowBatteryState: "grace" | "keep_on" | "saving" | "normal" | null;
  lowBatteryGraceRemainingSeconds: number | null;
  episodeAt: string | null;
  wifiEnabled: boolean | null;
};

export function PartnerLowBatteryWarning({ locale }: { locale: Locale }) {
  const copy = gpsCopy[asPanelLocale(locale)];
  const titleId = useId();
  const [devices, setDevices] = useState<WarningDevice[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, true>>({});
  const [now, setNow] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);
  const [sending, setSending] = useState<"keep_on" | "save_power" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [awaitingSaveId, setAwaitingSaveId] = useState<string | null>(null);
  const syncRef = useRef<Record<string, { remaining: number; at: number }>>({});

  useEffect(() => {
    setMounted(true);
    const stored: Record<string, true> = {};
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith("gps-low-battery-dismiss:")) stored[key] = true;
    }
    setDismissed(stored);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const device = devices.find((item) => item.lowBatteryState === "grace" && !dismissed[`gps-low-battery-dismiss:${item.deviceId}:${item.episodeAt ?? "open"}`]);
      if (!device) return;
      const key = `gps-low-battery-dismiss:${device.deviceId}:${device.episodeAt ?? "open"}`;
      window.sessionStorage.setItem(key, "1");
      setDismissed((current) => ({ ...current, [key]: true }));
      setSending(null);
      setError(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [devices, dismissed]);

  useEffect(() => {
    let stopped = false;
    async function pull() {
      if (document.visibilityState === "hidden") return;
      const response = await fetch("/api/gps/low-battery", { cache: "no-store" });
      if (!response.ok || stopped) return;
      const body = await response.json() as { devices?: WarningDevice[] };
      const next = Array.isArray(body.devices) ? body.devices : [];
      const at = Date.now();
      for (const device of next) {
        if (device.lowBatteryGraceRemainingSeconds === null) continue;
        const previous = syncRef.current[device.deviceId];
        if (!previous || previous.remaining !== device.lowBatteryGraceRemainingSeconds) {
          syncRef.current[device.deviceId] = { remaining: device.lowBatteryGraceRemainingSeconds, at };
        }
      }
      if (!stopped) setDevices(next);
    }
    void pull();
    const timer = window.setInterval(() => void pull(), GPS_LIVE_POLL_MS);
    document.addEventListener("visibilitychange", pull);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pull);
    };
  }, []);

  function clockFor(device: WarningDevice) {
    const sync = syncRef.current[device.deviceId];
    if (!sync) return device.lowBatteryGraceRemainingSeconds === null ? null : formatGraceClock(device.lowBatteryGraceRemainingSeconds);
    return formatGraceClock(graceSecondsRemaining(sync.remaining, sync.at, now));
  }

  function dismissKey(device: WarningDevice) {
    return `gps-low-battery-dismiss:${device.deviceId}:${device.episodeAt ?? "open"}`;
  }

  function isDismissed(device: WarningDevice) {
    return Boolean(dismissed[dismissKey(device)]);
  }

  function dismiss(device: WarningDevice) {
    const key = dismissKey(device);
    window.sessionStorage.setItem(key, "1");
    setDismissed((current) => ({ ...current, [key]: true }));
    setAwaitingSaveId((current) => current === device.deviceId ? null : current);
    setSending(null);
    setError(null);
  }

  function reopen(device: WarningDevice) {
    const key = dismissKey(device);
    window.sessionStorage.removeItem(key);
    setDismissed((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setAwaitingSaveId(null);
  }

  const grace = devices.filter((device) => device.lowBatteryState === "grace");
  const savingDevice = devices.find((device) =>
    device.deviceId === awaitingSaveId
    && device.lowBatteryState === "saving"
    && device.wifiEnabled !== false
  ) ?? null;
  const modalDevice = savingDevice ?? grace.find((device) => !isDismissed(device)) ?? null;

  async function decide(action: "keep_on" | "save_power") {
    if (!modalDevice || sending) return;
    setSending(action);
    setError(null);
    const result = await queueGpsLowBatteryAction({ deviceId: modalDevice.deviceId, action });
    if (!result.ok) {
      setSending(null);
      setError(copy.wifiShareFailed);
      return;
    }
    if (action === "save_power") setAwaitingSaveId(modalDevice.deviceId);
  }

  const banners = grace.filter((device) => isDismissed(device) && device.deviceId !== modalDevice?.deviceId);

  return (
    <>
      {banners.map((device) => {
        const clock = clockFor(device);
        const label = device.plate?.trim() || device.deviceCode;
        const text = device.batteryPercent === null
          ? copy.lowBatteryBannerPlain.replace("{label}", label).replace("{clock}", clock ?? "—")
          : copy.lowBatteryBanner
            .replace("{label}", label)
            .replace("{percent}", String(device.batteryPercent))
            .replace("{clock}", clock ?? "—");
        return (
          <button key={dismissKey(device)} type="button" className="gps-low-banner" onClick={() => reopen(device)}>
            ⚠️ {text}
          </button>
        );
      })}
      {modalDevice && mounted ? createPortal(
        <div className="ops-modal-backdrop" role="presentation">
          <div className="ops-modal gps-low-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <button type="button" className="gps-low-dismiss" aria-label={copy.lowBatteryDismiss} onClick={() => dismiss(modalDevice)}>×</button>
            <h2 id={titleId}>{titleFor(copy, modalDevice.batteryPercent)}</h2>
            <p className="gps-low-device">{modalDevice.plate?.trim() || modalDevice.deviceCode}</p>
            <p className="gps-low-clock">{clockFor(modalDevice) ?? "—"}</p>
            <p>{copy.lowBatteryBody.replace("{clock}", clockFor(modalDevice) ?? "—")}</p>
            {error ? <p className="ops-form-error">{error}</p> : null}
            <div className="ops-modal-actions">
              <button type="button" className="ops-btn" disabled={sending !== null} onClick={() => void decide("keep_on")}>{copy.lowBatteryKeep}</button>
              <button type="button" className="ops-btn-danger" disabled={sending !== null} onClick={() => void decide("save_power")}>{copy.lowBatterySave}</button>
            </div>
          </div>
        </div>,
        document.getElementById("portal-root") ?? document.body,
      ) : null}
    </>
  );
}

function titleFor(copy: GpsCopy, percent: number | null) {
  return percent === null ? copy.lowBatteryTitlePlain : copy.lowBatteryTitle.replace("{percent}", String(percent));
}
