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
  isOpsPricingRow,
  isReservationCancelled,
  localeLabel,
  opsTransferRowsForDisplay,
  opsVehicleLabelFor,
  passengerNoteText,
  paymentLabel,
  processPdfFilename,
  reservationPdfFilename,
  reservationStatusLabel,
  reservationVoucherPdfFilename,
  serviceLabel,
  stageLabel,
  statusLabel,
} from "@/lib/ops/record-detail";
import { readFileSync } from "node:fs";

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
  assert.equal(isOpsContactRow(copy.passengerNote, copy), false);
  assert.equal(isOpsContactRow(copy.notes, copy), false);
});

test("ops pricing rows are identified by selected price label and can be omitted from display", () => {
  assert.equal(isOpsPricingRow(copy.selectedPrice, copy), true);
  assert.equal(isOpsPricingRow(copy.flight, copy), false);
  assert.equal(isOpsPricingRow(copy.passengerCount, copy), false);
  const rows = [
    { label: copy.flight, value: "TK1925" },
    { label: copy.selectedPrice, value: "5.393,85 ₺" },
    { label: copy.passengerCount, value: "3" },
  ];
  assert.deepEqual(opsTransferRowsForDisplay(rows, copy, true), rows);
  assert.deepEqual(opsTransferRowsForDisplay(rows, copy, false), [
    { label: copy.flight, value: "TK1925" },
    { label: copy.passengerCount, value: "3" },
  ]);
});

test("reservation detail modal resets price visibility independently of contact visibility", () => {
  const modal = readFileSync(
    new URL("../../components/ops/record-detail-modal.tsx", import.meta.url),
    "utf8",
  );
  const ui = readFileSync(
    new URL("../../components/ops/record-detail.tsx", import.meta.url),
    "utf8",
  );
  const opsPdfRoute = readFileSync(
    new URL("../../app/[locale]/ops/(panel)/reservations/[id]/pdf/route.ts", import.meta.url),
    "utf8",
  );
  const voucherRoute = readFileSync(
    new URL("../../app/[locale]/ops/(panel)/reservations/[id]/voucher-pdf/route.ts", import.meta.url),
    "utf8",
  );
  const voucherPdf = readFileSync(
    new URL("../booking/reservation-voucher-pdf.ts", import.meta.url),
    "utf8",
  );
  const cancellationMail = readFileSync(
    new URL("./cancellation-customer-notification.ts", import.meta.url),
    "utf8",
  );
  const operationMail = readFileSync(
    new URL("../mail/send-operation-reservation-notification.ts", import.meta.url),
    "utf8",
  );
  const processPdfRoute = readFileSync(
    new URL("../../app/[locale]/ops/(panel)/processes/[id]/pdf/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(modal, /const \[pricingVisible, setPricingVisible\] = useState\(false\)/);
  assert.match(modal, /setPricingVisible\(false\)/);
  assert.match(modal, /setContactsVisible\(false\)/);
  assert.match(modal, /includePricing: pricingVisible/);
  assert.match(modal, /includeContact: contactsVisible/);
  assert.match(modal, /opsReservationPdfHref/);
  assert.doesNotMatch(modal, /voucherPdfHref.*includePricing|includePricing.*voucherPdf/);
  assert.match(ui, /copy\.showPricing/);
  assert.match(ui, /copy\.hidePricing/);
  assert.match(ui, /copy\.pricingInfo/);
  assert.match(ui, /ops-customer-heading/);
  assert.match(ui, /opsTransferRowsForDisplay\(detail\.transfer, copy, false\)/);
  assert.doesNotMatch(ui, /opsTransferRowsForDisplay\(detail\.transfer, copy, showReservationPricing\)/);
  assert.match(opsPdfRoute, /includePricing/);
  assert.match(opsPdfRoute, /parseOpsReservationPdfFlags/);
  assert.doesNotMatch(voucherRoute, /includePricing|pricingVisible|opsReservationPdfHref/);
  assert.doesNotMatch(voucherPdf, /includePricing|pricingVisible/);
  assert.doesNotMatch(cancellationMail, /includePricing|pricingVisible/);
  assert.match(operationMail, /includeContact:\s*true/);
  assert.doesNotMatch(operationMail, /includePricing:\s*false/);
  assert.doesNotMatch(processPdfRoute, /includePricing/);
  assert.equal(copy.showPricing, "Ücret bilgilerini göster");
  assert.equal(copy.hidePricing, "Ücret bilgilerini gizle");
  assert.equal(copy.pricingInfo, "Ücret Bilgileri");
  assert.equal(copy.contactInfo, "İletişim Bilgileri");
  assert.equal(opsCopy.en.showPricing, "Show price details");
  assert.equal(opsCopy.ru.showPricing, "Показать данные о стоимости");
  assert.equal(opsCopy.en.pricingInfo, "Price details");
  assert.equal(opsCopy.ru.pricingInfo, "Данные о стоимости");
});

test("passenger note is separate from driver/assignment notes", () => {
  assert.equal(copy.passengerNote, "Yolcu Notu");
  assert.equal(opsCopy.en.passengerNote, "Passenger Note");
  assert.equal(opsCopy.ru.passengerNote, "Заметка пассажира");
  assert.notEqual(copy.passengerNote, copy.notes);
  assert.equal(
    passengerNoteText("Kapıda beklerim\nPlease call"),
    "Kapıda beklerim\nPlease call",
  );
  const detailUi = readFileSync(
    new URL("../../components/ops/record-detail.tsx", import.meta.url),
    "utf8",
  );
  const pdf = readFileSync(new URL("./pdf.ts", import.meta.url), "utf8");
  const mapper = readFileSync(new URL("./record-detail.ts", import.meta.url), "utf8");
  assert.match(detailUi, /detail\.passengerNote/);
  assert.match(detailUi, /copy\.passengerNote/);
  assert.match(pdf, /drawPassengerNote/);
  assert.match(mapper, /passengerNote: passengerNoteText\(item\.notes\)/);
  assert.doesNotMatch(mapper, /row\(copy\.notes, displayText\(item\.notes\)\)/);
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
