import assert from "node:assert/strict";
import test from "node:test";
import { shapeArabicLine } from "@/lib/booking/voucher-pdf-arabic";
import { opsCopy } from "@/lib/ops/copy";
import { buildOpsRecordPdf } from "@/lib/ops/pdf";
import type { OpsRecordDetail } from "@/lib/ops/record-detail";

const copy = opsCopy.tr;

function sampleOpsDetail(): OpsRecordDetail {
  return {
    kind: "reservation",
    id: "00000000-0000-0000-0000-000000000003",
    brand: "Tripetica",
    title: "Özel Transfer & Taksi",
    code: "TRP-20260913-0003",
    status: "confirmed",
    pdfHref: "/tr/ops/reservations/x/pdf",
    pdfFilename: "TripeticaOps-TRP-20260913-0003.pdf",
    voucherPdfHref: null,
    voucherPdfFilename: null,
    summary: [{ label: copy.reservationCode, value: "TRP-20260913-0003" }],
    service: [{ label: copy.transferAt, value: "13.09.2026 20:35" }],
    transfer: [
      { label: copy.meetAndGreet, value: copy.no },
      { label: "Uçuş kodu", value: "TK1925" },
    ],
    places: [
      {
        label: copy.pickup,
        name: "مطار إسطنبول (IST)",
        address: "Istanbul Airport, Türkiye",
      },
      {
        label: copy.dropoff,
        name: "مطار صبيحة كوكجن (SAW)",
        address: "Sabiha Gokcen Airport, Istanbul",
      },
    ],
    pickupIsAirport: true,
    vehicle: [],
    selectedPrice: null,
    otherCurrencies: [],
    pricing: [],
    customer: [
      { label: copy.firstName, value: "أحمد" },
      { label: copy.lastName, value: "علي" },
      { label: copy.email, value: "guest@example.com" },
      { label: copy.phone, value: "+90 555 000 00 00" },
    ],
    passengerNote: "يرجى الانتظار عند الباب 3",
    passengers: [
      {
        sequenceNo: 1,
        firstName: "أحمد",
        lastName: "علي",
        nationality: "—",
        gender: "—",
        identity: "—",
        isPrimary: copy.yes,
      },
    ],
    technical: null,
    actionContext: null,
    paymentHistory: null,
    operationAssignment: null,
    driverTask: null,
  };
}

test("Ops PDF keeps Turkish labels and embeds Arabic only as a fallback face", async () => {
  const pdf = await buildOpsRecordPdf(sampleOpsDetail(), copy);
  const text = pdf.toString("latin1");
  assert.match(text, /NotoSans-Regular/);
  assert.match(text, /NotoSansArabic/);
  assert.match(text, /T\x00r\x00i\x00p\x00e\x00t\x00i\x00c\x00a/);
  assert.match(text, /T\x00R\x00P\x00-\x002\x000\x002\x006\x000\x009\x001\x003\x00-\x000\x000\x000\x003/);
});

test("Ops mixed Arabic reservation values keep LTR airport and flight codes", () => {
  assert.match(shapeArabicLine("مطار إسطنبول (IST)", "ltr"), /\(IST\)$/);
  assert.match(shapeArabicLine("مطار صبيحة كوكجن (SAW)", "ltr"), /\(SAW\)$/);
  assert.match(shapeArabicLine("رقم الرحلة TK1925", "ltr"), /TK1925$/);
});
