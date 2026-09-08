import assert from "node:assert/strict";
import test from "node:test";
import { partnerCopy } from "@/lib/partner/copy";
import { formatPartnerMoney, partnerPayoutAmount } from "@/lib/partner/job-payout";
import {
  buildPartnerJobPushPayload,
  formatPartnerPushDateTime,
} from "@/lib/partner/push/payload";

const pickupAt = new Date("2026-09-07T05:00:00.000Z");

test("transfer partner push uses payout label and omits PII or cash", () => {
  const payload = buildPartnerJobPushPayload({
    reservationId: "11111111-1111-4111-8111-111111111111",
    locale: "tr",
    title: partnerCopy.tr.pushJobTitle,
    payoutTitle: partnerCopy.tr.jobPayout,
    payoutLabel: formatPartnerMoney(48.72, "USD", "tr"),
    serviceType: "transfer",
    tourCode: null,
    pickupAt,
    pickupNameCustomer: "İstanbul Havalimanı (IST)",
    pickupNameTr: "İstanbul Havalimanı (IST)",
    dropoffNameCustomer: "Radisson Blu Hotel Şişli",
    dropoffNameTr: "Radisson Blu Hotel Şişli",
    durationHours: null,
  });
  assert.equal(payload.title, "Yeni İş Var");
  assert.equal(payload.kind, "partner-job");
  assert.match(payload.body, /07 Eyl 2026 · 08:00/);
  assert.match(payload.body, /Özel Transfer & Taksi/);
  assert.match(payload.body, /İstanbul Havalimanı \(IST\) → Radisson Blu Hotel Şişli/);
  assert.match(payload.body, /Size Ödenecek Tutar: 48,72 USD/);
  assert.doesNotMatch(payload.body, /Partnere Ödenecek|Yolcudan Nakit|@|pasaport/i);
  assert.equal(
    payload.url,
    "/tr/partner/jobs/11111111-1111-4111-8111-111111111111",
  );
});

test("hourly partner push uses reservation package hours and included km", () => {
  const payload = buildPartnerJobPushPayload({
    reservationId: "22222222-2222-4222-8222-222222222222",
    locale: "tr",
    title: partnerCopy.tr.pushJobTitle,
    payoutTitle: partnerCopy.tr.jobPayout,
    payoutLabel: formatPartnerMoney(143, "EUR", "tr"),
    serviceType: "hourly",
    tourCode: null,
    pickupAt,
    pickupNameCustomer: "The Marmara Taksim",
    pickupNameTr: "The Marmara Taksim",
    dropoffNameCustomer: null,
    dropoffNameTr: null,
    durationHours: 7,
  });
  assert.match(payload.body, /Saatlik Şoförlü Araç/);
  assert.match(payload.body, /The Marmara Taksim/);
  assert.match(payload.body, /7 saat \(80 km\)/);
  assert.doesNotMatch(payload.body, /\n—\n|^—$/m);
  assert.match(payload.body, /Size Ödenecek Tutar: 143 EUR/);
});

test("hourly push omits empty dropoff instead of a dash", () => {
  const payload = buildPartnerJobPushPayload({
    reservationId: "33333333-3333-4333-8333-333333333333",
    locale: "en",
    title: partnerCopy.en.pushJobTitle,
    payoutTitle: partnerCopy.en.jobPayout,
    payoutLabel: "70 EUR",
    serviceType: "hourly",
    tourCode: null,
    pickupAt,
    pickupNameCustomer: "Hilton",
    pickupNameTr: "Hilton",
    dropoffNameCustomer: "",
    dropoffNameTr: "",
    durationHours: 6,
  });
  assert.equal(payload.title, "New Job Available");
  assert.match(payload.body, /6 Hours \(70 km\)/);
  assert.doesNotMatch(payload.body, /—|Yok|N\/A/);
});

test("external partner payout stays 70 percent of stored total", () => {
  assert.equal(partnerPayoutAmount({ total: 100, isPrimaryPartner: true }), 100);
  assert.equal(partnerPayoutAmount({ total: 100, isPrimaryPartner: false }), 70);
});

test("partner push datetime uses Istanbul local time", () => {
  assert.equal(formatPartnerPushDateTime(pickupAt, "tr"), "07 Eyl 2026 · 08:00");
});
