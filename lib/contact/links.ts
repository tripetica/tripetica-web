export const tripeticaPhoneE164 = "+905332058219";
export const tripeticaMessagingE164 = "+905422058219";
export const tripeticaTelegramUsername = "Tripetica";

export const contactLinks = {
  phone: `tel:${tripeticaPhoneE164}`,
  whatsapp: `https://wa.me/${tripeticaMessagingE164.replace("+", "")}`,
  telegram: `https://t.me/${tripeticaTelegramUsername}`,
  viber: `viber://chat?number=${encodeURIComponent(tripeticaMessagingE164)}`,
} as const;
