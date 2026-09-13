import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildReservationVoucherPdf } from "@/lib/booking/reservation-voucher-pdf";
import { type ReservationVoucherData } from "@/lib/booking/reservation-voucher-access";
import { resolveReservationCustomerLocale } from "@/lib/booking/reservation-voucher-locale";
import { voucherCopy } from "@/lib/booking/voucher-copy";
import { type Locale } from "@/lib/i18n/config";

function sampleVoucher(locale: Locale): ReservationVoucherData {
  const copy = voucherCopy[locale];
  return {
    reservationCode: "TPT-TEST-1001",
    locale,
    serviceTypeLabel: copy.serviceType,
    dateTime: "13 Sep 2026, 14:30",
    durationValue: null,
    durationKmOverrunNote: null,
    packageCoverageValue: null,
    packageOverrunNote: null,
    packageExtraFeeNote: null,
    pickupName: locale === "ar" ? "مطار إسطنبول (IST)" : "Istanbul Airport (IST)",
    pickupAddress: "Istanbul Airport, Türkiye",
    dropoffName: locale === "ar" ? "السلطان أحمد" : "Sultanahmet",
    dropoffAddress: "Sultanahmet, Istanbul",
    showDropoff: true,
    vehicleLabel: locale === "ar" ? "ميني فان بزنس" : "Business Minivan",
    vehicleSubtitle: null,
    showVehicleClass: true,
    distanceLabel: "42 km",
    showDistance: true,
    flightCode: "TK 123",
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 1,
    meetAndGreet: true,
    showMeetAndGreet: true,
    pickupIsAirport: true,
    paymentMethodLabel: copy.paymentCash,
    totalLabel: "€ 85.00",
    otherCurrencyLine: "$ 92.00 · ₺ 3.400",
    contactPhone: "+90 555 000 00 00",
    contactEmail: "guest@example.com",
    passengerNote: locale === "ar" ? "يرجى الانتظار عند الباب 3" : "Wait at door 3",
    passengerNames: ["Ahmed Ali"],
    participantBreakdown: null,
    participantBreakdownHeading: null,
    includedSectionTitle: null,
    includedItems: null,
    serviceInfoSectionTitle: null,
    serviceInfoGroups: null,
    cancelPolicyTitle: null,
    cancelPolicyBody: null,
    waitingPolicyKind: "transfer",
  };
}

test("Arabic voucher embeds Noto Sans Arabic and not the Latin-only face", async () => {
  const pdf = await buildReservationVoucherPdf(sampleVoucher("ar"), "ar");
  const text = pdf.toString("latin1");
  assert.match(text, /NotoSansArabic/);
  assert.doesNotMatch(text, /NotoSans-Regular/);
  assert.match(text, /T\x00P\x00T\x00-\x00T\x00E\x00S\x00T\x00-\x001\x000\x000\x001/);
});

test("EN RU TR vouchers keep the existing Noto Sans face", async () => {
  for (const locale of ["en", "ru", "tr"] as const) {
    const pdf = await buildReservationVoucherPdf(sampleVoucher(locale), locale);
    const text = pdf.toString("latin1");
    assert.match(text, /NotoSans/);
    assert.doesNotMatch(text, /NotoSansArabic/);
    assert.match(text, /T\x00P\x00T\x00-\x00T\x00E\x00S\x00T\x00-\x001\x000\x000\x001/);
  }
});

test("TRP-20260913-0003 style RU reservation keeps RU voucher copy under a TR ops request", () => {
  const locale = resolveReservationCustomerLocale("ru", "tr");
  const copy = voucherCopy[locale];
  assert.equal(locale, "ru");
  assert.equal(copy.reservationCodeLabel, "Код бронирования");
  assert.equal(copy.reservationSection, "Детали бронирования");
  assert.equal(copy.serviceType, "Тип услуги");
  assert.equal(copy.dateTimeLabel, "Дата и время");
  assert.equal(copy.pickupPoint, "Место подачи");
  assert.equal(copy.dropoffPoint, "Место назначения");
  assert.equal(copy.vehicleClass, "Класс авто");
  assert.equal(copy.distance, "Расстояние");
  assert.equal(copy.passengers, "Количество пассажиров");
  assert.equal(copy.passengerSection, "Данные пассажира");
  assert.equal(copy.phone, "Телефон");
  assert.equal(copy.email, "Эл. почта");
  assert.equal(copy.passengerList, "Пассажиры");
  assert.equal(copy.paymentMethod, "Способ оплаты");
  assert.equal(copy.total, "Итоговая сумма");
  assert.equal(copy.otherCurrencyEquivalents, "Эквивалент в других валютах");
  assert.equal(copy.policySectionTitle, "ОТМЕНА, ИЗМЕНЕНИЯ И ВРЕМЯ ОЖИДАНИЯ");
  assert.equal(copy.policyCancelTitle, "Отмена и изменения");
  assert.equal(copy.policyWaitingTitle, "Бесплатное время ожидания");
  assert.equal(copy.policyNoShowTitle, "No-Show");
  assert.notEqual(copy.reservationCodeLabel, voucherCopy.tr.reservationCodeLabel);
  assert.notEqual(copy.policySectionTitle, voucherCopy.tr.policySectionTitle);
  assert.notEqual(copy.policyCancelBody, voucherCopy.tr.policyCancelBody);
});

test("EN TR AR reservation locales stay unmixed when the request locale differs", () => {
  assert.equal(resolveReservationCustomerLocale("en", "tr"), "en");
  assert.equal(voucherCopy.en.reservationCodeLabel, "Reservation code");
  assert.equal(voucherCopy.en.policySectionTitle, "CANCELLATION, CHANGES AND WAITING TIME");
  assert.notEqual(voucherCopy.en.policyCancelBody, voucherCopy.tr.policyCancelBody);

  assert.equal(resolveReservationCustomerLocale("tr", "en"), "tr");
  assert.equal(voucherCopy.tr.reservationCodeLabel, "Rezervasyon Kodu");
  assert.equal(
    voucherCopy.tr.policySectionTitle,
    "İPTAL, DEĞİŞİKLİK VE BEKLEME KOŞULLARI",
  );

  assert.equal(resolveReservationCustomerLocale("ar", "tr"), "ar");
  assert.equal(voucherCopy.ar.reservationCodeLabel, "رمز الحجز");
  assert.notEqual(voucherCopy.ar.policyCancelBody, voucherCopy.tr.policyCancelBody);
});

test("voucher PDF renderer uses reservation locale even if the caller passes TR", async () => {
  const source = readFileSync(
    new URL("../booking/reservation-voucher-pdf.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /const locale = data\.locale/);

  const ru = await buildReservationVoucherPdf(sampleVoucher("ru"), "tr");
  assert.match(ru.toString("latin1"), /NotoSans/);
  assert.doesNotMatch(ru.toString("latin1"), /NotoSansArabic/);

  const ar = await buildReservationVoucherPdf(sampleVoucher("ar"), "tr");
  assert.match(ar.toString("latin1"), /NotoSansArabic/);
  assert.doesNotMatch(ar.toString("latin1"), /NotoSans-Regular/);
});
