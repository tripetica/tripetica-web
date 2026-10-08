"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GPS_CAMERA_FRAME_STALE_MS, GPS_CAMERA_VIEWER_POLL_MS, type GpsCameraIdlePhase } from "@/lib/gps/camera";
import { type GpsCopy } from "@/lib/gps/copy";
import { cameraNeedsLowBatteryConfirm } from "@/lib/gps/low-battery";

type WatchPhase = GpsCameraIdlePhase | "connecting" | "live" | "lost" | "ended";

export function GpsCameraLive({
  copy,
  deviceId,
  surface,
  initialPhase,
  initialLowBatteryState = null,
  initialBatteryPercent = null,
}: {
  copy: GpsCopy;
  deviceId: string;
  surface: "ops" | "partner";
  initialPhase: GpsCameraIdlePhase;
  initialLowBatteryState?: string | null;
  initialBatteryPercent?: number | null;
}) {
  const titleId = useId();
  const [phase, setPhase] = useState<WatchPhase>(initialPhase);
  const [lowBatteryState, setLowBatteryState] = useState<string | null>(initialLowBatteryState);
  const [batteryPercent, setBatteryPercent] = useState<number | null>(initialBatteryPercent);
  const [warnOpen, setWarnOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const frameAtRef = useRef(0);
  const urlRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      const sessionId = sessionRef.current;
      sessionRef.current = null;
      if (sessionId) {
        const url = `/api/gps/camera/sessions/${sessionId}/stop?surface=${surface}`;
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(url);
        } else {
          void fetch(url, { method: "POST", keepalive: true });
        }
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, [surface]);

  useEffect(() => {
    const root = rootRef.current;
    const parent = root?.parentElement;
    if (!parent) {
      return;
    }
    const observer = new MutationObserver(() => {
      if (parent.hasAttribute("hidden")) {
        void stop();
      }
    });
    observer.observe(parent, { attributes: true, attributeFilter: ["hidden"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase === "connecting" || phase === "live") {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshIdle();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [phase, deviceId, surface]);

  useEffect(() => {
    if (phase !== "connecting" && phase !== "live") {
      return;
    }
    let stopped = false;
    const timer = window.setInterval(() => {
      void pullFrame(stopped);
    }, GPS_CAMERA_VIEWER_POLL_MS);
    void pullFrame(false);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [phase]);

  async function refreshIdle() {
    const response = await fetch(`/api/gps/camera/devices/${deviceId}?surface=${surface}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const body = await response.json() as {
      phase?: GpsCameraIdlePhase;
      lowBatteryState?: string | null;
      batteryPercent?: number | null;
    };
    if (typeof body.lowBatteryState === "string" || body.lowBatteryState === null) {
      setLowBatteryState(body.lowBatteryState ?? null);
    }
    if (typeof body.batteryPercent === "number" || body.batteryPercent === null) {
      setBatteryPercent(body.batteryPercent ?? null);
    }
    if (body.phase && sessionRef.current === null) {
      setPhase(body.phase);
    }
  }

  async function pullFrame(stopped: boolean) {
    const sessionId = sessionRef.current;
    if (!sessionId || stopped) {
      return;
    }
    const response = await fetch(`/api/gps/camera/sessions/${sessionId}/frame?surface=${surface}`, { cache: "no-store" });
    if (stopped || sessionRef.current !== sessionId) {
      return;
    }
    if (response.status === 204) {
      return;
    }
    if (!response.ok) {
      sessionRef.current = null;
      setPhase("ended");
      return;
    }
    const at = Number(response.headers.get("x-frame-at") ?? 0);
    if (at > 0 && frameAtRef.current > 0 && Date.now() - at > GPS_CAMERA_FRAME_STALE_MS) {
      setPhase("lost");
      return;
    }
    const blob = await response.blob();
    if (sessionRef.current !== sessionId) {
      return;
    }
    const nextUrl = URL.createObjectURL(blob);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
    urlRef.current = nextUrl;
    frameAtRef.current = at || Date.now();
    setFrameUrl(nextUrl);
    setPhase("live");
  }

  useEffect(() => {
    if (phase !== "live") {
      return;
    }
    const timer = window.setInterval(() => {
      if (frameAtRef.current > 0 && Date.now() - frameAtRef.current > GPS_CAMERA_FRAME_STALE_MS) {
        setPhase("lost");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  async function start() {
    const previous = sessionRef.current;
    sessionRef.current = null;
    frameAtRef.current = 0;
    if (previous) {
      await fetch(`/api/gps/camera/sessions/${previous}/stop?surface=${surface}`, { method: "POST", cache: "no-store" });
    }
    setPhase("connecting");
    const response = await fetch("/api/gps/camera/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ deviceId, surface }),
    });
    const body = await response.json().catch(() => null) as { ok?: boolean; sessionId?: string; error?: string } | null;
    if (!response.ok || !body?.sessionId) {
      setPhase(body?.error === "offline" ? "offline" : body?.error === "camera_unavailable" ? "unavailable" : "ended");
      return;
    }
    sessionRef.current = body.sessionId;
    setPhase("connecting");
  }

  async function stop() {
    const sessionId = sessionRef.current;
    sessionRef.current = null;
    frameAtRef.current = 0;
    if (sessionId) {
      await fetch(`/api/gps/camera/sessions/${sessionId}/stop?surface=${surface}`, { method: "POST", cache: "no-store" });
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setFrameUrl(null);
    await refreshIdle();
  }

  const watching = phase === "connecting" || phase === "live" || phase === "lost";
  const lowPowerCamera = surface === "partner" && cameraNeedsLowBatteryConfirm(lowBatteryState);
  const canStart = phase === "ready" || phase === "lost" || phase === "ended" || lowPowerCamera;

  function requestStart() {
    if (lowPowerCamera) {
      setWarnOpen(true);
      return;
    }
    void start();
  }

  return (
    <section className="gps-section gps-camera" ref={rootRef}>
      <h2>{copy.tabCamera}</h2>
      <p>{copy.cameraLiveTitle}</p>
      <div className="gps-camera-stage" aria-live="polite">
        {phase === "live" && frameUrl ? <img src={frameUrl} alt={copy.cameraLiveTitle} /> : null}
        {phase === "live" ? <span className="gps-camera-badge">{copy.cameraLiveBadge}</span> : null}
        {phase !== "live" ? <p>{stageText(copy, phase)}</p> : null}
      </div>
      <p className="gps-hint">{statusText(copy, phase)}</p>
      <div className="gps-camera-actions">
        {canStart ? (
          <button type="button" className="ops-btn" onClick={requestStart}>{copy.cameraWatch}</button>
        ) : null}
        {watching ? (
          <button type="button" className="ops-btn-ghost" onClick={() => void stop()}>{copy.cameraStop}</button>
        ) : null}
        {!canStart && (phase === "offline" || phase === "unavailable" || phase === "unknown") ? (
          <button type="button" className="ops-btn" disabled>{copy.cameraWatch}</button>
        ) : null}
      </div>
      {warnOpen && mounted ? createPortal(
        <div className="ops-modal-backdrop" role="presentation" onClick={() => setWarnOpen(false)}>
          <div className="ops-modal gps-wifi-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
            <h2 id={titleId}>
              {batteryPercent === null ? copy.cameraLowTitlePlain : copy.cameraLowTitle.replace("{percent}", String(batteryPercent))}
            </h2>
            <p>{copy.cameraLowBody}</p>
            <div className="ops-modal-actions">
              <button type="button" className="ops-btn-secondary" onClick={() => setWarnOpen(false)}>{copy.wifiShareCancel}</button>
              <button type="button" className="ops-btn" onClick={() => { setWarnOpen(false); void start(); }}>{copy.cameraLowConfirm}</button>
            </div>
          </div>
        </div>,
        document.getElementById("portal-root") ?? document.body,
      ) : null}
    </section>
  );
}

function stageText(copy: GpsCopy, phase: WatchPhase) {
  if (phase === "connecting") return copy.cameraConnecting;
  if (phase === "offline") return copy.cameraOffline;
  if (phase === "unavailable") return copy.cameraUnavailable;
  if (phase === "unknown") return copy.cameraUnknown;
  if (phase === "lost") return copy.cameraLost;
  if (phase === "ended") return copy.cameraEnded;
  return copy.cameraReady;
}

function statusText(copy: GpsCopy, phase: WatchPhase) {
  if (phase === "live") return copy.cameraStatusLive;
  if (phase === "connecting") return copy.cameraStatusConnecting;
  if (phase === "lost") return copy.cameraStatusLost;
  if (phase === "ended") return copy.cameraStatusEnded;
  if (phase === "offline") return copy.cameraOffline;
  if (phase === "unavailable") return copy.cameraUnavailable;
  if (phase === "unknown") return copy.cameraUnknown;
  return copy.cameraReady;
}
