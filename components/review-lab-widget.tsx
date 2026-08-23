"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

import { type Locale } from "@/lib/i18n/config";

const WIDGET_ID = "6a6e15019e763a3b44366b61";
const SCRIPT_SRC = "https://app.reviewlab.ru/widget/index-es2015.js";
const TAB_NAME_STYLE_ID = "tripetica-all-reviews-color";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "review-lab": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { "data-widgetid"?: string },
        HTMLElement
      >;
    }
  }
}

function isIosClient() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function paintAllReviewsLabel(host: Element) {
  const root = host.shadowRoot;
  if (!root || root.getElementById(TAB_NAME_STYLE_ID)) {
    return Boolean(root);
  }

  const style = document.createElement("style");
  style.id = TAB_NAME_STYLE_ID;
  style.textContent = `
    [data-tab="all"] .widget__tab-name,
    [data-tab="all"][data-selected="true"] .widget__tab-name,
    [data-tab="all"]:hover .widget__tab-name,
    [data-tab="all"]:active .widget__tab-name,
    [data-tab="all"]:focus .widget__tab-name,
    [data-tab="all"]:focus-visible .widget__tab-name {
      color: #0f172a !important;
    }
  `;
  root.appendChild(style);
  return true;
}

export function ReviewLabWidget({ locale }: { locale: Locale }) {
  const hostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isIosClient()) {
      return;
    }

    let cancelled = false;
    let tries = 0;

    function apply() {
      if (cancelled) {
        return;
      }
      const host = hostRef.current;
      if (host && paintAllReviewsLabel(host)) {
        return;
      }
      tries += 1;
      if (tries < 40) {
        window.setTimeout(apply, 150);
      }
    }

    apply();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="review-lab-section"
      aria-label={locale === "tr" ? "Yorumlar" : "Reviews"}
    >
      <div className="review-lab-host">
        <review-lab ref={hostRef} data-widgetid={WIDGET_ID} />
      </div>
      <Script
        id="review-lab-widget-script"
        src={SCRIPT_SRC}
        strategy="lazyOnload"
        onReady={() => {
          if (!isIosClient() && hostRef.current) {
            paintAllReviewsLabel(hostRef.current);
          }
        }}
      />
    </section>
  );
}
