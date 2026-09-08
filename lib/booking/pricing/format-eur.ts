import { type Locale } from "@/lib/i18n/config";

export const DISPLAY_CURRENCIES = ["USD", "EUR", "TRY", "RUB", "GBP"] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = "USD";

export const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  USD: "$",
  EUR: "€",
  TRY: "₺",
  RUB: "₽",
  GBP: "£",
};

export function isDisplayCurrency(value: string | null | undefined): value is DisplayCurrency {
  return DISPLAY_CURRENCIES.some((code) => code === value?.trim());
}

export function normalizeDisplayCurrency(
  value: string | null | undefined,
): DisplayCurrency {
  const trimmed = value?.trim();
  return isDisplayCurrency(trimmed) ? trimmed : DEFAULT_DISPLAY_CURRENCY;
}

function numberLocale(locale: Locale) {
  if (locale === "ru") {
    return "ru-RU";
  }
  if (locale === "tr") {
    return "tr-TR";
  }
  return "en-GB";
}

export function formatAmountDigits(amount: number, locale: Locale): string {
  if (!Number.isFinite(amount)) {
    return "0";
  }
  const negative = amount < 0;
  const abs = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const decimal = locale === "en" ? "." : ",";
  const digits =
    frac === 0 ? String(whole) : `${whole}${decimal}${String(frac).padStart(2, "0")}`;
  return `${negative ? "−" : ""}${digits}`;
}

export function formatRateDigits(amount: number, locale: Locale): string {
  if (!Number.isFinite(amount)) {
    return "0";
  }
  return new Intl.NumberFormat(numberLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(amount);
}

export function formatEurAmount(amount: number, locale: Locale): string {
  if (!Number.isFinite(amount)) {
    return "—";
  }
  return `${formatAmountDigits(amount, locale)} €`;
}

export function formatCurrencyPill(
  code: DisplayCurrency,
  amount: number | null,
  locale: Locale,
) {
  const symbol = CURRENCY_SYMBOLS[code];
  if (amount === null || !Number.isFinite(amount)) {
    return `${symbol} —`;
  }
  const integer = code === "RUB";
  const tryAmount = code === "TRY";
  const formatted = new Intl.NumberFormat(numberLocale(locale), {
    minimumFractionDigits: integer ? 0 : tryAmount ? 0 : 2,
    maximumFractionDigits: integer ? 0 : 2,
    useGrouping: integer || tryAmount,
  }).format(amount);
  return `${symbol} ${formatted}`;
}

export type CurrencyTotalView = {
  code: DisplayCurrency;
  amount: number | null;
};

export function currencyTotalsFromEur(totalEur: number): CurrencyTotalView[] {
  return DISPLAY_CURRENCIES.map((code) => ({
    code,
    amount: code === "EUR" ? totalEur : null,
  }));
}
