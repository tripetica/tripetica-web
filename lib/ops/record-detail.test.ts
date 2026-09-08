import test from "node:test";
import assert from "node:assert/strict";
import { opsCopy } from "@/lib/ops/copy";
import { LAYOVER_TOUR_CODE } from "@/lib/booking/pricing/layover-pricing";
import {
  buildReservationActionContext,
  displayText,
  firstText,
  genderLabel,
  isOpsContactRow,
  isReservationCancelled,
  localeLabel,
  opsVehicleLabelFor,
  paymentLabel,
  processPdfFilename,
  reservationPdfFilename,
  reservationStatusLabel,
  reservationVoucherPdfFilename,
  serviceLabel,
  stageLabel,
  statusLabel,
} from "@/lib/ops/record-detail";

const copy = opsCopy.tr;

test("displayText hides empty and illegal placeholders", () => {
  assert.equal(displayText(null), "");
  assert.equal(displayText(undefined), "");
  assert.equal(displayText("undefined"), "");
  assert.equal(displayText("null"), "");
  assert.equal(displayText("  İstanbul Havalimanı  "), "İstanbul Havalimanı");
});

test("status and stage labels stay readable without changing DB values", () => {
  assert.equal(statusLabel("draft", copy), "Taslak");
  assert.equal(stageLabel("vehicle_selection", copy), "Araç seçimi");
  assert.equal(serviceLabel("transfer", copy), "Özel Transfer & Taksi");
  assert.equal(serviceLabel("hourly", copy), "Saatlik Şoförlü Araç");
  assert.equal(serviceLabel("tour", copy), "Turlar & Rotalar");
  assert.equal(
    serviceLabel("tour", copy, { tourCode: LAYOVER_TOUR_CODE, locale: "tr" }),
    "İstanbul Aktarma Turu",
  );
  assert.equal(reservationStatusLabel("payment_pending", copy), "Aktif");
  assert.equal(reservationStatusLabel("confirmed", copy), "Aktif");
  assert.equal(reservationStatusLabel("cancelled", copy), "İptal edildi");
  assert.equal(paymentLabel("sbp", copy), "Online");
  assert.equal(genderLabel("female", copy), "Kadın");
  assert.equal(stageLabel("vehicle_selection", copy) !== "vehicle_selection", true);
});

test("pdf filenames stay ascii and avoid exposing uuids", () => {
  assert.equal(
    processPdfFilename("2026-08-28T12:30:00.000Z").startsWith("Tripetica-Rezervasyon-Sureci-"),
    true,
  );
  assert.equal(processPdfFilename("2026-08-28T12:30:00.000Z").includes("pdf"), true);
  assert.equal(
    reservationPdfFilename("TRP-20260828-0009"),
    "TripeticaOps-TRP-20260828-0009.pdf",
  );
  assert.equal(firstText(null, "", "IST"), "IST");
});

test("ops contact rows are identified by email and phone labels", () => {
  assert.equal(isOpsContactRow(copy.email, copy), true);
  assert.equal(isOpsContactRow(copy.phone, copy), true);
  assert.equal(isOpsContactRow(copy.firstName, copy), false);
});

test("reservation voucher pdf filename uses Tripetica-Voucher prefix", () => {
  assert.equal(
    reservationVoucherPdfFilename("TRP-20260828-0009"),
    "Tripetica-Voucher-TRP-20260828-0009.pdf",
  );
});

test("ops vehicle labels follow panel locale from vehicle code", () => {
  assert.equal(opsVehicleLabelFor("premium-economy-sedan", "tr"), "Premium Ekonomi Sedan");
  assert.equal(opsVehicleLabelFor("premium-economy-sedan", "en"), "Premium Economy Sedan");
  assert.equal(opsVehicleLabelFor("unknown-vehicle", "tr"), null);
});

test("reservation status labels use active/cancelled wording", () => {
  assert.equal(reservationStatusLabel("confirmed", copy), "Aktif");
  assert.equal(reservationStatusLabel("payment_pending", copy), "Aktif");
  assert.equal(reservationStatusLabel("cancelled", copy), "İptal edildi");
  assert.equal(isReservationCancelled("cancelled"), true);
  assert.equal(isReservationCancelled("confirmed"), false);
  assert.equal(isReservationCancelled("payment_pending"), false);
});

test("locale labels follow ops panel language", () => {
  assert.equal(localeLabel("ru", copy), "Rusça");
  assert.equal(localeLabel("en", copy), "İngilizce");
  assert.equal(localeLabel("tr", copy), "Türkçe");
});

function cashActionItem(pickupAt: string) {
  return {
    status: "confirmed",
    serviceType: "transfer",
    tourCode: null,
    pickupAt,
    paymentMethod: "cash",
    paymentStatus: null,
    paymentProvider: null,
    paymentProviderOrderId: null,
    paymentAmount: null,
    paymentCurrency: null,
    refundStatus: null,
  };
}

test("ops remaining 5h uses late-window cancel dialog and closed mutation window", () => {
  const nowUtcMs = Date.parse("2026-09-01T12:00:00.000Z");
  const pickupAt = new Date(nowUtcMs + 5 * 60 * 60 * 1000).toISOString();
  const ctx = buildReservationActionContext(cashActionItem(pickupAt), nowUtcMs);
  assert.equal(ctx.mutationWindowOpen, false);
  assert.equal(ctx.cancelDialog, "late-window");
});

test("ops remaining 7h keeps normal cancel dialog without late-window warning", () => {
  const nowUtcMs = Date.parse("2026-09-01T12:00:00.000Z");
  const pickupAt = new Date(nowUtcMs + 7 * 60 * 60 * 1000).toISOString();
  const ctx = buildReservationActionContext(cashActionItem(pickupAt), nowUtcMs);
  assert.equal(ctx.mutationWindowOpen, true);
  assert.equal(ctx.cancelDialog, "generic");
});
