export const tripeticaPhoneE164 = "+905332058219";
export const tripeticaMessagingE164 = "+905422058219";
export const tripeticaTelegramUsername = "Tripetica";
export const tripeticaEmail = "info@tripetica.com";

/** E.164 digits only — required by Viber chat deep links (no + prefix). */
export const tripeticaMessagingDigits = tripeticaMessagingE164.replace(/\D/g, "");

function contactBridgeBaseUrl() {
  const raw = (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  )
    .trim()
    .replace(/\/+$/, "");
  return raw;
}

/** Direct deep link for in-app / mobile browser contexts. */
export const viberChatDeepLink = `viber://chat?number=${tripeticaMessagingDigits}`;

/**
 * HTTPS bridge for email clients that block custom URL schemes (e.g. Gmail).
 * Redirects to {@link viberChatDeepLink} via /go/viber.
 */
export function viberChatHrefForEmail() {
  return `${contactBridgeBaseUrl()}/go/viber`;
}

export const contactDisplayNumbers = {
  messaging: "+90 542 205 82 19",
  phone: "+90 533 205 82 19",
} as const;

export const contactLinks = {
  phone: `tel:${tripeticaPhoneE164}`,
  whatsapp: `https://wa.me/${tripeticaMessagingE164.replace("+", "")}`,
  telegram: `https://t.me/${tripeticaTelegramUsername}`,
  viber: viberChatDeepLink,
  email: `mailto:${tripeticaEmail}`,
} as const;

export const contactSectionId = "contact";

export function whatsappQuoteHref(message: string) {
  return `${contactLinks.whatsapp}?text=${encodeURIComponent(message)}`;
}
