"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type GpsSnapTarget = "section" | "live";

function liveCard(node: HTMLElement | null) {
  const card = node?.parentElement?.querySelector(":scope > section.gps-section");
  return card instanceof HTMLElement ? card : null;
}

function snapGpsViewport(element: HTMLElement, padNode: HTMLElement | null) {
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  const snap = () => {
    if (!element.isConnected) return;
    if (padNode) {
      padNode.style.paddingBottom = "";
      const sectionTop = element.getBoundingClientRect().top + window.scrollY;
      const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const deficit = sectionTop - margin - maxScroll;
      if (deficit > 0) padNode.style.paddingBottom = `${Math.ceil(deficit)}px`;
    }
    element.scrollIntoView({ block: "start" });
  };
  snap();
  // Next scrolls shared layouts after this effect on search updates. Snap again
  // once that pass finishes, still before paint, and without the page's smooth scroll.
  queueMicrotask(() => {
    snap();
    root.style.scrollBehavior = previous;
  });
}

export function GpsSectionToggle({
  showLabel,
  hideLabel,
  rememberKey,
  historyQuery,
  blockedMessage,
  children,
}: {
  showLabel: string;
  hideLabel: string;
  rememberKey?: string;
  historyQuery?: string;
  blockedMessage?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingSnap = useRef<GpsSnapTarget | null>(null);
  const pendingApply = useRef(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!rememberKey) {
      return;
    }
    let consumed = false;
    try {
      if (sessionStorage.getItem(rememberKey) === "1") {
        sessionStorage.removeItem(rememberKey);
        consumed = true;
        pendingApply.current = true;
        pendingSnap.current = "section";
        setOpen(true);
      }
    } catch {
      return;
    }
    if (!consumed) {
      return;
    }
    return () => {
      if (!pendingApply.current) return;
      try {
        sessionStorage.setItem(rememberKey, "1");
      } catch {
        return;
      }
    };
  }, [rememberKey, historyQuery]);

  useLayoutEffect(() => {
    const target = pendingSnap.current;
    if (!target) return;
    if (target === "section" && !open) return;
    if (target === "live" && open) return;
    const element = target === "section"
      ? rootRef.current?.querySelector(":scope > section.gps-section")
      : liveCard(rootRef.current);
    if (!(element instanceof HTMLElement)) {
      pendingSnap.current = null;
      return;
    }
    pendingSnap.current = null;
    pendingApply.current = false;
    snapGpsViewport(element, target === "section" ? rootRef.current : null);
  }, [open, historyQuery]);

  useLayoutEffect(() => {
    if (!blockedMessage) {
      setNotice(null);
      return;
    }
    setOpen(false);
  }, [blockedMessage]);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node || !rememberKey) {
      return;
    }
    const key = rememberKey;
    function remember(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.classList.contains("gps-range")) {
        return;
      }
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        return;
      }
    }
    node.addEventListener("submit", remember);
    return () => node.removeEventListener("submit", remember);
  }, [rememberKey]);

  return (
    <div className="gps-disclosure" ref={rootRef}>
      {open ? (
        <section className="gps-section">
          <div key="gps-section-body">{children}</div>
          <div key="gps-section-hide" className="ops-contact-toggle-wrap gps-disclosure-hide">
            <button
              type="button"
              className="ops-btn-secondary ops-contact-toggle"
              aria-expanded={true}
              onClick={() => {
                if (rootRef.current) rootRef.current.style.paddingBottom = "";
                pendingSnap.current = "live";
                setOpen(false);
              }}
            >
              {hideLabel}
            </button>
          </div>
        </section>
      ) : (
        <div key="gps-section-closed" className="ops-contact-toggle-wrap">
          <button
            key="gps-section-show"
            type="button"
            className="ops-btn-secondary ops-contact-toggle"
            aria-expanded={false}
            onClick={() => {
              if (blockedMessage) {
                setNotice(blockedMessage);
                return;
              }
              pendingSnap.current = "section";
              setNotice(null);
              setOpen(true);
            }}
          >
            {showLabel}
          </button>
          {notice ? <p key="gps-section-notice" className="gps-inline-note" role="status">{notice}</p> : null}
        </div>
      )}
    </div>
  );
}
