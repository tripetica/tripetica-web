"use client";

import { type Locale } from "@/lib/i18n/config";

type ReviewLabWidgetProps = {
  locale: Locale;
};

export function ReviewLabWidget({ locale }: ReviewLabWidgetProps) {
  const label = locale === "tr" ? "Yorumlar" : "Reviews";

  return (
    <section className="review-lab-section" aria-label={label}>
      <div className="review-lab-host">
        <iframe
          title={label}
          src="/widgets/review-lab.html"
          className="review-lab-iframe"
          loading="lazy"
        />
      </div>
    </section>
  );
}
