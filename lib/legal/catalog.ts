import { type Locale } from "@/lib/i18n/config";

export const legalSlugs = [
  "preliminary-information",
  "distance-sales-agreement",
  "cancellation-refund-policy",
  "privacy-policy",
] as const;

export type LegalSlug = (typeof legalSlugs)[number];

export function isLegalSlug(value: string): value is LegalSlug {
  return (legalSlugs as readonly string[]).includes(value);
}

export function legalPath(slug: LegalSlug) {
  return `/legal/${slug}`;
}

export const legalNavLabels: Record<
  Locale,
  Record<LegalSlug, string>
> = {
  tr: {
    "preliminary-information": "Ön Bilgilendirme Formu",
    "distance-sales-agreement": "Mesafeli Hizmet Satış Sözleşmesi",
    "cancellation-refund-policy": "İptal ve İade Politikası",
    "privacy-policy": "Gizlilik Politikası ve Kişisel Verilerin Korunması",
  },
  en: {
    "preliminary-information": "Pre-Information Form",
    "distance-sales-agreement": "Distance Sales Agreement",
    "cancellation-refund-policy": "Cancellation and Refund Policy",
    "privacy-policy": "Privacy Policy and Personal Data Protection",
  },
  ru: {
    "preliminary-information": "Форма предварительной информации",
    "distance-sales-agreement": "Договор дистанционной продажи услуг",
    "cancellation-refund-policy": "Политика отмены и возврата",
    "privacy-policy": "Политика конфиденциальности и защита персональных данных",
  },
};
