"use client";

import { useEffect, useState } from "react";

export function useOpsStickyOffset() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const topbar = document.querySelector(".ops-topbar");
    const applyOffset = () => {
      if (topbar instanceof HTMLElement) {
        document.documentElement.style.setProperty(
          "--ops-topbar-height",
          `${Math.round(topbar.getBoundingClientRect().height)}px`,
        );
      }
      setScrolled(window.scrollY > 8);
    };
    applyOffset();
    const observer =
      topbar instanceof HTMLElement ? new ResizeObserver(applyOffset) : null;
    if (topbar instanceof HTMLElement) {
      observer?.observe(topbar);
    }
    window.addEventListener("scroll", applyOffset, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", applyOffset);
      document.documentElement.style.removeProperty("--ops-topbar-height");
    };
  }, []);

  return scrolled;
}
