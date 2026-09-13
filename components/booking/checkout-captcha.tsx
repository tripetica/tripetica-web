"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { type Locale } from "@/lib/i18n/config";

type CheckoutCaptchaProps = {
  locale: Locale;
  invalid?: boolean;
  onTokenChange: (token: string | null) => void;
};

type GoogleRecaptcha = {
  ready: (callback: () => void) => void;
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      hl: string;
      theme: "light" | "dark";
    },
  ) => number;
  reset: (widgetId?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: GoogleRecaptcha;
  }
}

function googleHl(locale: Locale) {
  if (locale === "tr") {
    return "tr";
  }
  if (locale === "ru") {
    return "ru";
  }
  if (locale === "ar") {
    return "ar";
  }
  return "en";
}

export function CheckoutCaptcha({ locale, invalid = false, onTokenChange }: CheckoutCaptchaProps) {
  const bundledKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";
  const [siteKey, setSiteKey] = useState(bundledKey);
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const started = useRef(false);
  const onTokenChangeRef = useRef(onTokenChange);

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (bundledKey) {
      return;
    }
    let cancelled = false;
    fetch(`/api/booking/captcha-config?locale=${locale}`)
      .then((response) => response.json())
      .then((payload: { provider?: string; siteKey?: string }) => {
        if (cancelled || payload.provider === "yandex") {
          return;
        }
        const next = payload.siteKey?.trim() ?? "";
        if (next) {
          setSiteKey(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bundledKey, locale]);

  const renderWidget = useCallback(() => {
    const host = hostRef.current;
    if (!siteKey || !host || started.current || !window.grecaptcha) {
      return;
    }
    started.current = true;
    window.grecaptcha.ready(() => {
      if (!hostRef.current || widgetId.current !== null || !window.grecaptcha) {
        return;
      }
      widgetId.current = window.grecaptcha.render(hostRef.current, {
        sitekey: siteKey,
        hl: googleHl(locale),
        theme: "light",
        callback: (token) => onTokenChangeRef.current(token),
        "expired-callback": () => onTokenChangeRef.current(null),
        "error-callback": () => onTokenChangeRef.current(null),
      });
    });
  }, [locale, siteKey]);

  useEffect(() => {
    return () => {
      onTokenChangeRef.current(null);
      const id = widgetId.current;
      widgetId.current = null;
      started.current = false;
      if (id !== null) {
        window.grecaptcha?.reset(id);
      }
    };
  }, []);

  useEffect(() => {
    if (!siteKey) {
      return;
    }
    renderWidget();
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      renderWidget();
      if (started.current || attempts > 40) {
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [renderWidget, siteKey]);

  return (
    <div
      id="checkout-captcha"
      className={`checkout-captcha${invalid ? " is-invalid" : ""}`}
      data-captcha-provider="google"
      data-captcha-configured={siteKey ? "true" : "false"}
    >
      <div ref={hostRef} className="checkout-captcha-host" />
      {siteKey ? (
        <Script
          id={`checkout-captcha-google-${googleHl(locale)}`}
          src={`https://www.google.com/recaptcha/api.js?hl=${googleHl(locale)}&render=explicit`}
          strategy="afterInteractive"
          onReady={() => renderWidget()}
        />
      ) : null}
    </div>
  );
}
