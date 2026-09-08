"use client";

import { useEffect, useState } from "react";
import { type Locale } from "@/lib/i18n/config";
import { type PartnerCopy } from "@/lib/partner/copy";

type PushStatus = "loading" | "unsupported" | "ios-install" | "off" | "on" | "denied" | "busy";

function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

export function PartnerPushControl({
  locale,
  copy,
}: {
  locale: Locale;
  copy: PartnerCopy;
}) {
  const [status, setStatus] = useState<PushStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (isIosDevice() && !isStandaloneDisplay()) {
          setStatus("ios-install");
          return;
        }
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (!cancelled) {
          setStatus(subscription && Notification.permission === "granted" ? "on" : "off");
        }
      } catch {
        if (!cancelled) {
          setStatus("off");
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "partner-push-navigate" && typeof event.data.url === "string") {
        window.location.assign(event.data.url);
      }
    }
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, []);

  async function enable() {
    if (status === "unsupported" || status === "ios-install" || status === "denied" || status === "busy") {
      return;
    }
    setStatus("busy");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await registration.update();
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        return;
      }
      if (permission !== "granted") {
        setStatus("off");
        return;
      }
      const keyResponse = await fetch("/api/partner/push/public-key");
      const keyPayload = (await keyResponse.json()) as {
        configured?: boolean;
        publicKey?: string | null;
      };
      if (!keyResponse.ok || !keyPayload.configured || !keyPayload.publicKey) {
        setStatus("unsupported");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
      });
      const saveResponse = await fetch("/api/partner/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          locale,
        }),
      });
      if (!saveResponse.ok) {
        setStatus("off");
        return;
      }
      setStatus("on");
    } catch {
      setStatus("off");
    }
  }

  if (status === "loading") {
    return null;
  }

  if (status === "unsupported") {
    return <p className="ops-push-status">{copy.pushUnsupported}</p>;
  }

  if (status === "ios-install") {
    return <p className="ops-push-status">{copy.pushIosInstall}</p>;
  }

  if (status === "denied") {
    return <p className="ops-push-status">{copy.pushDenied}</p>;
  }

  if (status === "on") {
    return <p className="ops-push-status ops-push-status-on">{copy.pushEnabled}</p>;
  }

  return (
    <div className="ops-push-control">
      <button
        type="button"
        className="ops-btn-secondary ops-push-button"
        onClick={() => void enable()}
        disabled={status === "busy"}
      >
        {status === "busy" ? copy.pushBusy : copy.pushEnable}
      </button>
    </div>
  );
}
