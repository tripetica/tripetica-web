import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
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
      { label: copy.selectedPrice, value: "5.393,85 ₺", emphasizeValue: true, strongAmount: true },
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
    selectedPrice: "5.393,85 ₺",
    otherCurrencies: ["111,02 $", "95,68 €", "9.934,97 ₽", "82,09 £"],
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

function pdfToUnicodeCodes(pdf: Buffer) {
  const latin1 = pdf.toString("binary");
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const codes = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(latin1))) {
    let inflated = "";
    try {
      inflated = inflateSync(Buffer.from(match[1], "binary")).toString("latin1");
    } catch {
      continue;
    }
    if (!inflated.includes("begincmap")) {
      continue;
    }
    for (const hex of inflated.matchAll(/<([0-9a-fA-F]{4})>/g)) {
      codes.add(hex[1].toUpperCase());
    }
  }
  return codes;
}

function pdfHasUnicode(pdf: Buffer, char: string) {
  const code = char
    .codePointAt(0)
    ?.toString(16)
    .toUpperCase()
    .padStart(4, "0");
  return Boolean(code && pdfToUnicodeCodes(pdf).has(code));
}

test("Ops PDF includes reservation pricing by default and when includePricing is true", async () => {
  const withDefault = await buildOpsRecordPdf(sampleOpsDetail(), copy);
  const withFlag = await buildOpsRecordPdf(sampleOpsDetail(), copy, {
    includeContact: false,
    includePricing: true,
  });
  for (const pdf of [withDefault, withFlag]) {
    assert.equal(pdfHasUnicode(pdf, "₺"), true);
    assert.equal(pdfHasUnicode(pdf, "$"), true);
    assert.equal(pdfHasUnicode(pdf, "€"), true);
    assert.match(pdf.toString("latin1"), /T\x00R\x00P\x00-\x002\x000\x002\x006\x000\x009\x001\x003\x00-\x000\x000\x000\x003/);
  }
});

test("Ops PDF omits pricing presentation entirely when includePricing is false", async () => {
  const pdf = await buildOpsRecordPdf(sampleOpsDetail(), copy, {
    includeContact: true,
    includePricing: false,
  });
  assert.equal(pdfHasUnicode(pdf, "₺"), false);
  assert.equal(pdfHasUnicode(pdf, "$"), false);
  assert.equal(pdfHasUnicode(pdf, "€"), false);
  assert.equal(pdfHasUnicode(pdf, "₽"), false);
  assert.equal(pdfHasUnicode(pdf, "£"), false);
  assert.doesNotMatch(pdf.toString("latin1"), /display:none|visibility:hidden/);
  assert.match(pdf.toString("latin1"), /T\x00R\x00P\x00-\x002\x000\x002\x006\x000\x009\x001\x003\x00-\x000\x000\x000\x003/);
  const source = readFileSync(new URL("../ops/pdf.ts", import.meta.url), "utf8");
  assert.match(source, /includePricing/);
  assert.match(source, /opsTransferRowsForDisplay/);
  assert.doesNotMatch(source, /display:\s*none|visibility:\s*hidden/);
});
