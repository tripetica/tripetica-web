import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPartnerApplicationPushPayload,
  buildProcessPushPayload,
  buildReservationPushPayload,
  buildVehicleApprovalPushPayload,
  PARTNER_APPLICATION_PUSH_TITLE,
  PROCESS_PUSH_TITLE,
  RESERVATION_PUSH_TITLE,
  VEHICLE_APPROVAL_PUSH_TITLE,
} from "@/lib/ops/push/payload";
import { isBookableTourCode, opsServiceLabel, opsVehicleLabel } from "@/lib/ops/push/labels";

const pickupAt = new Date("2026-09-12T12:30:00.000Z");

test("process transfer payload stays Turkish and has no extra transfer subtype", () => {
  const payload = buildProcessPushPayload({
    id: "search-1",
    serviceType: "transfer",
    tourCode: null,
    pickupAt,
    durationHours: null,
    pickupNameTr: "İstanbul Havalimanı",
    pickupNameCustomer: "Istanbul Airport",
    dropoffNameTr: "Şişli",
    dropoffNameCustomer: "Sisli",
    passengerCount: 2,
  });
  assert.equal(payload.title, PROCESS_PUSH_TITLE);
  assert.match(payload.body, /12 Eyl 2026 • 15:30/);
  assert.match(payload.body, /Özel Transfer & Taksi/);
  assert.doesNotMatch(payload.body, /havalimanı transferi|şehir içi|şehirler arası/i);
  assert.match(payload.body, /İstanbul Havalimanı → Şişli/);
  assert.equal(payload.url, "/tr/ops/processes/search-1");
});

test("process hourly and tour payloads use Turkish labels from codes", () => {
  const hourly = buildProcessPushPayload({
    id: "search-2",
    serviceType: "hourly",
    tourCode: null,
    pickupAt: new Date("2026-09-14T07:00:00.000Z"),
    durationHours: 8,
    pickupNameTr: null,
    pickupNameCustomer: "Hilton Bomonti",
    dropoffNameTr: null,
    dropoffNameCustomer: null,
    passengerCount: null,
  });
  assert.match(hourly.body, /Saatlik Şoförlü Araç • 8 saat/);
  assert.match(hourly.body, /Hilton Bomonti/);

  const tour = buildProcessPushPayload({
    id: "search-3",
    serviceType: "tour",
    tourCode: "sapanca",
    pickupAt: new Date("2026-09-13T06:00:00.000Z"),
    durationHours: null,
    pickupNameTr: null,
    pickupNameCustomer: "Hilton Bomonti",
    dropoffNameTr: null,
    dropoffNameCustomer: null,
    passengerCount: 4,
  });
  assert.match(tour.body, /Sapanca Turu/);
  assert.doesNotMatch(tour.body, /Туры|Tours & Routes|Turlar & Rotalar/);
});

test("bookable tours exclude Kapadokya / private Turkey routes", () => {
  assert.equal(isBookableTourCode("sapanca"), true);
  assert.equal(isBookableTourCode("private-turkey-tours"), false);
  assert.equal(opsServiceLabel("tour", "private-turkey-tours"), "Turlar & Rotalar");
  assert.equal(opsServiceLabel("tour", "bosphorus-dinner"), "Boğaz’da Yemekli Gemi Turu & Türk Gecesi");
});

test("reservation payload is Turkish even when customer labels are Russian or English", () => {
  const ru = buildReservationPushPayload({
    id: "res-1",
    reservationCode: "TRP-20260912-0001",
    serviceType: "tour",
    tourCode: "istanbul-full-day",
    pickupAt,
    durationHours: null,
    vehicleCode: "business-minivan",
    vehicleLabelTr: "Business Minivan",
    pickupNameTr: null,
    pickupNameCustomer: "Хилтон Бомонти",
    dropoffNameTr: null,
    dropoffNameCustomer: null,
    passengerCount: 4,
    totalPrice: 220,
    currency: "EUR",
  });
  assert.equal(ru.title, RESERVATION_PUSH_TITLE);
  assert.match(ru.body, /İstanbul Tam Gün Tur/);
  assert.match(ru.body, /Business Minivan/);
  assert.doesNotMatch(ru.body, /Полный день|Full day|минивэн|Туры/);
  assert.match(ru.body, /Хилтон Бомонти/);
  assert.match(ru.body, /4 yolcu • TRP-20260912-0001 • 220 EUR/);
  assert.equal(ru.url, "/tr/ops/reservations/res-1");

  const en = buildReservationPushPayload({
    id: "res-2",
    reservationCode: "TRP-20260912-0002",
    serviceType: "transfer",
    tourCode: null,
    pickupAt,
    durationHours: null,
    vehicleCode: "standard-minivan",
    vehicleLabelTr: null,
    pickupNameTr: "İstanbul Havalimanı",
    pickupNameCustomer: "Istanbul Airport",
    dropoffNameTr: "Grand Aras Hotel",
    dropoffNameCustomer: "Grand Aras Hotel",
    passengerCount: 2,
    totalPrice: "55.00",
    currency: "USD",
  });
  assert.match(en.body, /Özel Transfer & Taksi • Standart Minivan/);
  assert.match(en.body, /İstanbul Havalimanı → Grand Aras Hotel/);
});

test("hourly reservation shows duration and vehicle on separate emphasis lines", () => {
  const payload = buildReservationPushPayload({
    id: "res-3",
    reservationCode: "TRP-XXXX",
    serviceType: "hourly",
    tourCode: null,
    pickupAt,
    durationHours: 8,
    vehicleCode: "first-class-minivan",
    vehicleLabelTr: null,
    pickupNameTr: null,
    pickupNameCustomer: "Hilton Bomonti",
    dropoffNameTr: null,
    dropoffNameCustomer: null,
    passengerCount: 3,
    totalPrice: 180,
    currency: "EUR",
  });
  assert.match(payload.body, /Saatlik Şoförlü Araç • 8 saat/);
  assert.match(payload.body, /First Class Minivan/);
  assert.equal(opsVehicleLabel("first-class-minivan", "ignored"), "First Class Minivan");
});

test("partner application push stays Turkish and links to partner detail", () => {
  const payload = buildPartnerApplicationPushPayload({
    id: "partner-1",
    name: "ABC Turizm",
    contactFirstName: "Ahmet",
    contactLastName: "Yılmaz",
  });
  assert.equal(payload.title, PARTNER_APPLICATION_PUSH_TITLE);
  assert.equal(payload.title, "⚪ Yeni Partner Talebi");
  assert.match(payload.body, /ABC Turizm/);
  assert.match(payload.body, /Yetkili: Ahmet Yılmaz/);
  assert.doesNotMatch(payload.body, /532|vergi|tax/i);
  assert.equal(payload.kind, "partner");
  assert.equal(payload.icon, "/ops-push-partner.png");
  assert.equal(payload.url, "/tr/ops/partners/partner-1");
});

test("vehicle approval push stays Turkish and links to the global vehicle detail", () => {
  const payload = buildVehicleApprovalPushPayload({
    id: "vehicle-1",
    plate: "34 ABC 123",
    brand: "Mercedes-Benz",
    model: "Vito",
    partnerId: "partner-1",
    partnerName: "ABC Turizm",
  });
  assert.equal(payload.title, VEHICLE_APPROVAL_PUSH_TITLE);
  assert.equal(payload.title, "⚪ Araç Onayı");
  assert.match(payload.body, /34 ABC 123/);
  assert.match(payload.body, /Mercedes-Benz Vito/);
  assert.match(payload.body, /ABC Turizm/);
  assert.equal(payload.kind, "partner");
  assert.equal(payload.url, "/tr/ops/vehicles/vehicle-1");
});
