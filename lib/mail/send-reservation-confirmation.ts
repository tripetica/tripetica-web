import "server-only";

import { accountCopy } from "@/lib/account/copy";
import {
  accountPaymentMethodLabel,
  accountPaymentStatusLabel,
} from "@/lib/account/reservation-labels";
import { BOOKING_TIME_ZONE } from "@/lib/booking/istanbul-time";
import { pickupAirportCode } from "@/lib/booking/meet-and-greet";
import {
  findReservationVoucherById,
  voucherPdfFilename,
} from "@/lib/booking/reservation-voucher-access";
import { buildReservationVoucherPdf } from "@/lib/booking/reservation-voucher-pdf";
import { query } from "@/lib/db/postgres";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  buildReservationMailContactSectionHtml,
  buildReservationMailContactSectionText,
} from "@/lib/mail/reservation-contact";
import {
  aytMeetPhotoUrl,
  aytMeetVideoUrl,
  istMeetPhotoUrl,
  istMeetVideoUrl,
  istNoMeetStepUrls,
  sawMeetPhotoUrl,
  sawMeetVideoUrl,
  sawNoMeetPhotoUrl,
} from "@/lib/mail/reservation-assets";
import { reservationMailCopy } from "@/lib/mail/reservation-copy";
import {
  reservationMailFromAddress,
  sendReservationSmtpMail,
} from "@/lib/mail/smtp";
import { shouldShowPaymentStatus } from "@/lib/booking/reservation-output-visibility";

type ReservationMailRow = {
  id: string;
  reservation_code: string;
  locale: string | null;
  customer_email: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  pickup_at: Date | null;
  payment_method: string | null;
  payment_status: string | null;
  meet_and_greet: boolean | null;
  service_type: string | null;
  tour_code: string | null;
  pickup_airport_code: string | null;
  pickup_location_type: string | null;
  pickup_place_id: string | null;
  reservation_confirmation_email_sent_at: Date | null;
};

function reservationMailFrom() {
  return reservationMailFromAddress();
}

function intlLocale(locale: Locale) {
  if (locale === "ru") return "ru-RU";
  if (locale === "tr") return "tr-TR";
  return "en-GB";
}

function formatTransferDateTime(pickupAt: Date, locale: Locale) {
  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: BOOKING_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(pickupAt);
  const time = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: BOOKING_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(pickupAt);
  return `${date}, ${time}`;
}

function customerDisplayName(first: string | null, last: string | null) {
  return [first?.trim(), last?.trim()].filter(Boolean).join(" ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showIstMeetSection(row: ReservationMailRow) {
  if (row.meet_and_greet !== true) {
    return false;
  }
  return (
    pickupAirportCode({
      airportCode: row.pickup_airport_code,
      locationType: row.pickup_location_type,
      placeId: row.pickup_place_id,
    }) === "IST"
  );
}

function showIstNoMeetSection(row: ReservationMailRow) {
  if (row.meet_and_greet !== false) {
    return false;
  }
  return (
    pickupAirportCode({
      airportCode: row.pickup_airport_code,
      locationType: row.pickup_location_type,
      placeId: row.pickup_place_id,
    }) === "IST"
  );
}

function showSawMeetSection(row: ReservationMailRow) {
  if (row.meet_and_greet !== true) {
    return false;
  }
  return (
    pickupAirportCode({
      airportCode: row.pickup_airport_code,
      locationType: row.pickup_location_type,
      placeId: row.pickup_place_id,
    }) === "SAW"
  );
}

function showSawNoMeetSection(row: ReservationMailRow) {
  if (row.meet_and_greet !== false) {
    return false;
  }
  return (
    pickupAirportCode({
      airportCode: row.pickup_airport_code,
      locationType: row.pickup_location_type,
      placeId: row.pickup_place_id,
    }) === "SAW"
  );
}

function showAytMeetSection(row: ReservationMailRow) {
  if (row.meet_and_greet !== true) {
    return false;
  }
  return (
    pickupAirportCode({
      airportCode: row.pickup_airport_code,
      locationType: row.pickup_location_type,
      placeId: row.pickup_place_id,
    }) === "AYT"
  );
}

type DetailRow = { label: string; value: string; detail?: string };

function detailRowsHtml(rows: DetailRow[]) {
  return rows
    .map(
      (row) => `
      <tr>
        <td style="padding:8px 0;color:#667085;font-size:14px;vertical-align:top;width:42%;">${escapeHtml(row.label)}</td>
        <td style="padding:8px 0;color:#172033;font-size:14px;font-weight:600;vertical-align:top;">
          ${escapeHtml(row.value)}
          ${row.detail ? `<div style="margin-top:3px;color:#667085;font-size:12px;font-weight:400;line-height:1.4;">${escapeHtml(row.detail)}</div>` : ""}
        </td>
      </tr>`,
    )
    .join("");
}

function detailRowsText(rows: DetailRow[]) {
  return rows
    .map(
      (row) =>
        `${row.label}: ${row.value}${row.detail ? `\n  ${row.detail}` : ""}`,
    )
    .join("\n");
}

function buildInternetSectionHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const paragraphs = copy.internetParagraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  return `
      <hr style="border:none;border-top:1px solid #d8dee8;margin:28px 0;" />
      <h2 style="margin:0 0 12px;font-size:18px;color:#142e5c;">${escapeHtml(copy.internetSectionTitle)}</h2>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.internetIntro)}</p>
      ${paragraphs}`;
}

function buildInternetSectionText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  return `
${copy.internetSectionTitle}
${copy.internetIntro}
${copy.internetParagraphs.join("\n")}`;
}

function buildAytInternetSectionHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const paragraphs = [
    ...copy.internetParagraphs.slice(0, -1),
    copy.aytInternetClosing,
  ]
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  return `
      <hr style="border:none;border-top:1px solid #d8dee8;margin:28px 0;" />
      <h2 style="margin:0 0 12px;font-size:18px;color:#142e5c;">${escapeHtml(copy.internetSectionTitle)}</h2>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.internetIntro)}</p>
      ${paragraphs}`;
}

function buildAytInternetSectionText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const paragraphs = [
    ...copy.internetParagraphs.slice(0, -1),
    copy.aytInternetClosing,
  ];
  return `
${copy.internetSectionTitle}
${copy.internetIntro}
${paragraphs.join("\n")}`;
}

function buildIstMeetSectionHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const photoUrl = istMeetPhotoUrl();
  const videoUrl = istMeetVideoUrl();
  const [important1, important2] = copy.meetingImportantParagraphs;
  return `
      <hr style="border:none;border-top:1px solid #d8dee8;margin:28px 0;" />
      <h2 style="margin:0 0 12px;font-size:18px;color:#142e5c;">${escapeHtml(copy.meetingSectionTitle)}</h2>
      <p style="margin:0 0 8px;color:#667085;font-size:14px;"><strong style="color:#172033;">${escapeHtml(copy.meetingPointLabel)}:</strong> ${escapeHtml(copy.meetingPointValue)}</p>
      <p style="margin:0 0 16px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.meetingInstructions)}</p>
      <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(copy.meetingPhotoAlt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:8px;margin:0 0 16px;" />
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.meetingVideoIntro)}</p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(videoUrl)}" style="display:inline-block;background:#142e5c;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(copy.meetingVideoCta)}</a>
      </p>
      <h3 style="margin:0 0 8px;font-size:16px;color:#142e5c;">${escapeHtml(copy.meetingImportantTitle)}</h3>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(important1)}</p>
      <p style="margin:0 0 20px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(important2)}</p>`;
}

function buildIstMeetSectionText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const videoUrl = istMeetVideoUrl();
  const [important1, important2] = copy.meetingImportantParagraphs;
  return `

${copy.meetingSectionTitle}
${copy.meetingPointLabel}: ${copy.meetingPointValue}
${copy.meetingInstructions}
${copy.meetingVideoIntro}
${copy.meetingVideoCta}: ${videoUrl}

${copy.meetingImportantTitle}
${important1}
${important2}`;
}

function buildSawMeetSectionHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const photoUrl = sawMeetPhotoUrl();
  const videoUrl = sawMeetVideoUrl();
  const [directions, representative] = copy.sawMeetingInstructions;
  const [important1, important2] = copy.meetingImportantParagraphs;
  return `
      <hr style="border:none;border-top:1px solid #d8dee8;margin:28px 0;" />
      <h2 style="margin:0 0 12px;font-size:18px;color:#142e5c;">${escapeHtml(copy.meetingSectionTitle)}</h2>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.sawMeetingPointValue)}</p>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(directions)}</p>
      <p style="margin:0 0 16px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(representative)}</p>
      <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(copy.sawMeetingPhotoAlt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:8px;margin:0 0 16px;" />
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.sawMeetingVideoIntro)}</p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(videoUrl)}" style="display:inline-block;background:#142e5c;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(copy.meetingVideoCta)}</a>
      </p>
      <h3 style="margin:0 0 8px;font-size:16px;color:#142e5c;">${escapeHtml(copy.meetingImportantTitle)}</h3>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(important1)}</p>
      <p style="margin:0 0 20px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(important2)}</p>`;
}

function buildSawMeetSectionText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const videoUrl = sawMeetVideoUrl();
  const [directions, representative] = copy.sawMeetingInstructions;
  const [important1, important2] = copy.meetingImportantParagraphs;
  return `

${copy.meetingSectionTitle}
${copy.sawMeetingPointValue}
${directions}
${representative}
${copy.sawMeetingVideoIntro}
${copy.meetingVideoCta}: ${videoUrl}

${copy.meetingImportantTitle}
${important1}
${important2}`;
}

function buildAytMeetSectionHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const [directions, representative] = copy.aytMeetingInstructions;
  const [important1, important2] = copy.meetingImportantParagraphs;
  return `
      <hr style="border:none;border-top:1px solid #d8dee8;margin:28px 0;" />
      <h2 style="margin:0 0 12px;font-size:18px;color:#142e5c;">${escapeHtml(copy.meetingSectionTitle)}</h2>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.aytMeetingPointValue)}</p>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(directions)}</p>
      <p style="margin:0 0 16px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(representative)}</p>
      <img src="${escapeHtml(aytMeetPhotoUrl())}" alt="${escapeHtml(copy.aytMeetingPhotoAlt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:8px;margin:0 0 16px;" />
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.sawMeetingVideoIntro)}</p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(aytMeetVideoUrl())}" style="display:inline-block;background:#142e5c;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(copy.meetingVideoCta)}</a>
      </p>
      <h3 style="margin:0 0 8px;font-size:16px;color:#142e5c;">${escapeHtml(copy.meetingImportantTitle)}</h3>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(important1)}</p>
      <p style="margin:0 0 20px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(important2)}</p>`;
}

function buildAytMeetSectionText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const [directions, representative] = copy.aytMeetingInstructions;
  const [important1, important2] = copy.meetingImportantParagraphs;
  return `

${copy.meetingSectionTitle}
${copy.aytMeetingPointValue}
${directions}
${representative}
${copy.sawMeetingVideoIntro}
${copy.meetingVideoCta}: ${aytMeetVideoUrl()}

${copy.meetingImportantTitle}
${important1}
${important2}`;
}

function buildIstNoMeetSectionHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const stepUrls = istNoMeetStepUrls();
  const steps = copy.noMeetSteps
    .map(
      (step, index) => `
      <div style="margin:0 0 ${index === copy.noMeetSteps.length - 1 ? "8px" : "24px"};">
        <h3 style="margin:0 0 6px;font-size:16px;color:#142e5c;">${escapeHtml(step.title)}</h3>
        <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(step.body)}</p>
        <img src="${escapeHtml(stepUrls[index] ?? "")}" alt="${escapeHtml(step.imageAlt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:8px;margin:0;" />
      </div>`,
    )
    .join("");

  return `
      <hr style="border:none;border-top:1px solid #d8dee8;margin:28px 0;" />
      <h2 style="margin:0 0 12px;font-size:18px;color:#142e5c;">${escapeHtml(copy.meetingSectionTitle)}</h2>
      <p style="margin:0 0 8px;color:#667085;font-size:14px;"><strong style="color:#172033;">${escapeHtml(copy.meetingPointLabel)}:</strong> ${escapeHtml(copy.noMeetPointValue)}</p>
      <p style="margin:0 0 20px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.noMeetInstructions)}</p>
      ${steps}`;
}

function buildIstNoMeetSectionText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const stepUrls = istNoMeetStepUrls();
  const steps = copy.noMeetSteps
    .map(
      (step, index) =>
        `${step.title}\n${step.body}\n${stepUrls[index] ?? ""}`,
    )
    .join("\n\n");
  return `

${copy.meetingSectionTitle}
${copy.meetingPointLabel}: ${copy.noMeetPointValue}
${copy.noMeetInstructions}

${steps}`;
}

function buildSawNoMeetSectionHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  return `
      <hr style="border:none;border-top:1px solid #d8dee8;margin:28px 0;" />
      <h2 style="margin:0 0 12px;font-size:18px;color:#142e5c;">${escapeHtml(copy.meetingSectionTitle)}</h2>
      <p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.sawNoMeetPointValue)}</p>
      <p style="margin:0 0 16px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(copy.sawNoMeetInstructions)}</p>
      <img src="${escapeHtml(sawNoMeetPhotoUrl())}" alt="${escapeHtml(copy.sawNoMeetPhotoAlt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:8px;margin:0 0 8px;" />`;
}

function buildSawNoMeetSectionText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  return `

${copy.meetingSectionTitle}
${copy.sawNoMeetPointValue}
${copy.sawNoMeetInstructions}
${sawNoMeetPhotoUrl()}`;
}

function buildIstNoMeetContactNoticeHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const paragraphs = copy.noMeetContactParagraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  return `
      <hr style="border:none;border-top:1px solid #d8dee8;margin:28px 0;" />
      <h2 style="margin:0 0 12px;font-size:18px;color:#142e5c;">${escapeHtml(copy.noMeetContactTitle)}</h2>
      ${paragraphs}`;
}

function buildIstNoMeetContactNoticeText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  return `

${copy.noMeetContactTitle}
${copy.noMeetContactParagraphs.join("\n\n")}`;
}

function buildAytDomesticNoteHtml(locale: Locale) {
  const copy = reservationMailCopy[locale];
  const paragraphs = copy.aytDomesticNoteParagraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;color:#172033;font-size:14px;line-height:1.5;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  return `
      <div style="margin:28px 0 0;padding:16px;border:1px solid #d8dee8;border-radius:8px;background:#f8fafc;">
        <h2 style="margin:0 0 12px;font-size:17px;color:#142e5c;">${escapeHtml(copy.aytDomesticNoteTitle)}</h2>
        ${paragraphs}
      </div>`;
}

function buildAytDomesticNoteText(locale: Locale) {
  const copy = reservationMailCopy[locale];
  return `

${copy.aytDomesticNoteTitle}
${copy.aytDomesticNoteParagraphs.join("\n\n")}`;
}

export function buildConfirmationBodies(input: {
  locale: Locale;
  customerName: string;
  reservationCode: string;
  transferDateTime: string;
  serviceType: string;
  duration: string | null;
  vehicleClass: string;
  vehicleSubtitle: string | null;
  showVehicleClass: boolean;
  pickup: string;
  dropoff: string;
  showDropoff: boolean;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  showPaymentStatus: boolean;
  includeIstMeet: boolean;
  includeSawMeet: boolean;
  includeAytMeet: boolean;
  includeIstNoMeet: boolean;
  includeSawNoMeet: boolean;
}) {
  const copy = reservationMailCopy[input.locale];
  const details: DetailRow[] = [
    { label: copy.reservationCode, value: input.reservationCode },
    { label: copy.transferDateTime, value: input.transferDateTime },
    { label: copy.serviceType, value: input.serviceType },
    ...(input.duration
      ? [{ label: copy.duration, value: input.duration }]
      : []),
    ...(input.showVehicleClass
      ? [
          {
            label: copy.vehicleClass,
            value: input.vehicleClass,
            detail: input.vehicleSubtitle || undefined,
          },
        ]
      : []),
    { label: copy.pickup, value: input.pickup },
    ...(input.showDropoff ? [{ label: copy.dropoff, value: input.dropoff }] : []),
    { label: copy.total, value: input.total },
    { label: copy.paymentMethod, value: input.paymentMethod },
    ...(input.showPaymentStatus
      ? [{ label: copy.paymentStatus, value: input.paymentStatus }]
      : []),
  ];

  const istHtml = input.includeIstMeet ? buildIstMeetSectionHtml(input.locale) : "";
  const istText = input.includeIstMeet ? buildIstMeetSectionText(input.locale) : "";
  const sawHtml = input.includeSawMeet ? buildSawMeetSectionHtml(input.locale) : "";
  const sawText = input.includeSawMeet ? buildSawMeetSectionText(input.locale) : "";
  const aytHtml = input.includeAytMeet ? buildAytMeetSectionHtml(input.locale) : "";
  const aytText = input.includeAytMeet ? buildAytMeetSectionText(input.locale) : "";
  const istNoMeetHtml = input.includeIstNoMeet
    ? buildIstNoMeetSectionHtml(input.locale)
    : "";
  const istNoMeetText = input.includeIstNoMeet
    ? buildIstNoMeetSectionText(input.locale)
    : "";
  const sawNoMeetHtml = input.includeSawNoMeet
    ? buildSawNoMeetSectionHtml(input.locale)
    : "";
  const sawNoMeetText = input.includeSawNoMeet
    ? buildSawNoMeetSectionText(input.locale)
    : "";
  const includeNoMeet = input.includeIstNoMeet || input.includeSawNoMeet;
  const istNoMeetContactHtml = includeNoMeet
    ? buildIstNoMeetContactNoticeHtml(input.locale)
    : "";
  const istNoMeetContactText = includeNoMeet
    ? buildIstNoMeetContactNoticeText(input.locale)
    : "";
  const contactHtml = buildReservationMailContactSectionHtml(input.locale);
  const contactText = buildReservationMailContactSectionText(input.locale);
  const includeAirportGuidance =
    input.includeIstMeet ||
    input.includeSawMeet ||
    input.includeAytMeet ||
    includeNoMeet;
  const internetHtml = input.includeAytMeet
    ? buildAytInternetSectionHtml(input.locale)
    : includeAirportGuidance
      ? buildInternetSectionHtml(input.locale)
      : "";
  const internetText = input.includeAytMeet
    ? buildAytInternetSectionText(input.locale)
    : includeAirportGuidance
      ? buildInternetSectionText(input.locale)
      : "";
  const aytDomesticNoteHtml = input.includeAytMeet
    ? buildAytDomesticNoteHtml(input.locale)
    : "";
  const aytDomesticNoteText = input.includeAytMeet
    ? buildAytDomesticNoteText(input.locale)
    : "";
  const closingHtml =
    input.includeIstMeet || input.includeSawMeet || input.includeAytMeet
    ? ""
    : `<p style="margin:24px 0 0;font-size:14px;color:#667085;">${escapeHtml(copy.closing)}</p>`;
  const closingText =
    input.includeIstMeet || input.includeSawMeet || input.includeAytMeet
      ? ""
      : `\n${copy.closing}`;

  const html = `<!DOCTYPE html>
<html lang="${input.locale}">
<body style="margin:0;padding:0;background:#f4f6fa;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="background:#ffffff;border-radius:12px;padding:28px 24px;">
      <p style="margin:0 0 12px;font-size:16px;">${escapeHtml(copy.greeting(input.customerName))}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${escapeHtml(copy.confirmationThanks)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">${escapeHtml(copy.confirmationIntro)}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${detailRowsHtml(details)}
      </table>
      ${istHtml}
      ${sawHtml}
      ${aytHtml}
      ${istNoMeetHtml}
      ${sawNoMeetHtml}
      ${istNoMeetContactHtml}
      ${contactHtml}
      ${internetHtml}
      ${closingHtml}
      ${aytDomesticNoteHtml}
    </div>
  </div>
</body>
</html>`;

  const text = `${copy.greeting(input.customerName)}

${copy.confirmationThanks}

${copy.confirmationIntro}

${detailRowsText(details)}
${istText}
${sawText}
${aytText}
${istNoMeetText}
${sawNoMeetText}
${istNoMeetContactText}
${contactText}
${internetText}${closingText}
${aytDomesticNoteText}
`;

  return { html, text, subject: copy.confirmationSubject(input.reservationCode) };
}

type ReservationEmailClaim = {
  id: string;
  attempt_count: number;
};

async function claimConfirmationEmail(
  reservationId?: string,
): Promise<ReservationEmailClaim | null> {
  const result = await query<ReservationEmailClaim>(
    `WITH candidate AS (
       SELECT id
       FROM reservations
       WHERE reservation_confirmation_email_queued_at IS NOT NULL
         AND reservation_confirmation_email_sent_at IS NULL
         AND deleted_at IS NULL
         AND status = 'confirmed'
         AND (payment_method = 'cash' OR payment_status = 'paid')
         AND (
           reservation_confirmation_email_next_attempt_at IS NULL
           OR reservation_confirmation_email_next_attempt_at <= NOW()
         )
         AND (
           reservation_confirmation_email_claimed_at IS NULL
           OR reservation_confirmation_email_claimed_at < NOW() - INTERVAL '10 minutes'
         )
         AND ($1::uuid IS NULL OR id = $1::uuid)
       ORDER BY reservation_confirmation_email_queued_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE reservations AS r
     SET reservation_confirmation_email_claimed_at = NOW(),
         reservation_confirmation_email_attempt_count =
           reservation_confirmation_email_attempt_count + 1
     FROM candidate
     WHERE r.id = candidate.id
     RETURNING r.id, r.reservation_confirmation_email_attempt_count AS attempt_count`,
    [reservationId || null],
  );
  return result.rows[0] ?? null;
}

async function markConfirmationSent(reservationId: string) {
  await query(
    `UPDATE reservations
     SET reservation_confirmation_email_sent_at = NOW(),
         reservation_confirmation_email_claimed_at = NULL,
         reservation_confirmation_email_next_attempt_at = NULL,
         reservation_confirmation_email_last_error = NULL
     WHERE id = $1
       AND reservation_confirmation_email_sent_at IS NULL`,
    [reservationId],
  );
}

async function releaseConfirmationClaim(
  reservationId: string,
  attemptCount: number,
  error: string,
) {
  const retrySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attemptCount - 1));
  await query(
    `UPDATE reservations
     SET reservation_confirmation_email_claimed_at = NULL,
         reservation_confirmation_email_next_attempt_at =
           NOW() + ($2 * INTERVAL '1 second'),
         reservation_confirmation_email_last_error = $3
     WHERE id = $1
       AND reservation_confirmation_email_sent_at IS NULL`,
    [reservationId, retrySeconds, error.slice(0, 500)],
  );
}

/**
 * Delivers an already-claimed reservation confirmation email.
 */
async function deliverReservationConfirmationEmail(
  reservationId: string,
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const id = reservationId.trim();
  const deliveryStartedAt = performance.now();
  let voucherPreparedAt: number | null = null;
  let smtpStartedAt: number | null = null;
  if (!id) {
    return { ok: false, error: "missing_reservation_id" };
  }

  try {
    const result = await query<ReservationMailRow>(
      `SELECT
          id,
          reservation_code,
          locale,
          customer_email,
          customer_first_name,
          customer_last_name,
          pickup_at,
          payment_method,
          payment_status,
          meet_and_greet,
          service_type,
          tour_code,
          pickup_airport_code,
          pickup_location_type,
          pickup_place_id,
          reservation_confirmation_email_sent_at
       FROM reservations
       WHERE id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      console.error("[reservation-mail] confirmation skipped — reservation not found", {
        reservationId: id,
      });
      return { ok: false, error: "not_found" };
    }
    if (row.reservation_confirmation_email_sent_at) {
      return { ok: true, skipped: true };
    }

    const email = row.customer_email?.trim().toLowerCase() ?? "";
    if (!email || !email.includes("@")) {
      console.error("[reservation-mail] confirmation skipped — missing customer email", {
        reservationId: id,
        reservationCode: row.reservation_code,
      });
      return { ok: false, error: "missing_email" };
    }

    const localeRaw = row.locale ?? "";
    const locale: Locale = isLocale(localeRaw) ? localeRaw : "tr";
    const accountLabels = accountCopy[locale];
    const voucher = await findReservationVoucherById(id, locale);
    if (!voucher) {
      console.error("[reservation-mail] confirmation skipped — voucher data missing", {
        reservationId: id,
      });
      return { ok: false, error: "voucher_missing" };
    }

    const pickupAt = row.pickup_at ? new Date(row.pickup_at) : null;
    const transferDateTime =
      pickupAt && !Number.isNaN(pickupAt.getTime())
        ? formatTransferDateTime(pickupAt, locale)
        : "—";
    const duration = voucher.durationValue;

    const paymentMethod =
      accountPaymentMethodLabel(row.payment_method, accountLabels) ||
      voucher.paymentMethodLabel;
    const paymentStatus =
      accountPaymentStatusLabel(row.payment_status, accountLabels) || "—";

    const bodies = buildConfirmationBodies({
      locale,
      customerName: customerDisplayName(
        row.customer_first_name,
        row.customer_last_name,
      ),
      reservationCode: row.reservation_code,
      transferDateTime,
      serviceType: voucher.serviceTypeLabel,
      duration,
      vehicleClass: voucher.vehicleLabel,
      vehicleSubtitle: voucher.vehicleSubtitle,
      showVehicleClass: voucher.showVehicleClass,
      pickup: [voucher.pickupName, voucher.pickupAddress]
        .filter((part) => part && part !== "—")
        .join(" — ") || "—",
      dropoff: [voucher.dropoffName, voucher.dropoffAddress]
        .filter((part) => part && part !== "—")
        .join(" — ") || "—",
      showDropoff: voucher.showDropoff,
      total: voucher.totalLabel,
      paymentMethod,
      paymentStatus,
      showPaymentStatus: shouldShowPaymentStatus(row.payment_method),
      includeIstMeet: showIstMeetSection(row),
      includeSawMeet: showSawMeetSection(row),
      includeAytMeet: showAytMeetSection(row),
      includeIstNoMeet: showIstNoMeetSection(row),
      includeSawNoMeet: showSawNoMeetSection(row),
    });

    const pdf = await buildReservationVoucherPdf(voucher, locale);
    voucherPreparedAt = performance.now();
    const filename = voucherPdfFilename(row.reservation_code);

    smtpStartedAt = performance.now();
    const sent = await sendReservationSmtpMail(
      {
        to: email,
        subject: bodies.subject,
        text: bodies.text,
        html: bodies.html,
        from: reservationMailFrom(),
        messageId: `<reservation-confirmation-${id}@tripetica.com>`,
        attachments: [
          {
            filename,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      },
      {
        logPrefix: "[reservation-mail]",
      },
    );

    if (!sent.ok) {
      console.error("[reservation-mail] confirmation delivery failed", {
        reservationId: id,
        reservationCode: row.reservation_code,
        error: sent.error,
        deliveryMs: Math.round(performance.now() - deliveryStartedAt),
        voucherMs: voucherPreparedAt
          ? Math.round(voucherPreparedAt - deliveryStartedAt)
          : null,
        smtpMs: smtpStartedAt
          ? Math.round(performance.now() - smtpStartedAt)
          : null,
      });
      return { ok: false, error: sent.error };
    }

    await markConfirmationSent(id);
    console.info("[reservation-mail] confirmation sent", {
      reservationId: id,
      reservationCode: row.reservation_code,
      locale,
      includeIstMeet: showIstMeetSection(row),
      deliveryMs: Math.round(performance.now() - deliveryStartedAt),
      voucherMs: voucherPreparedAt
        ? Math.round(voucherPreparedAt - deliveryStartedAt)
        : null,
      smtpMs: smtpStartedAt
        ? Math.round(performance.now() - smtpStartedAt)
        : null,
    });
    return { ok: true };
  } catch (error) {
    console.error("[reservation-mail] confirmation unexpected failure", {
      reservationId: id,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
    return { ok: false, error: "unexpected" };
  }
}

/**
 * Claims and sends one reservation confirmation. The durable queue remains
 * pending on failure, so a later worker pass can retry safely.
 */
export async function sendReservationConfirmationEmail(
  reservationId: string,
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const id = reservationId.trim();
  if (!id) {
    return { ok: false, error: "missing_reservation_id" };
  }
  const claim = await claimConfirmationEmail(id);
  if (!claim) {
    return { ok: true, skipped: true };
  }
  const result = await deliverReservationConfirmationEmail(claim.id);
  if (!result.ok) {
    await releaseConfirmationClaim(claim.id, claim.attempt_count, result.error);
  }
  return result;
}

export async function sendPendingReservationConfirmationEmails(
  limit = 10,
): Promise<{ processed: number; sent: number; failed: number }> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  let processed = 0;
  let sent = 0;
  let failed = 0;
  while (processed < safeLimit) {
    const claim = await claimConfirmationEmail();
    if (!claim) break;
    processed += 1;
    const result = await deliverReservationConfirmationEmail(claim.id);
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      await releaseConfirmationClaim(claim.id, claim.attempt_count, result.error);
    }
  }
  return { processed, sent, failed };
}
