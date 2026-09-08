import { type Locale } from "@/lib/i18n/config";

/** Copy for the checkout phone field. Dial defaults come from locale-defaults. */
export const phoneFieldCopy: Record<
  Locale,
  {
    selectCode: string;
    phonePlaceholder: string;
    selectCodeFirst: string;
    codeSearchLabel: string;
  }
> = {
  tr: {
    selectCode: "Kod seç",
    phonePlaceholder: "Telefon numaranız",
    selectCodeFirst: "Önce ülke kodunu seçin",
    codeSearchLabel: "Ülke ara",
  },
  en: {
    selectCode: "Select code",
    phonePlaceholder: "Phone number",
    selectCodeFirst: "Select the country code first",
    codeSearchLabel: "Search country",
  },
  ru: {
    selectCode: "Выберите код",
    phonePlaceholder: "Номер телефона",
    selectCodeFirst: "Сначала выберите код страны",
    codeSearchLabel: "Поиск страны",
  },
};
