import { type Locale } from "@/lib/i18n/config";

export const PARTNER_DRIVER_LANGUAGE_CODES = [
  "tr",
  "en",
  "ru",
  "ar",
  "de",
  "fr",
  "es",
  "it",
  "az",
  "fa",
  "nl",
  "pl",
  "uk",
  "pt",
  "zh",
  "ja",
  "ko",
  "hi",
  "ur",
  "he",
  "sv",
  "no",
  "da",
  "fi",
  "el",
  "ro",
  "bg",
  "cs",
  "hu",
  "th",
  "id",
  "ka",
  "hy",
  "sq",
  "bs",
  "hr",
  "sr",
  "kk",
] as const;

export type PartnerDriverLanguageCode = (typeof PARTNER_DRIVER_LANGUAGE_CODES)[number];

const LABELS: Record<PartnerDriverLanguageCode, Record<Locale, string>> = {
  tr: { tr: "Türkçe", en: "Turkish", ru: "Турецкий" },
  en: { tr: "İngilizce", en: "English", ru: "Английский" },
  ru: { tr: "Rusça", en: "Russian", ru: "Русский" },
  ar: { tr: "Arapça", en: "Arabic", ru: "Арабский" },
  de: { tr: "Almanca", en: "German", ru: "Немецкий" },
  fr: { tr: "Fransızca", en: "French", ru: "Французский" },
  es: { tr: "İspanyolca", en: "Spanish", ru: "Испанский" },
  it: { tr: "İtalyanca", en: "Italian", ru: "Итальянский" },
  az: { tr: "Azerbaycan dili", en: "Azerbaijani", ru: "Азербайджанский" },
  fa: { tr: "Farsça", en: "Persian", ru: "Персидский" },
  nl: { tr: "Hollandaca", en: "Dutch", ru: "Нидерландский" },
  pl: { tr: "Lehçe", en: "Polish", ru: "Польский" },
  uk: { tr: "Ukraynaca", en: "Ukrainian", ru: "Украинский" },
  pt: { tr: "Portekizce", en: "Portuguese", ru: "Португальский" },
  zh: { tr: "Çince", en: "Chinese", ru: "Китайский" },
  ja: { tr: "Japonca", en: "Japanese", ru: "Японский" },
  ko: { tr: "Korece", en: "Korean", ru: "Корейский" },
  hi: { tr: "Hintçe", en: "Hindi", ru: "Хинди" },
  ur: { tr: "Urduca", en: "Urdu", ru: "Урду" },
  he: { tr: "İbranice", en: "Hebrew", ru: "Иврит" },
  sv: { tr: "İsveççe", en: "Swedish", ru: "Шведский" },
  no: { tr: "Norveççe", en: "Norwegian", ru: "Норвежский" },
  da: { tr: "Danca", en: "Danish", ru: "Датский" },
  fi: { tr: "Fince", en: "Finnish", ru: "Финский" },
  el: { tr: "Yunanca", en: "Greek", ru: "Греческий" },
  ro: { tr: "Rumence", en: "Romanian", ru: "Румынский" },
  bg: { tr: "Bulgarca", en: "Bulgarian", ru: "Болгарский" },
  cs: { tr: "Çekçe", en: "Czech", ru: "Чешский" },
  hu: { tr: "Macarca", en: "Hungarian", ru: "Венгерский" },
  th: { tr: "Tayca", en: "Thai", ru: "Тайский" },
  id: { tr: "Endonezce", en: "Indonesian", ru: "Индонезийский" },
  ka: { tr: "Gürcüce", en: "Georgian", ru: "Грузинский" },
  hy: { tr: "Ermenice", en: "Armenian", ru: "Армянский" },
  sq: { tr: "Arnavutça", en: "Albanian", ru: "Албанский" },
  bs: { tr: "Boşnakça", en: "Bosnian", ru: "Боснийский" },
  hr: { tr: "Hırvatça", en: "Croatian", ru: "Хорватский" },
  sr: { tr: "Sırpça", en: "Serbian", ru: "Сербский" },
  kk: { tr: "Kazakça", en: "Kazakh", ru: "Казахский" },
};

export function isPartnerDriverLanguageCode(
  value: string,
): value is PartnerDriverLanguageCode {
  return (PARTNER_DRIVER_LANGUAGE_CODES as readonly string[]).includes(value);
}

export function normalizePartnerDriverLanguageCodes(values: readonly string[]) {
  const seen = new Set<PartnerDriverLanguageCode>();
  for (const raw of values) {
    const code = raw.trim().toLowerCase();
    if (isPartnerDriverLanguageCode(code)) {
      seen.add(code);
    }
  }
  return PARTNER_DRIVER_LANGUAGE_CODES.filter((code) => seen.has(code));
}

export function partnerDriverLanguageLabel(
  code: string,
  locale: Locale,
) {
  if (!isPartnerDriverLanguageCode(code)) {
    return code;
  }
  return LABELS[code][locale];
}

export function partnerDriverLanguageOptions(locale: Locale) {
  return PARTNER_DRIVER_LANGUAGE_CODES.map((code) => ({
    code,
    label: LABELS[code][locale],
  }));
}

export function formatPartnerDriverLanguages(
  codes: readonly string[],
  locale: Locale,
  maxVisible = 2,
) {
  const normalized = normalizePartnerDriverLanguageCodes(codes);
  if (normalized.length === 0) {
    return "—";
  }
  const labels = normalized.map((code) => LABELS[code][locale]);
  if (labels.length <= maxVisible) {
    return labels.join(", ");
  }
  const visible = labels.slice(0, maxVisible).join(", ");
  return `${visible} +${labels.length - maxVisible}`;
}

export function formatPartnerDriverLanguagesFull(
  codes: readonly string[],
  locale: Locale,
) {
  const normalized = normalizePartnerDriverLanguageCodes(codes);
  if (normalized.length === 0) {
    return "—";
  }
  return normalized.map((code) => LABELS[code][locale]).join(" · ");
}

export function partnerDriverLanguageSearchHaystack(
  code: PartnerDriverLanguageCode,
) {
  return [code, LABELS[code].tr, LABELS[code].en, LABELS[code].ru]
    .join(" ")
    .toLocaleLowerCase("tr");
}
