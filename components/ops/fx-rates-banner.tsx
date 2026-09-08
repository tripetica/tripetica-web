import { type Locale } from "@/lib/i18n/config";
import { formatOpsDateTime } from "@/lib/ops/format";
import { type OpsCopy } from "@/lib/ops/copy";
import { type OpsFxSummary } from "@/lib/ops/fx-summary";

function formatFxRate(value: string, locale: Locale) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return "—";
  }
  const numberLocale = locale === "tr" ? "tr-TR" : locale === "ru" ? "ru-RU" : "en-GB";
  return new Intl.NumberFormat(numberLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    useGrouping: false,
  }).format(n);
}

type OpsFxRatesBannerProps = {
  locale: Locale;
  copy: OpsCopy;
  summary: OpsFxSummary | null;
};

export function OpsFxRatesBanner({ locale, copy, summary }: OpsFxRatesBannerProps) {
  if (!summary) {
    return (
      <p className="ops-fx-banner" aria-live="polite">
        {copy.fxRatesUnavailable}
      </p>
    );
  }
  const lastFetch = formatOpsDateTime(summary.fetchedAt, locale);
  const providerNext = formatOpsDateTime(summary.providerNextUpdateAt, locale);
  const parts = [
    `EUR/USD ${formatFxRate(summary.usd, locale)}`,
    `EUR/TRY ${formatFxRate(summary.tryRate, locale)}`,
    `EUR/RUB ${formatFxRate(summary.rub, locale)}`,
    `EUR/GBP ${formatFxRate(summary.gbp, locale)}`,
  ];
  return (
    <div className="ops-fx-banner" aria-live="polite" title={copy.fxRatesTitle}>
      <span className="ops-fx-chip ops-fx-chip-provider">
        <span className="ops-fx-chip-title">{copy.fxRatesProviderLabel}</span>
        <span className="ops-fx-chip-line">
          <span className="ops-fx-chip-label">{copy.fxRatesLastFetch}:</span>{" "}
          <span className="ops-fx-chip-value">{lastFetch}</span>
        </span>
        <span className="ops-fx-chip-line">
          <span className="ops-fx-chip-label">{copy.fxRatesNextRefresh}:</span>{" "}
          <span className="ops-fx-chip-value">{providerNext}</span>
        </span>
      </span>
      <span className="ops-fx-banner-rates">{parts.join(" · ")}</span>
    </div>
  );
}
