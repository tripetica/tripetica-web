"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckoutSuccessTourGuide } from "@/components/booking/checkout-success-tour-guide";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type Locale } from "@/lib/i18n/config";

type CheckoutSuccessPanelProps = {
  locale: Locale;
  reservationCode: string;
  showTourGuideInfo?: boolean;
  updatedViaEdit?: boolean;
};

function shouldScrollSuccessIntoView(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const topLimit = Math.min(120, viewportHeight * 0.22);
  const titleVisible =
    rect.top >= topLimit - 8 && rect.top <= viewportHeight * 0.45;
  const mostlyOnScreen =
    rect.top >= 0 && rect.bottom <= viewportHeight && rect.height > 0;
  return !(titleVisible || mostlyOnScreen);
}

export function CheckoutSuccessPanel({
  locale,
  reservationCode,
  showTourGuideInfo = false,
  updatedViaEdit = false,
}: CheckoutSuccessPanelProps) {
  const copy = checkoutCopy[locale];
  const title = updatedViaEdit ? copy.successUpdatedTitle : copy.successTitle;
  const panelRef = useRef<HTMLElement | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    const node = panelRef.current;
    if (!node) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (!shouldScrollSuccessIntoView(node)) {
        return;
      }
      node.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reservationCode]);

  async function downloadVoucher() {
    if (pdfLoading) {
      return;
    }
    setPdfError(null);
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({ locale });
      const response = await fetch(`/api/booking/voucher-pdf?${params.toString()}`);
      if (!response.ok) {
        setPdfError(copy.voucherPdfError);
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename="([^"]+)"/)?.[1] ??
        `Tripetica-${reservationCode}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setPdfError(copy.voucherPdfError);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <section
      ref={panelRef}
      className="checkout-card glass-surface checkout-success-panel"
      aria-labelledby="checkout-success-title"
    >
      <div className="checkout-success-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 id="checkout-success-title" className="checkout-success-title">
        {title}
      </h2>
      <p className="checkout-success-code-label">{copy.successCodeLabel}</p>
      <p
        className={`checkout-success-code ltr-isolate${showTourGuideInfo ? " checkout-success-code--with-guide" : ""}`}
        dir="ltr"
      >
        {reservationCode}
      </p>
      {showTourGuideInfo ? <CheckoutSuccessTourGuide locale={locale} /> : null}
      {pdfError ? <p className="checkout-success-error">{pdfError}</p> : null}
      <div className="checkout-success-actions">
        <button
          type="button"
          className="booking-cta checkout-success-primary"
          disabled={pdfLoading}
          aria-busy={pdfLoading}
          onClick={() => void downloadVoucher()}
        >
          {pdfLoading ? copy.downloadingVoucherPdf : copy.downloadVoucherPdf}
        </button>
        <Link href={`/${locale}`} className="booking-cta-secondary checkout-success-secondary">
          {copy.backToHome}
        </Link>
      </div>
    </section>
  );
}
