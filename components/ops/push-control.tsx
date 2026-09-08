"use client";

import { useEffect, useRef, useState } from "react";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";

type PushStatus = "loading" | "unsupported" | "ios-install" | "off" | "on" | "busy";

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

function createToneContext() {
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

function playTone(kind: "process" | "reservation" | "partner", context: AudioContext) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value =
    kind === "reservation" ? 880 : kind === "partner" ? 392 : 523.25;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + (kind === "reservation" ? 0.55 : kind === "partner" ? 0.36 : 0.28),
  );
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + (kind === "reservation" ? 0.58 : kind === "partner" ? 0.38 : 0.3));
  if (kind === "reservation") {
    const second = context.createOscillator();
    const secondGain = context.createGain();
    second.type = "sine";
    second.frequency.value = 1174.66;
    secondGain.gain.setValueAtTime(0.0001, now + 0.18);
    secondGain.gain.exponentialRampToValueAtTime(0.1, now + 0.2);
    secondGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    second.connect(secondGain);
    secondGain.connect(context.destination);
    second.start(now + 0.18);
    second.stop(now + 0.72);
  }
}

export function OpsPushControl({
  locale,
  copy,
}: {
  locale: Locale;
  copy: OpsCopy;
}) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const audioRef = useRef<AudioContext | null>(null);

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
      if (event.data?.type === "ops-push-navigate" && typeof event.data.url === "string") {
        window.location.assign(event.data.url);
        return;
      }
      if (event.data?.type === "ops-push" && audioRef.current) {
        playTone(
          event.data.kind === "reservation"
            ? "reservation"
            : event.data.kind === "partner"
              ? "partner"
              : "process",
          audioRef.current,
        );
      }
    }
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, []);

  async function enable() {
    if (status === "unsupported" || status === "ios-install" || status === "busy") {
      return;
    }
    setStatus("busy");
    try {
      audioRef.current ??= createToneContext();
      await audioRef.current?.resume();
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await registration.update();
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("off");
        return;
      }
      const keyResponse = await fetch("/api/ops/push/public-key");
      const keyPayload = (await keyResponse.json()) as {
        configured?: boolean;
        publicKey?: string | null;
      };
      if (!keyResponse.ok || !keyPayload.configured || !keyPayload.publicKey) {
        setStatus("off");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
      });
      const saveResponse = await fetch("/api/ops/push/subscribe", {
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
      {status === "off" ? (
        <span className="ops-push-status">{copy.pushDisabled}</span>
      ) : null}
    </div>
  );
}
