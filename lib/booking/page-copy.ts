import { type Locale } from "@/lib/i18n/config";

export const bookingPageCopy: Record<
  Locale,
  {
    metaTitle: string;
    metaDescription: string;
    back: string;
    sidebarLabel: string;
    contentLabel: string;
  }
> = {
  tr: {
    metaTitle: "Rezervasyon | Tripetica",
    metaDescription: "Tripetica rezervasyon.",
    back: "Geri",
    sidebarLabel: "Rezervasyon seçimleri",
    contentLabel: "Rezervasyon içeriği",
  },
  en: {
    metaTitle: "Booking | Tripetica",
    metaDescription: "Tripetica booking.",
    back: "Back",
    sidebarLabel: "Booking selections",
    contentLabel: "Booking content",
  },
  ru: {
    metaTitle: "Бронирование | Tripetica",
    metaDescription: "Бронирование Tripetica.",
    back: "Назад",
    sidebarLabel: "Параметры бронирования",
    contentLabel: "Содержание бронирования",
  },
};
