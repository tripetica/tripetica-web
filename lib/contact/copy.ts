import { type Locale } from "@/lib/i18n/config";

export type ContactLauncherCopy = {
  launcher: string;
  phone: string;
  phoneTooltip: string;
  whatsapp: string;
  telegram: string;
  viber: string;
};

export const contactLauncherCopy: Record<Locale, ContactLauncherCopy> = {
  en: {
    launcher: "Contact Tripetica",
    phone: "Call Tripetica",
    phoneTooltip: "Call",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
  },
  ru: {
    launcher: "Связаться с Tripetica",
    phone: "Позвонить Tripetica",
    phoneTooltip: "Позвонить",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    viber: "Viber",
  },
};
