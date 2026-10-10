"use client";

import { useEffect, useState } from "react";
import { mobileShareToken, type MobileShareView } from "@/components/gps/mobile-share";

type ShareState = MobileShareView;

async function postShare(body: unknown) {
  const response = await fetch("/api/gps/mobile/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<{ ok?: boolean; error?: string; sessionId?: string }>;
}

function clock(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function PartnerShareButton({ initial }: { initial: ShareState }) {
  const [share, setShare] = useState(initial);
  const [note, setNote] = useState("");

  useEffect(() => {
    let closed = false;
    async function pull() {
      const token = window.sessionStorage.getItem("tripetica.mobileShareToken");
      const response = await fetch("/api/gps/mobile/session", {
        cache: "no-store",
        headers: token ? { "x-mobile-client": token } : {},
      });
      const body = await response.json() as { share?: ShareState | null };
      if (closed || !body.share?.vehicleId) return;
      setShare(body.share);
    }
    const timer = window.setInterval(() => void pull(), 15000);
    window.addEventListener("tripetica-mobile-share", pull);
    document.addEventListener("visibilitychange", pull);
    return () => {
      closed = true;
      window.clearInterval(timer);
      window.removeEventListener("tripetica-mobile-share", pull);
      document.removeEventListener("visibilitychange", pull);
    };
  }, []);

  async function toggle() {
    if (share.sharing) {
      await postShare({ action: "stop", clientToken: mobileShareToken() });
      setShare((current) => ({ ...current, sharing: false, fresh: false }));
      setNote("");
      window.dispatchEvent(new Event("tripetica-mobile-share"));
      return;
    }
    const result = await postShare({ action: "start", clientToken: mobileShareToken() });
    if (!result.ok) {
      setNote(result.error === "other-device" ? "Konum paylaşımı başka bir telefonda açık." : "Konum paylaşımı başlatılamadı.");
      return;
    }
    setShare((current) => ({ ...current, sharing: true, sessionId: result.sessionId ?? current.sessionId, tokenMatches: true }));
    setNote("");
    window.dispatchEvent(new Event("tripetica-mobile-share"));
  }

  const broken = share.sharing && !share.fresh;
  return (
    <div className="partner-share-control">
      <button type="button" className="ops-btn-secondary ops-push-button" onClick={() => void toggle()}>
        {share.sharing ? "Konum Paylaşmayı Durdur" : "Konum Paylaş"}
      </button>
      {broken ? <p className="partner-share-note">Bağlantı kesildi · Son konum: {clock(share.lastFixAt) || "—"}</p> : null}
      {note ? <p className="partner-share-note">{note}</p> : null}
    </div>
  );
}
