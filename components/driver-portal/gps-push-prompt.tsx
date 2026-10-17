"use client";

import { useEffect, useState } from "react";
import { type DriverPortalCopy } from "@/lib/driver-portal/copy";
import { type Locale } from "@/lib/i18n/config";

type PushNote = "" | "unsupported" | "ios" | "denied" | "ready" | "saved" | "failed";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

async function saveDriverPushSubscription() {
  const keyResponse = await fetch("/api/driver/push/public-key");
  const key = await keyResponse.json() as { configured?: boolean; publicKey?: string | null };
  if (!key.configured || !key.publicKey) return false;
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key.publicKey),
  });
  const saved = await fetch("/api/driver/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  });
  return saved.ok;
}

export function DriverGpsPushPrompt({
  locale,
  copy,
}: {
  locale: Locale;
  copy: DriverPortalCopy;
}) {
  void locale;
  const [note, setNote] = useState<PushNote>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "granted") return;
    void saveDriverPushSubscription().then((saved) => {
      if (saved) setNote("ready");
    }).catch(() => undefined);
  }, []);

  async function enable() {
    if (busy) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNote(isIosDevice() && !isStandaloneDisplay() ? "ios" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setNote("denied");
      return;
    }
    setBusy(true);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNote("denied");
      setBusy(false);
      return;
    }
    try {
      setNote((await saveDriverPushSubscription()) ? "saved" : "failed");
    } catch {
      setNote("failed");
    } finally {
      setBusy(false);
    }
  }

  const status = note === "ios"
    ? copy.pushIosInstall
    : note === "unsupported"
      ? copy.pushUnsupported
      : note === "denied"
        ? copy.pushDenied
        : note === "ready" || note === "saved"
          ? copy.pushEnabled
          : note === "failed"
            ? copy.pushFailed
            : null;

  if (note === "ready" || note === "saved") {
    return <p className="ops-push-status ops-push-status-on">{copy.pushEnabled}</p>;
  }

  return (
    <div className="ops-push-control">
      <button type="button" className="ops-btn-secondary ops-push-button" onClick={() => void enable()} disabled={busy}>
        {busy ? copy.pushBusy : copy.pushEnable}
      </button>
      {status ? <p className="ops-push-status">{status}</p> : null}
    </div>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
