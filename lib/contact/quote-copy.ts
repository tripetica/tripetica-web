import { type Locale } from "@/lib/i18n/config";

export type QuotePanelCopy = {
  title: string;
  lead: string;
  close: string;
  whatsapp: string;
  telegram: string;
  viber: string;
  call: string;
  whatsappAria: string;
  telegramAria: string;
  viberAria: string;
  callAria: string;
  whatsappMessage: string;
};

export const quotePanelCopy: Record<Locale, QuotePanelCopy> = {
  tr: {
    title: "Teklif almak için bize ulaşın",
    lead: "Seyahat planınızı ve gitmek istediğiniz yerleri bize iletin, size özel tur ve ulaşım teklifi hazırlayalım.",
    close: "Paneli kapat",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
    call: "Ara",
    whatsappAria: "WhatsApp üzerinden iletişime geç",
    telegramAria: "Telegram üzerinden iletişime geç",
    viberAria: "Viber üzerinden iletişime geç",
    callAria: "Telefonla ara",
    whatsappMessage:
      "Merhaba, Türkiye'de özel bir tur için teklif almak istiyorum.",
  },
  en: {
    title: "Get in touch for a quote",
    lead: "Tell us where you want to go and how you would like to travel. We will prepare a private tour and transfer offer around your plan.",
    close: "Close panel",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
    call: "Call",
    whatsappAria: "Contact us on WhatsApp",
    telegramAria: "Contact us on Telegram",
    viberAria: "Contact us on Viber",
    callAria: "Call us",
    whatsappMessage:
      "Hello, I would like to get a quote for a private tour in Türkiye.",
  },
  ru: {
    title: "Свяжитесь с нами для предложения",
    lead: "Напишите, куда хотите поехать и как видите поездку — подготовим индивидуальное предложение по туру и трансферу.",
    close: "Закрыть панель",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
    call: "Позвонить",
    whatsappAria: "Написать в WhatsApp",
    telegramAria: "Написать в Telegram",
    viberAria: "Написать в Viber",
    callAria: "Позвонить",
    whatsappMessage:
      "Здравствуйте, я хотел(а) бы получить предложение на индивидуальный тур по Турции.",
  },
  ar: {
    title: "تواصل معنا للحصول على عرض سعر",
    lead: "أخبرنا بالوجهات التي ترغب في زيارتها وكيف تفضّل السفر. سنعدّ لك عرضًا خاصًا للجولات والنقل وفق خطتك.",
    close: "إغلاق اللوحة",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
    call: "اتصال",
    whatsappAria: "التواصل عبر WhatsApp",
    telegramAria: "التواصل عبر Telegram",
    viberAria: "التواصل عبر Viber",
    callAria: "الاتصال بنا",
    whatsappMessage:
      "مرحبًا، أرغب في الحصول على عرض سعر لجولة خاصة في Türkiye.",
  },
};
