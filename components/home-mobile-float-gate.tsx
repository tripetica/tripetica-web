"use client";

import { useEffect } from "react";

const SHOW_AFTER_PX = 400;

export function HomeMobileFloatGate() {
  useEffect(() => {
    const root = document.documentElement;

    function update() {
      root.classList.toggle("home-float-ready", window.scrollY >= SHOW_AFTER_PX);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      root.classList.remove("home-float-ready");
    };
  }, []);

  return null;
}
