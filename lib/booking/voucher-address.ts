import { type Locale } from "@/lib/i18n/config";

const TURKEY_ALIASES = ["Türkiye", "Turkiye", "Turkey", "Турция"] as const;

/** Display label for Turkey on customer vouchers (EN uses official “Türkiye”). */
export function voucherTurkeyCountryLabel(locale: Locale): string {
  return locale === "ru" ? "Турция" : "Türkiye";
}

/**
 * Normalize Turkey country name fragments in a display address to the voucher locale.
 * Does not rewrite street/city text — only known country-name aliases.
 */
export function localizeVoucherAddressCountry(
  address: string,
  locale: Locale,
): string {
  const trimmed = address.trim();
  if (!trimmed) {
    return "";
  }
  const label = voucherTurkeyCountryLabel(locale);
  let next = trimmed;

  // Prefer trailing ", Country" (typical Places formatted_address).
  const trailing = /^(.*?)(?:,\s*)?(Türkiye|Turkiye|Turkey|Турция)\s*$/iu.exec(next);
  if (trailing) {
    const prefix = trailing[1].trim().replace(/,\s*$/, "");
    next = prefix ? `${prefix}, ${label}` : label;
  }

  for (const alias of TURKEY_ALIASES) {
    if (alias === label) {
      continue;
    }
    next = next.split(alias).join(label);
  }
  return next;
}
