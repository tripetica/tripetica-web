"use client";

import { useEffect, useRef, useState } from "react";

const TOKEN_KEY = "tripetica.mobileShareToken";

export type MobileShareView = {
  driverName: string;
  plate: string | null;
  vehicleId?: string | null;
  sessionId: string | null;
  sharing: boolean;
  tokenMatches: boolean;
  tokenBound?: boolean;
  lastFixAt: string | null;
  accuracyM: number | null;
  fresh: boolean;
};

export function mobileShareToken() {
  const existing = window.sessionStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(TOKEN_KEY, created);
  return created;
}

async function postShare(body: unknown) {
  const response = await fetch("/api/gps/mobile/session", {
    method: "POST",
    headers: { "content-type": "application/json", "x-mobile-client": mobileShareToken() },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<{ ok?: boolean; sessionId?: string; error?: string }>;
}

function watchShare(sessionId: string, onFix: (recordedAt: string, accuracyM: number) => void, onStop: (denied: boolean) => void) {
  if (!navigator.geolocation) {
    onStop(false);
    return () => undefined;
  }
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const recordedAt = new Date(position.timestamp).toISOString();
      void fetch("/api/gps/mobile/points", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mobile-client": mobileShareToken() },
        body: JSON.stringify({
          sessionId,
          clientToken: mobileShareToken(),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          recordedAt,
          accuracyM: position.coords.accuracy,
          speedMps: position.coords.speed,
          headingDeg: position.coords.heading,
        }),
      }).then(async (response) => {
        const result = await response.json() as { ok?: boolean };
        if (result.ok) onFix(recordedAt, position.coords.accuracy);
      });
    },
    (error) => onStop(error.code === 1),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

export function PartnerMobileShareRuntime() {
  const stopWatch = useRef<(() => void) | null>(null);

  useEffect(() => {
    let closed = false;
    function lost() {
      const token = window.sessionStorage.getItem(TOKEN_KEY);
      if (!token) return;
      const payload = new Blob([JSON.stringify({ action: "stream_lost", clientToken: token })], { type: "application/json" });
      navigator.sendBeacon("/api/gps/mobile/session", payload);
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        if (!stopWatch.current) return;
        lost();
        return;
      }
      void resume();
    }
    async function resume() {
      const token = window.sessionStorage.getItem(TOKEN_KEY);
      if (!token) return;
      const response = await fetch("/api/gps/mobile/session", {
        cache: "no-store",
        headers: { "x-mobile-client": token },
      });
      const body = await response.json() as { share?: MobileShareView | null };
      const share = body.share;
      if (closed || !share?.sharing || !share.sessionId) {
        stopWatch.current?.();
        stopWatch.current = null;
        return;
      }
      if (share.tokenBound && !share.tokenMatches) return;
      if (!share.tokenMatches) {
        const started = await postShare({ action: "start", clientToken: token });
        if (!started.ok) return;
      }
      if (stopWatch.current) return;
      stopWatch.current = watchShare(share.sessionId, () => undefined, (denied) => {
        void postShare({ action: denied ? "permission_denied" : "stream_lost", clientToken: token });
        stopWatch.current?.();
        stopWatch.current = null;
      });
    }
    void resume();
    window.addEventListener("tripetica-mobile-share", resume);
    window.addEventListener("pagehide", lost);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      closed = true;
      stopWatch.current?.();
      window.removeEventListener("tripetica-mobile-share", resume);
      window.removeEventListener("pagehide", lost);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}

export function DriverShareSwitch({
  title,
  initial,
  watchHere = false,
}: {
  title: string;
  initial: MobileShareView;
  watchHere?: boolean;
}) {
  const [share, setShare] = useState(initial);
  const [warning, setWarning] = useState("");
  const stopWatch = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!watchHere || !share.sharing || !share.sessionId) return;
    let stopped = false;
    function start() {
      if (stopped || stopWatch.current) return;
      const sessionId = share.sessionId;
      if (!sessionId) return;
      stopWatch.current = watchShare(sessionId, (recordedAt, accuracyM) => {
        setShare((current) => ({ ...current, lastFixAt: recordedAt, accuracyM, fresh: true }));
      }, (denied) => {
        setWarning(denied ? "Konum izni reddedildi." : "Konum akışı kesildi.");
        void postShare({ action: denied ? "permission_denied" : "stream_lost", clientToken: mobileShareToken() });
        stopWatch.current?.();
        stopWatch.current = null;
      });
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        if (!stopWatch.current) return;
        void postShare({ action: "stream_lost", clientToken: mobileShareToken() });
        return;
      }
      start();
    }
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      stopWatch.current?.();
      stopWatch.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [share.sessionId, share.sharing, watchHere]);

  async function toggle(next: boolean) {
    if (next) {
      const result = await postShare({ action: "start", clientToken: mobileShareToken() });
      if (!result.ok) {
        setWarning(result.error === "other-device" ? "Konum paylaşımı başka bir telefonda açık." : "Konum paylaşımı başlatılamadı.");
        return;
      }
      setShare((current) => ({ ...current, sharing: true, sessionId: result.sessionId ?? current.sessionId, tokenMatches: true }));
      setWarning("");
      window.dispatchEvent(new Event("tripetica-mobile-share"));
      return;
    }
    await postShare({ action: "stop", clientToken: mobileShareToken() });
    setShare((current) => ({ ...current, sharing: false, fresh: false, sessionId: null }));
    window.dispatchEvent(new Event("tripetica-mobile-share"));
  }

  const flow = !share.sharing ? "Kapalı" : share.fresh ? "Konum gönderiliyor" : "Konum akışı kesildi";
  return (
    <section className="gps-section">
      <h2>{title}</h2>
      <p>{share.driverName}{share.plate ? ` · ${share.plate}` : ""}</p>
      <label>
        <input type="checkbox" checked={share.sharing} onChange={(event) => void toggle(event.target.checked)} />
        {" "}Konum Paylaşımı {share.sharing ? "açık" : "kapalı"}
      </label>
      <p>{flow}</p>
      <p>Son konum: {share.lastFixAt ? new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "medium" }).format(new Date(share.lastFixAt)) : "—"} · Doğruluk: {share.accuracyM == null ? "—" : `${Math.round(share.accuracyM)} m`}</p>
      {warning ? <p className="ops-form-error">{warning}</p> : null}
      <p className="gps-inline-note">Konum izni ayrıca istenir. Sayfa bu sekmede açıkken konum gönderilir. Sekme kapanırsa veya gönderim durursa durum konum akışı kesildi olur.</p>
    </section>
  );
}

export function MobileGpsShare({
  title,
  initial,
}: {
  title: string;
  initial: MobileShareView;
}) {
  return <DriverShareSwitch title={title} initial={initial} watchHere />;
}
