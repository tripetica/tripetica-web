export const tripeticaPhoneE164 = "+905332058219";
export const tripeticaMessagingE164 = "+905422058219";
export const tripeticaTelegramUsername = "Tripetica";
export const tripeticaEmail = "info@tripetica.com";

export const contactDisplayNumbers = {
  messaging: "+90 542 205 82 19",
  phone: "+90 533 205 82 19",
} as const;

export const contactLinks = {
  phone: `tel:${tripeticaPhoneE164}`,
  whatsapp: `https://wa.me/${tripeticaMessagingE164.replace("+", "")}`,
  telegram: `https://t.me/${tripeticaTelegramUsername}`,
  viber: `viber://chat?number=${encodeURIComponent(tripeticaMessagingE164)}`,
  email: `mailto:${tripeticaEmail}`,
} as const;

export const contactSectionId = "contact";

export function whatsappQuoteHref(message: string) {
  return `${contactLinks.whatsapp}?text=${encodeURIComponent(message)}`;
}
