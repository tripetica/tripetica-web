import {
  contactDisplayNumbers,
  contactLinks,
  viberChatHrefForEmail,
} from "@/lib/contact/links";
import { type Locale } from "@/lib/i18n/config";
import { reservationMailCopy } from "@/lib/mail/reservation-copy";

const contactLinkStyle =
  "color:#4a8fd4;text-decoration:none;font-size:14px;line-height:1.8;display:inline-block;";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reservationMailContactRows(locale: Locale) {
  const copy = reservationMailCopy[locale];
  return [
    {
      href: contactLinks.phone,
      label: `${copy.contactPhoneLabel}: ${contactDisplayNumbers.phone}`,
    },
    {
      href: contactLinks.whatsapp,
      label: `${copy.contactWhatsappLabel}: ${contactDisplayNumbers.messaging}`,
    },
    {
      href: contactLinks.telegram,
      label: `${copy.contactTelegramLabel}: ${copy.contactTelegramHandle}`,
    },
    {
      href: viberChatHrefForEmail(),
      label: `${copy.contactViberLabel}: ${contactDisplayNumbers.messaging}`,
    },
  ] as const;
}

export function buildReservationMailContactSectionHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const rows = reservationMailContactRows(locale)
    .map(
      (row) =>
        `<a href="${escapeHtml(row.href)}" style="${contactLinkStyle}">${escapeHtml(row.label)}</a>`,
    )
    .join("<br />");

  return `
      <hr style="border:none;border-top:1px solid #d8dee8;margin:28px 0;" />
      <p style="margin:0 0 12px;font-size:16px;color:#142e5c;font-weight:600;">${escapeHtml(copy.contactIntro)}</p>
      <p style="margin:0;color:#172033;font-size:14px;line-height:1.8;">
        ${rows}
      </p>`;
}

export function buildReservationMailContactSectionText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const lines = reservationMailContactRows(locale).map(
    (row) => `${row.label} (${row.href})`,
  );
  return `${copy.contactIntro}\n${lines.join("\n")}`;
}
