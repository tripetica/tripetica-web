export const EXTERNAL_PARTNER_PAYOUT_RATE = 0.7;

export function partnerPayoutAmount(input: {
  total: number | null;
  isPrimaryPartner: boolean;
}): number | null {
  if (input.total === null || !Number.isFinite(input.total)) {
    return null;
  }
  if (input.isPrimaryPartner) {
    return roundMoney(input.total);
  }
  return roundMoney(input.total * EXTERNAL_PARTNER_PAYOUT_RATE);
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatPartnerMoney(
  amount: number | null,
  currency: string | null,
  locale: string,
) {
  if (amount === null) {
    return "—";
  }
  const formatted = new Intl.NumberFormat(numberLocale(locale), {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(amount);
  const code = currency?.trim();
  return code ? `${formatted} ${code}` : formatted;
}

function numberLocale(locale: string) {
  if (locale === "ru") {
    return "ru-RU";
  }
  if (locale === "tr") {
    return "tr-TR";
  }
  return "en-GB";
}
