import test from "node:test";
import assert from "node:assert/strict";
import { formatDurationHours } from "@/lib/booking/catalog";
import { pickupAirportCode } from "@/lib/booking/meet-and-greet";
import { reservationMailCopy } from "@/lib/mail/reservation-copy";
import {
  buildReservationMailContactSectionHtml,
  buildReservationMailContactSectionText,
} from "@/lib/mail/reservation-contact";
import {
  IST_MEET_PHOTO_FILENAME,
  IST_MEET_VIDEO_FILENAME,
  publicAssetUrl,
} from "@/lib/mail/reservation-assets";
import { contactLinks, tripeticaMessagingDigits, viberChatHrefForEmail } from "@/lib/contact/links";
import { accountCopy } from "@/lib/account/copy";
import {
  accountPaymentMethodLabel,
  accountPaymentStatusLabel,
} from "@/lib/account/reservation-labels";

function shouldShowIstMeetSection(input: {
  meetAndGreet: boolean | null;
  pickupAirportCode: string | null;
  pickupLocationType: string | null;
  pickupPlaceId: string | null;
}) {
  if (input.meetAndGreet !== true) {
    return false;
  }
  return (
    pickupAirportCode({
      airportCode: input.pickupAirportCode,
      locationType: input.pickupLocationType,
      placeId: input.pickupPlaceId,
    }) === "IST"
  );
}

test("IST meet section requires IST airport code and meet_and_greet=true", () => {
  assert.equal(
    shouldShowIstMeetSection({
      meetAndGreet: true,
      pickupAirportCode: "IST",
      pickupLocationType: "airport",
      pickupPlaceId: null,
    }),
    true,
  );
  assert.equal(
    shouldShowIstMeetSection({
      meetAndGreet: false,
      pickupAirportCode: "IST",
      pickupLocationType: "airport",
      pickupPlaceId: null,
    }),
    false,
  );
  assert.equal(
    shouldShowIstMeetSection({
      meetAndGreet: true,
      pickupAirportCode: "SAW",
      pickupLocationType: "airport",
      pickupPlaceId: null,
    }),
    false,
  );
});

test("payment terminology stays Online / Bekleniyor (and locale equivalents)", () => {
  assert.equal(accountPaymentMethodLabel("sbp", accountCopy.tr), "Online");
  assert.equal(accountPaymentStatusLabel("pending", accountCopy.tr), "Bekleniyor");
  assert.equal(accountPaymentMethodLabel("sbp", accountCopy.en), "Online");
  assert.equal(accountPaymentStatusLabel("pending", accountCopy.en), "Pending");
  assert.equal(accountPaymentMethodLabel("sbp", accountCopy.ru), "Онлайн");
  assert.equal(accountPaymentStatusLabel("pending", accountCopy.ru), "Ожидается");
});

test("reservation mail copy covers TR EN RU confirmation and payment subjects", () => {
  assert.match(reservationMailCopy.tr.confirmationSubject("TRP-1"), /TRP-1/);
  assert.match(reservationMailCopy.en.paymentConfirmationSubject("TRP-1"), /TRP-1/);
  assert.equal(reservationMailCopy.ru.meetingVideoCta.length > 0, true);
  assert.equal(reservationMailCopy.tr.greeting("RECEP YILDIRIM"), "Merhaba RECEP YILDIRIM,");
  assert.equal(reservationMailCopy.en.greeting("RECEP YILDIRIM"), "Hello RECEP YILDIRIM,");
  assert.equal(
    reservationMailCopy.ru.greeting("RECEP YILDIRIM"),
    "Здравствуйте, RECEP YILDIRIM!",
  );
  assert.equal(
    reservationMailCopy.tr.confirmationThanks,
    "Tripetica’yı tercih ettiğiniz için teşekkür ederiz.",
  );
  assert.equal(
    reservationMailCopy.en.confirmationThanks,
    "Thank you for choosing Tripetica.",
  );
  assert.equal(
    reservationMailCopy.ru.confirmationThanks,
    "Благодарим вас за выбор Tripetica.",
  );
  assert.match(
    reservationMailCopy.tr.confirmationIntro,
    /Voucher PDF/i,
  );
  assert.match(
    reservationMailCopy.tr.meetingInstructions,
    /Karşılama görevlimiz sizi bu noktada karşılayacaktır/,
  );
  assert.equal(reservationMailCopy.tr.meetingImportantParagraphs.length, 2);
  assert.equal(reservationMailCopy.tr.contactIntro.includes("kanallardan"), true);
  assert.equal(reservationMailCopy.tr.internetParagraphs.length, 6);
  assert.equal(reservationMailCopy.tr.transferDateTime, "Tarih ve saat");
  assert.equal(reservationMailCopy.en.transferDateTime, "Date and time");
  assert.equal(reservationMailCopy.ru.transferDateTime, "Дата и время");
  assert.equal(reservationMailCopy.tr.duration, "Süre");
  assert.equal(reservationMailCopy.en.duration, "Duration");
  assert.equal(reservationMailCopy.ru.duration, "Продолжительность");
  assert.equal(contactLinks.viber, `viber://chat?number=${tripeticaMessagingDigits}`);
  assert.equal(contactLinks.viber, "viber://chat?number=905422058219");
  process.env.APP_BASE_URL = "https://tripetica.com";
  assert.equal(viberChatHrefForEmail(), "https://tripetica.com/go/viber");
});

test("hourly duration mail value matches catalog hours and km from reservation data", () => {
  assert.equal(formatDurationHours(6, "tr"), "6 saat (70 km)");
  assert.equal(formatDurationHours(6, "en"), "6 Hours (70 km)");
  assert.equal(formatDurationHours(6, "ru"), "6 часов (70 км)");
  assert.equal(formatDurationHours(null, "tr"), null);
  assert.equal(formatDurationHours(3, "tr"), null);
});

test("reservation mail contact section wraps each channel label and value in one link", () => {
  process.env.APP_BASE_URL = "https://tripetica.com";
  const html = buildReservationMailContactSectionHtml("tr");
  assert.match(html, new RegExp(`<a href="${contactLinks.phone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>Telefon: \\+90 533 205 82 19</a>`));
  assert.match(html, new RegExp(`<a href="${contactLinks.whatsapp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>WhatsApp: \\+90 542 205 82 19</a>`));
  assert.match(html, new RegExp(`<a href="${contactLinks.telegram.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>Telegram: @Tripetica</a>`));
  assert.match(html, new RegExp(`<a href="${viberChatHrefForEmail().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>Viber: \\+90 542 205 82 19</a>`));
  assert.doesNotMatch(html, /<span[^>]*>.*Viber:/);

  const text = buildReservationMailContactSectionText("en");
  assert.match(text, /Phone: \+90 533 205 82 19 \(tel:\+905332058219\)/);
  assert.match(text, /Viber: \+90 542 205 82 19 \(https:\/\/tripetica\.com\/go\/viber\)/);
});

test("IST asset public URLs encode filenames and keep original names", () => {
  process.env.APP_BASE_URL = "https://tripetica.com";
  assert.ok(IST_MEET_PHOTO_FILENAME.includes("evet foto.png"));
  assert.ok(IST_MEET_VIDEO_FILENAME.includes("evet video.mp4"));
  assert.equal(
    publicAssetUrl(IST_MEET_PHOTO_FILENAME),
    `https://tripetica.com/${encodeURIComponent(IST_MEET_PHOTO_FILENAME)}`,
  );
});
