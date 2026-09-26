import "server-only";

import { join } from "node:path";
import PDFDocument from "pdfkit";
import {
  attachArabicPdfRendering,
  NOTO_SANS_ARABIC_BOLD,
  NOTO_SANS_ARABIC_REGULAR,
} from "@/lib/booking/voucher-pdf-arabic";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  isOpsContactRow,
  opsTransferRowsForDisplay,
  reservationStatusLabel,
  type OpsRecordDetail,
} from "@/lib/ops/record-detail";

const FONT_REGULAR = join(process.cwd(), "lib/ops/fonts/NotoSans-Regular.ttf");
const FONT_BOLD = join(process.cwd(), "lib/ops/fonts/NotoSans-Bold.ttf");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LABEL_WIDTH = 132;
/** Soft bottom of the printable area (matches PDFKit bottom margin). */
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN;

export async function buildOpsRecordPdf(
  detail: OpsRecordDetail,
  copy: OpsCopy,
  options?: { includeContact?: boolean; includePricing?: boolean },
) {
  const includeContact = options?.includeContact !== false;
  const includePricing = options?.includePricing !== false;
  const isReservation = detail.kind === "reservation";
  const customer = isReservation
    ? includeContact
      ? detail.customer.filter((item) => isOpsContactRow(item.label, copy))
      : []
    : detail.customer;
  const transfer = opsTransferRowsForDisplay(
    detail.pickupIsAirport
      ? detail.transfer
      : detail.transfer.filter((item) => item.label !== copy.meetAndGreet),
    copy,
    includePricing,
  );
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: ["Tripetica", detail.title, detail.code].filter(Boolean).join(" — "),
      Author: "Tripetica",
    },
  });
  const done = collectPdf(doc);
  doc.registerFont("Ops", FONT_REGULAR);
  doc.registerFont("Ops-Bold", FONT_BOLD);
  doc.registerFont("Ops-Arabic", NOTO_SANS_ARABIC_REGULAR);
  doc.registerFont("Ops-Arabic-Bold", NOTO_SANS_ARABIC_BOLD);
  attachArabicPdfRendering(doc, {
    paragraphDir: "ltr",
    forceRtlAlign: false,
    resolveArabicFont(currentFont) {
      if (currentFont === "Ops-Bold" || currentFont === "Ops-Arabic-Bold") {
        return "Ops-Arabic-Bold";
      }
      return "Ops-Arabic";
    },
  });

  drawHeader(doc, detail, copy, isReservation);
  drawRows(doc, detail.service);
  drawPlacesAsRows(doc, detail.places);
  drawRows(doc, detail.vehicle);
  drawRows(doc, transfer);
  if (includePricing && !isReservation && detail.selectedPrice) {
    drawRows(doc, [{ label: copy.selectedPrice, value: detail.selectedPrice }]);
  }
  if (includePricing) {
    drawAlternateCurrencies(doc, copy, detail, isReservation);
  }
  if (customer.length > 0) {
    drawSection(doc, isReservation ? copy.contactInfo : copy.customer, customer);
  }
  if (detail.passengerNote) {
    drawPassengerNote(doc, copy.passengerNote, detail.passengerNote);
  }
  drawPassengers(doc, copy, detail, isReservation);
  if (detail.technical && detail.technical.length > 0) {
    drawSection(doc, copy.technical, detail.technical);
  }
  // No fixed footer: drawing below PDFKit's bottom margin previously forced
  // an empty second page even when all reservation content fit on page 1.
  doc.end();
  return done;
}

function collectPdf(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  detail: OpsRecordDetail,
  copy: OpsCopy,
  isReservation: boolean,
) {
  doc.font("Ops-Bold").fontSize(14).fillColor("#142e5c").text("Tripetica", {
    width: CONTENT_WIDTH,
  });
  doc.moveDown(0.1);
  doc.font("Ops-Bold").fontSize(12).fillColor("#172033").text(detail.title, {
    width: CONTENT_WIDTH,
  });
  if (detail.code) {
    doc.moveDown(0.08);
    doc.font("Ops-Bold").fontSize(11).fillColor("#142e5c").text(detail.code, {
      width: CONTENT_WIDTH,
    });
  }
  doc.moveDown(0.25);

  if (isReservation) {
    const meta: OpsRecordDetail["transfer"] = [...detail.summary];
    if (detail.status) {
      meta.push({
        label: copy.status,
        value: reservationStatusLabel(detail.status, copy),
      });
    }
    drawRows(doc, meta);
  } else {
    drawRows(doc, detail.summary);
  }
}

function drawPassengerNote(
  doc: PDFKit.PDFDocument,
  title: string,
  note: string,
) {
  const height = doc.font("Ops").fontSize(9).heightOfString(note, {
    width: CONTENT_WIDTH,
    lineGap: 1.5,
  });
  ensureSpace(doc, 28 + height);
  doc.moveDown(0.28);
  doc.font("Ops-Bold").fontSize(10).fillColor("#142e5c").text(title, {
    width: CONTENT_WIDTH,
  });
  doc.moveDown(0.12);
  doc
    .font("Ops")
    .fontSize(9)
    .fillColor("#172033")
    .text(note, { width: CONTENT_WIDTH, lineGap: 1.5 });
}

function drawSection(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: OpsRecordDetail["transfer"],
) {
  if (rows.length === 0) {
    return;
  }
  ensureSpace(doc, 36);
  doc.moveDown(0.28);
  doc.font("Ops-Bold").fontSize(10).fillColor("#142e5c").text(title, {
    width: CONTENT_WIDTH,
  });
  doc.moveDown(0.12);
  drawRows(doc, rows);
}

function drawAlternateCurrencies(
  doc: PDFKit.PDFDocument,
  copy: OpsCopy,
  detail: OpsRecordDetail,
  isReservation: boolean,
) {
  if (detail.otherCurrencies.length === 0) {
    return;
  }
  ensureSpace(doc, 28);
  doc.moveDown(0.18);
  doc
    .font("Ops-Bold")
    .fontSize(8)
    .fillColor("#4a5870")
    .text(
      isReservation ? copy.alternatePaymentHint : copy.otherCurrencies,
      { width: CONTENT_WIDTH },
    );
  doc.moveDown(0.08);
  if (isReservation) {
    doc
      .font("Ops")
      .fontSize(9)
      .fillColor("#172033")
      .text(detail.otherCurrencies.join(" · "), {
        width: CONTENT_WIDTH,
        lineGap: 1.5,
      });
  } else {
    doc.font("Ops").fontSize(9).fillColor("#172033");
    for (const item of detail.otherCurrencies) {
      doc.text(item, { width: CONTENT_WIDTH });
    }
  }
}

function drawPlacesAsRows(
  doc: PDFKit.PDFDocument,
  places: OpsRecordDetail["places"],
) {
  const valueWidth = CONTENT_WIDTH - LABEL_WIDTH - 8;
  for (const place of places) {
    if (!place.name && !place.address) {
      continue;
    }
    const nameHeight = place.name
      ? doc
          .font("Ops-Bold")
          .fontSize(9.5)
          .heightOfString(place.name, { width: valueWidth })
      : 0;
    const addressHeight = place.address
      ? doc
          .font("Ops")
          .fontSize(8.5)
          .heightOfString(place.address, { width: valueWidth })
      : 0;
    const valueHeight = nameHeight + (place.address ? addressHeight + 1 : 0);
    const labelHeight = doc
      .font("Ops")
      .fontSize(8.5)
      .heightOfString(place.label, { width: LABEL_WIDTH });
    const height = Math.max(labelHeight, valueHeight, 11);
    ensureSpace(doc, height + 4);
    const y = doc.y;
    doc
      .font("Ops")
      .fontSize(8.5)
      .fillColor("#5b6575")
      .text(place.label, MARGIN, y, { width: LABEL_WIDTH });
    let valueY = y;
    if (place.name) {
      doc
        .font("Ops-Bold")
        .fontSize(9.5)
        .fillColor("#172033")
        .text(place.name, MARGIN + LABEL_WIDTH + 8, valueY, {
          width: valueWidth,
        });
      valueY = doc.y;
    }
    if (place.address) {
      doc
        .font("Ops")
        .fontSize(8.5)
        .fillColor("#3d4a5c")
        .text(place.address, MARGIN + LABEL_WIDTH + 8, valueY + 1, {
          width: valueWidth,
          lineGap: 0.5,
        });
    }
    doc.y = y + height + 2.5;
  }
}

function drawRows(doc: PDFKit.PDFDocument, rows: OpsRecordDetail["transfer"]) {
  const valueWidth = CONTENT_WIDTH - LABEL_WIDTH - 8;
  for (const item of rows) {
    const valueFont = item.emphasizeValue ? "Ops-Bold" : "Ops";
    const valueSize = item.emphasizeValue ? 9.5 : 8.5;
    const labelHeight = doc
      .font("Ops")
      .fontSize(8.5)
      .heightOfString(item.label, { width: LABEL_WIDTH });
    const valueHeight = doc
      .font(valueFont)
      .fontSize(valueSize)
      .heightOfString(item.value, { width: valueWidth });
    const noteHeight = item.note
      ? doc
          .font("Ops")
          .fontSize(7.5)
          .heightOfString(item.note, { width: valueWidth })
      : 0;
    const height = Math.max(labelHeight, valueHeight + noteHeight, 11);
    ensureSpace(doc, height + 4);
    const y = doc.y;
    doc.font("Ops").fontSize(8.5).fillColor("#5b6575").text(item.label, MARGIN, y, {
      width: LABEL_WIDTH,
    });
    doc
      .font(valueFont)
      .fontSize(valueSize)
      .fillColor("#172033")
      .text(item.value, MARGIN + LABEL_WIDTH + 8, y, {
        width: valueWidth,
      });
    if (item.note) {
      const noteY = y + valueHeight + 1;
      doc
        .font("Ops")
        .fontSize(7.5)
        .fillColor("#667085")
        .text(item.note, MARGIN + LABEL_WIDTH + 8, noteY, {
          width: valueWidth,
          lineGap: 0.5,
        });
    }
    doc.y = y + height + 2.5;
  }
}

function drawPassengers(
  doc: PDFKit.PDFDocument,
  copy: OpsCopy,
  detail: OpsRecordDetail,
  isReservation: boolean,
) {
  ensureSpace(doc, 48);
  doc.moveDown(0.28);
  doc.font("Ops-Bold").fontSize(10).fillColor("#142e5c").text(copy.passengerInfo, {
    width: CONTENT_WIDTH,
  });
  doc.moveDown(0.15);
  if (detail.passengers.length === 0) {
    doc
      .font("Ops")
      .fontSize(8.5)
      .fillColor("#5b6575")
      .text(copy.noPassengers, { width: CONTENT_WIDTH });
    return;
  }

  const cols = isReservation
    ? [
        { key: "sequenceNo" as const, label: "#", width: 24 },
        { key: "firstName" as const, label: copy.firstName, width: 88 },
        { key: "lastName" as const, label: copy.lastName, width: 92 },
        { key: "nationality" as const, label: copy.nationality, width: 110 },
        { key: "gender" as const, label: copy.gender, width: 70 },
        { key: "identity" as const, label: copy.identity, width: 139 },
      ]
    : [
        { key: "sequenceNo" as const, label: "#", width: 22 },
        { key: "firstName" as const, label: copy.firstName, width: 78 },
        { key: "lastName" as const, label: copy.lastName, width: 78 },
        { key: "nationality" as const, label: copy.nationality, width: 90 },
        { key: "gender" as const, label: copy.gender, width: 58 },
        { key: "identity" as const, label: copy.identity, width: 92 },
        { key: "isPrimary" as const, label: copy.primary, width: 81 },
      ];

  const headerHeight = 14;
  ensureSpace(doc, headerHeight + 16);
  let x = MARGIN;
  const headerY = doc.y;
  doc.rect(MARGIN, headerY, CONTENT_WIDTH, headerHeight).fill("#f3f6fb");
  doc.fillColor("#4a5870").font("Ops-Bold").fontSize(7.5);
  for (const col of cols) {
    doc.text(col.label, x + 2, headerY + 3, { width: col.width - 4 });
    x += col.width;
  }
  doc.y = headerY + headerHeight + 2;
  for (const passenger of detail.passengers) {
    const cells = cols.map((col) =>
      detail.kind === "reservation" && col.key === "identity" && passenger.identity.trim() && passenger.identity !== "—"
        ? "11111111111"
        : String(passenger[col.key]),
    );
    const rowHeight =
      Math.max(
        ...cols.map((col, index) =>
          doc
            .font("Ops")
            .fontSize(7.5)
            .heightOfString(cells[index], { width: col.width - 4 }),
        ),
        10,
      ) + 4;
    ensureSpace(doc, rowHeight + 2);
    const y = doc.y;
    x = MARGIN;
    doc.font("Ops").fontSize(7.5).fillColor("#172033");
    for (let i = 0; i < cols.length; i += 1) {
      doc.text(cells[i], x + 2, y, { width: cols[i].width - 4 });
      x += cols[i].width;
    }
    doc
      .moveTo(MARGIN, y + rowHeight)
      .lineTo(MARGIN + CONTENT_WIDTH, y + rowHeight)
      .strokeColor("#edf1f6")
      .lineWidth(0.5)
      .stroke();
    doc.y = y + rowHeight + 1;
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed <= CONTENT_BOTTOM) {
    return;
  }
  doc.addPage();
}
