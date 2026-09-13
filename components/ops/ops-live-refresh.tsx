"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function OpsLiveRefresh({ intervalMs = 6000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    function tick() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, router]);

  return null;
}
