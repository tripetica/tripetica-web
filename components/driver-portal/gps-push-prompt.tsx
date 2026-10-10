"use client";

import { useState } from "react";

export function DriverGpsPushPrompt() {
  const [note, setNote] = useState("");

  async function enable() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNote("Bu tarayıcı bildirim desteklemiyor.");
      return;
    }
    if (Notification.permission === "denied") {
      setNote("Bildirim izni kapalı. Tarayıcı ayarından açılmadan gönderim yapılamaz.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNote("Bildirim izni verilmedi.");
      return;
    }
    const keyResponse = await fetch("/api/driver/push/public-key");
    const key = await keyResponse.json() as { configured?: boolean; publicKey?: string | null };
    if (!key.configured || !key.publicKey) {
      setNote("Bildirim sunucuda hazır değil.");
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key.publicKey),
    });
    const saved = await fetch("/api/driver/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    });
    setNote(saved.ok ? "Bildirimler açık." : "Bildirim kaydı tamamlanamadı.");
  }

  return (
    <section className="gps-section">
      <h2>Sefer hatırlatması</h2>
      <p>Konum paylaşımı kesilirse sefer saatine yakın bir uyarı gönderilebilir.</p>
      <button type="button" className="ops-btn" onClick={() => void enable()}>Bildirimleri aç</button>
      {note ? <p>{note}</p> : null}
    </section>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}
