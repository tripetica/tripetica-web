import { quotePanelCopy } from "@/lib/contact/quote-copy";
import {
  contactDisplayNumbers,
  contactLinks,
  whatsappQuoteHref,
} from "@/lib/contact/links";
import { type Locale } from "@/lib/i18n/config";

export type ContactChannelId = "whatsapp" | "telegram" | "viber" | "phone";

export type ContactChannelConfig = {
  id: ContactChannelId;
  href: string;
  name: string;
  number: string;
  aria: string;
  external: boolean;
};

export function contactChannelsForLocale(
  locale: Locale,
  options?: { whatsappPrefillQuote?: boolean },
): ContactChannelConfig[] {
  const copy = quotePanelCopy[locale];
  const whatsappHref = options?.whatsappPrefillQuote
    ? whatsappQuoteHref(copy.whatsappMessage)
    : contactLinks.whatsapp;

  return [
    {
      id: "whatsapp",
      href: whatsappHref,
      name: copy.whatsapp,
      number: contactDisplayNumbers.messaging,
      aria: copy.whatsappAria,
      external: true,
    },
    {
      id: "telegram",
      href: contactLinks.telegram,
      name: copy.telegram,
      number: contactDisplayNumbers.messaging,
      aria: copy.telegramAria,
      external: true,
    },
    {
      id: "viber",
      href: contactLinks.viber,
      name: copy.viber,
      number: contactDisplayNumbers.messaging,
      aria: copy.viberAria,
      external: false,
    },
    {
      id: "phone",
      href: contactLinks.phone,
      name: copy.call,
      number: contactDisplayNumbers.phone,
      aria: copy.callAria,
      external: false,
    },
  ];
}
