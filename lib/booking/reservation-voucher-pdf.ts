import "server-only";

import { join } from "node:path";
import PDFDocument from "pdfkit";
import { type ReservationVoucherData } from "@/lib/booking/reservation-voucher-access";
import {
  TRIPETICA_COMPANY_LEGAL,
  voucherCopy,
} from "@/lib/booking/voucher-copy";
import {
  contactDisplayNumbers,
  tripeticaEmail,
} from "@/lib/contact/links";
import { footerCopy } from "@/lib/footer/copy";
import { type Locale } from "@/lib/i18n/config";
import {
  attachArabicVoucherRendering,
  NOTO_SANS_ARABIC_BOLD,
  NOTO_SANS_ARABIC_REGULAR,
} from "@/lib/booking/voucher-pdf-arabic";

const FONT_REGULAR = join(process.cwd(), "lib/ops/fonts/NotoSans-Regular.ttf");
const FONT_BOLD = join(process.cwd(), "lib/ops/fonts/NotoSans-Bold.ttf");
const FONT_ARABIC_REGULAR = NOTO_SANS_ARABIC_REGULAR;
const FONT_ARABIC_BOLD = NOTO_SANS_ARABIC_BOLD;
const LOGO_PATH = join(process.cwd(), "public/tripetica-logo-horizontal.png");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LABEL_W = 118;
const LOGO_WIDTH = 118;
const LOGO_ASPECT = 345 / 1059;
const FOOTER_RESERVE = 34;

const COLOR_NAVY = "#142e5c";
const COLOR_TEXT = "#172033";
const COLOR_MUTED = "#667085";
const COLOR_BORDER = "#d8dee8";
const COLOR_ACCENT = "#4a8fd4";

type Copy = (typeof voucherCopy)[Locale];

export async function buildReservationVoucherPdf(
  data: ReservationVoucherData,
  _requestLocale?: Locale,
) {
  const locale = data.locale;
  const copy = voucherCopy[locale];
  const footer = footerCopy[locale];
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: `Tripetica — ${data.reservationCode}`,
      Author: "Tripetica",
    },
  });
  const done = collectPdf(doc);
  if (locale === "ar") {
    doc.registerFont("Voucher", FONT_ARABIC_REGULAR);
    doc.registerFont("Voucher-Bold", FONT_ARABIC_BOLD);
    attachArabicVoucherRendering(doc);
  } else {
    doc.registerFont("Voucher", FONT_REGULAR);
    doc.registerFont("Voucher-Bold", FONT_BOLD);
  }

  drawHeader(doc, data, copy, footer.tursab);
  drawReservationSection(doc, data, copy, locale);
  drawParticipantsSection(doc, data, locale);
  drawIncludedSection(doc, data, locale);
  drawServiceInfoSection(doc, data, locale);
  drawPassengerSection(doc, data, copy, locale);
  drawPaymentAndTotal(doc, copy, data);
  drawPolicySection(doc, copy, data);
  drawContactFooter(doc, copy);

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

function contentBottom() {
  return PAGE_HEIGHT - MARGIN - FOOTER_RESERVE;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > contentBottom()) {
    doc.addPage();
  }
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  data: ReservationVoucherData,
  copy: Copy,
  tursab: string,
) {
  const headerTop = doc.y;
  const leftWidth = CONTENT_WIDTH * 0.58;
  const rightX = MARGIN + leftWidth + 8;
  const rightWidth = CONTENT_WIDTH - leftWidth - 8;

  let logoHeight = 0;
  try {
    doc.image(LOGO_PATH, MARGIN, headerTop, { width: LOGO_WIDTH });
    logoHeight = LOGO_WIDTH * LOGO_ASPECT;
  } catch {
    doc
      .font("Voucher-Bold")
      .fontSize(14)
      .fillColor(COLOR_NAVY)
      .text("Tripetica", MARGIN, headerTop, { width: leftWidth });
    logoHeight = 16;
  }

  const companyTop = headerTop + logoHeight + 5;
  doc
    .font("Voucher")
    .fontSize(6.75)
    .fillColor(COLOR_MUTED)
    .text(TRIPETICA_COMPANY_LEGAL, MARGIN, companyTop, {
      width: leftWidth,
      lineGap: 1,
    });
  doc.text(tursab, MARGIN, doc.y, { width: leftWidth, lineGap: 1 });
  doc.text("tripetica.com", MARGIN, doc.y, { width: leftWidth });
  const leftBottom = doc.y;

  doc
    .font("Voucher-Bold")
    .fontSize(9.5)
    .fillColor(COLOR_MUTED)
    .text(copy.voucherLabel, rightX, headerTop + 2, {
      width: rightWidth,
      align: "right",
    });
  doc
    .font("Voucher")
    .fontSize(7.5)
    .fillColor(COLOR_MUTED)
    .text(copy.reservationCodeLabel, rightX, headerTop + 18, {
      width: rightWidth,
      align: "right",
    });
  doc
    .font("Voucher-Bold")
    .fontSize(13)
    .fillColor(COLOR_NAVY)
    .text(data.reservationCode, rightX, headerTop + 32, {
      width: rightWidth,
      align: "right",
    });

  doc.y = Math.max(leftBottom, headerTop + 50) + 8;
  drawDivider(doc);
}

function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  locale: Locale,
) {
  ensureSpace(doc, 20);
  const titleY = doc.y;
  const upperLocale =
    locale === "tr"
      ? "tr-TR"
      : locale === "ru"
        ? "ru-RU"
        : locale === "ar"
          ? "ar-SA"
          : "en-GB";
  doc
    .font("Voucher-Bold")
    .fontSize(8.75)
    .fillColor(COLOR_NAVY)
    .text(title.toLocaleUpperCase(upperLocale), MARGIN, titleY, {
      width: CONTENT_WIDTH,
    });
  const accentY = doc.y + 1.5;
  doc
    .strokeColor(COLOR_ACCENT)
    .lineWidth(1.1)
    .moveTo(MARGIN, accentY)
    .lineTo(MARGIN + 56, accentY)
    .stroke();
  doc.y = accentY + 6;
}

function drawDivider(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc
    .strokeColor(COLOR_BORDER)
    .lineWidth(0.7)
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + CONTENT_WIDTH, y)
    .stroke();
  doc.y = y + 8;
}

function drawStackField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  options?: { boldValue?: boolean },
) {
  ensureSpace(doc, 14);
  const y = doc.y;
  doc
    .font("Voucher")
    .fontSize(7.75)
    .fillColor(COLOR_MUTED)
    .text(label, MARGIN, y, { width: LABEL_W - 4 });
  const labelBottom = doc.y;
  doc
    .font(options?.boldValue ? "Voucher-Bold" : "Voucher")
    .fontSize(options?.boldValue ? 10 : 8.75)
    .fillColor(options?.boldValue ? COLOR_NAVY : COLOR_TEXT)
    .text(value || "—", MARGIN + LABEL_W, y, {
      width: CONTENT_WIDTH - LABEL_W,
      lineGap: 1,
    });
  doc.y = Math.max(labelBottom, doc.y) + 3;
}

function drawStackFieldWithNote(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  note: string,
) {
  const valueWidth = CONTENT_WIDTH - LABEL_W;
  const valueHeight = doc
    .font("Voucher")
    .fontSize(8.75)
    .heightOfString(value || "—", { width: valueWidth, lineGap: 1 });
  const noteHeight = doc
    .font("Voucher")
    .fontSize(7.75)
    .heightOfString(note, { width: valueWidth, lineGap: 1 });
  ensureSpace(doc, Math.max(14, valueHeight + noteHeight + 6));
  const y = doc.y;
  doc
    .font("Voucher")
    .fontSize(7.75)
    .fillColor(COLOR_MUTED)
    .text(label, MARGIN, y, { width: LABEL_W - 4 });
  const labelBottom = doc.y;
  doc
    .font("Voucher")
    .fontSize(8.75)
    .fillColor(COLOR_TEXT)
    .text(value || "—", MARGIN + LABEL_W, y, {
      width: valueWidth,
      lineGap: 1,
    });
  let bottom = doc.y;
  doc
    .font("Voucher")
    .fontSize(7.75)
    .fillColor(COLOR_MUTED)
    .text(note, MARGIN + LABEL_W, bottom + 1, {
      width: valueWidth,
      lineGap: 1,
    });
  bottom = doc.y;
  doc.y = Math.max(labelBottom, bottom) + 3;
}

function drawPlaceBlock(
  doc: PDFKit.PDFDocument,
  label: string,
  name: string,
  address: string,
) {
  ensureSpace(doc, 28);
  const y = doc.y;
  doc
    .font("Voucher")
    .fontSize(7.75)
    .fillColor(COLOR_MUTED)
    .text(label, MARGIN, y, { width: LABEL_W - 4 });
  const labelBottom = doc.y;
  doc
    .font("Voucher-Bold")
    .fontSize(9)
    .fillColor(COLOR_TEXT)
    .text(name || "—", MARGIN + LABEL_W, y, {
      width: CONTENT_WIDTH - LABEL_W,
      lineGap: 1,
    });
  let bottom = doc.y;
  if (address && address !== "—" && address !== name) {
    doc
      .font("Voucher")
      .fontSize(7.75)
      .fillColor(COLOR_MUTED)
      .text(address, MARGIN + LABEL_W, bottom + 1, {
        width: CONTENT_WIDTH - LABEL_W,
        lineGap: 1,
      });
    bottom = doc.y;
  }
  doc.y = Math.max(labelBottom, bottom) + 5;
}

function yn(value: boolean | null, yes: string, no: string) {
  if (value === true) {
    return yes;
  }
  if (value === false) {
    return no;
  }
  return "—";
}

function countText(value: number | null) {
  return value === null || value === undefined ? "—" : String(value);
}

function drawReservationSection(
  doc: PDFKit.PDFDocument,
  data: ReservationVoucherData,
  copy: Copy,
  locale: Locale,
) {
  drawSectionTitle(doc, copy.reservationSection, locale);

  drawStackField(doc, copy.serviceType, data.serviceTypeLabel);
  drawStackField(doc, copy.dateTimeLabel, data.dateTime);
  if (data.packageCoverageValue) {
    if (data.packageOverrunNote) {
      drawStackFieldWithNote(
        doc,
        copy.packageCoverageLabel,
        data.packageCoverageValue,
        data.packageOverrunNote,
      );
    } else {
      drawStackField(doc, copy.packageCoverageLabel, data.packageCoverageValue);
    }
  }
  if (data.packageExtraFeeNote) {
    drawStackField(doc, "", data.packageExtraFeeNote);
  }
  // Hourly package coverage already covers duration+km; avoid a duplicate duration row.
  if (data.durationValue && !data.packageCoverageValue) {
    if (data.durationKmOverrunNote) {
      drawStackFieldWithNote(
        doc,
        copy.durationLabel,
        data.durationValue,
        data.durationKmOverrunNote,
      );
    } else {
      drawStackField(doc, copy.durationLabel, data.durationValue);
    }
  }
  drawPlaceBlock(doc, copy.pickupPoint, data.pickupName, data.pickupAddress);
  if (data.showDropoff) {
    drawPlaceBlock(doc, copy.dropoffPoint, data.dropoffName, data.dropoffAddress);
  }
  if (data.showVehicleClass) {
    if (data.vehicleSubtitle) {
      drawStackFieldWithNote(
        doc,
        copy.vehicleClass,
        data.vehicleLabel,
        data.vehicleSubtitle,
      );
    } else {
      drawStackField(doc, copy.vehicleClass, data.vehicleLabel);
    }
  }
  if (data.showDistance && data.distanceLabel) {
    drawStackField(doc, copy.distance, data.distanceLabel);
  }
  // Bosphorus participants render in their own section (see drawParticipantsSection).
  if (data.participantBreakdown && data.participantBreakdownHeading) {
    if (!data.includedItems) {
      drawPassengerNameList(
        doc,
        data.participantBreakdownHeading,
        data.participantBreakdown,
      );
    }
  } else {
    drawStackField(doc, copy.passengers, countText(data.passengerCount));
  }
  if (data.luggageCount !== null) {
    drawStackField(doc, copy.luggage, countText(data.luggageCount));
  }
  if (data.babySeatCount !== null && data.babySeatCount > 0) {
    drawStackField(doc, copy.babySeats, countText(data.babySeatCount));
  }
  if (data.flightCode) {
    drawStackField(doc, copy.flight, data.flightCode);
  }
  if (data.showMeetAndGreet) {
    drawStackField(
      doc,
      copy.meetAndGreet,
      yn(data.meetAndGreet, copy.yes, copy.no),
    );
  }
  doc.y += 2;
}

function drawParticipantsSection(
  doc: PDFKit.PDFDocument,
  data: ReservationVoucherData,
  locale: Locale,
) {
  if (
    !data.includedItems ||
    !data.participantBreakdown ||
    !data.participantBreakdownHeading ||
    data.participantBreakdown.length === 0
  ) {
    return;
  }
  drawSectionTitle(doc, data.participantBreakdownHeading, locale);
  drawBulletList(doc, data.participantBreakdown);
  doc.y += 2;
}

function drawIncludedSection(
  doc: PDFKit.PDFDocument,
  data: ReservationVoucherData,
  locale: Locale,
) {
  if (!data.includedSectionTitle || !data.includedItems?.length) {
    return;
  }
  drawSectionTitle(doc, data.includedSectionTitle, locale);
  drawBulletList(doc, data.includedItems);
  doc.y += 2;
}

function drawServiceInfoSection(
  doc: PDFKit.PDFDocument,
  data: ReservationVoucherData,
  locale: Locale,
) {
  if (!data.serviceInfoSectionTitle || !data.serviceInfoGroups?.length) {
    return;
  }
  drawSectionTitle(doc, data.serviceInfoSectionTitle, locale);
  drawInfoGroups(doc, data.serviceInfoGroups);
  doc.y += 2;
}

function drawInfoGroups(
  doc: PDFKit.PDFDocument,
  groups: Array<{ title: string; body: string }>,
) {
  for (const group of groups) {
    const titleHeight = doc
      .font("Voucher-Bold")
      .fontSize(8.5)
      .heightOfString(group.title, { width: CONTENT_WIDTH });
    const bodyHeight = doc
      .font("Voucher")
      .fontSize(8.25)
      .heightOfString(group.body, { width: CONTENT_WIDTH, lineGap: 1 });
    ensureSpace(doc, titleHeight + bodyHeight + 7);
    doc
      .font("Voucher-Bold")
      .fontSize(8.5)
      .fillColor(COLOR_TEXT)
      .text(group.title, { width: CONTENT_WIDTH });
    doc
      .font("Voucher")
      .fontSize(8.25)
      .fillColor(COLOR_MUTED)
      .text(group.body, { width: CONTENT_WIDTH, lineGap: 1 });
    doc.y += 4;
  }
}

function drawBulletList(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    ensureSpace(doc, 14);
    const y = doc.y;
    const bulletX = MARGIN;
    const textX = MARGIN + 12;
    const textWidth = CONTENT_WIDTH - 12;
    doc
      .font("Voucher")
      .fontSize(8.75)
      .fillColor(COLOR_TEXT)
      .text("•", bulletX, y, { width: 10, lineBreak: false });
    doc
      .font("Voucher")
      .fontSize(8.75)
      .fillColor(COLOR_TEXT)
      .text(item, textX, y, {
        width: textWidth,
        lineGap: 1.1,
      });
    doc.y += 2;
  }
}

function drawPassengerNameList(
  doc: PDFKit.PDFDocument,
  label: string,
  names: string[],
) {
  if (names.length === 0) {
    return;
  }
  ensureSpace(doc, 16 + names.length * 11);
  const y = doc.y;
  doc
    .font("Voucher")
    .fontSize(7.75)
    .fillColor(COLOR_MUTED)
    .text(label, MARGIN, y, { width: LABEL_W - 4 });
  const labelBottom = doc.y;
  doc
    .font("Voucher")
    .fontSize(8.75)
    .fillColor(COLOR_TEXT)
    .text(names.join("\n"), MARGIN + LABEL_W, y, {
      width: CONTENT_WIDTH - LABEL_W,
      lineGap: 2,
    });
  doc.y = Math.max(labelBottom, doc.y) + 3;
}

function drawPassengerSection(
  doc: PDFKit.PDFDocument,
  data: ReservationVoucherData,
  copy: Copy,
  locale: Locale,
) {
  drawSectionTitle(doc, copy.passengerSection, locale);
  drawStackField(doc, copy.phone, data.contactPhone);
  drawStackField(doc, copy.email, data.contactEmail);
  drawPassengerNameList(doc, copy.passengerList, data.passengerNames);
  if (data.passengerNote) {
    drawStackField(doc, copy.passengerNote, data.passengerNote);
  }
  doc.y += 4;
}

function drawPaymentAndTotal(
  doc: PDFKit.PDFDocument,
  copy: Copy,
  data: ReservationVoucherData,
) {
  ensureSpace(doc, data.otherCurrencyLine ? 48 : 36);
  drawStackField(doc, copy.paymentMethod, data.paymentMethodLabel);
  drawStackField(doc, copy.total, data.totalLabel, { boldValue: true });
  if (data.otherCurrencyLine) {
    doc
      .font("Voucher")
      .fontSize(7)
      .fillColor(COLOR_MUTED)
      .text(
        `${copy.otherCurrencyEquivalents}: ${data.otherCurrencyLine}`,
        MARGIN + LABEL_W,
        doc.y,
        { width: CONTENT_WIDTH - LABEL_W, lineGap: 1 },
      );
    doc.y += 4;
  }
  doc.y += 2;
}

function drawPolicySection(
  doc: PDFKit.PDFDocument,
  copy: Copy,
  data: ReservationVoucherData,
) {
  if (data.cancelPolicyTitle && data.cancelPolicyBody) {
    ensureSpace(doc, 20);
    const titleY = doc.y;
    doc
      .font("Voucher-Bold")
      .fontSize(8.5)
      .fillColor(COLOR_NAVY)
      .text(data.cancelPolicyTitle, MARGIN, titleY, { width: CONTENT_WIDTH });
    const accentY = doc.y + 1.5;
    doc
      .strokeColor(COLOR_ACCENT)
      .lineWidth(1.1)
      .moveTo(MARGIN, accentY)
      .lineTo(MARGIN + 56, accentY)
      .stroke();
    doc.y = accentY + 5;
    ensureSpace(doc, 36);
    doc
      .font("Voucher")
      .fontSize(7.15)
      .fillColor(COLOR_TEXT)
      .text(data.cancelPolicyBody, MARGIN, doc.y, {
        width: CONTENT_WIDTH,
        lineGap: 1.05,
        align: "left",
      });
    doc.y += 4;
    return;
  }

  // Keep Turkish dotted İ intact for this heading (already provided uppercase).
  ensureSpace(doc, 20);
  const titleY = doc.y;
  doc
    .font("Voucher-Bold")
    .fontSize(8.5)
    .fillColor(COLOR_NAVY)
    .text(copy.policySectionTitle, MARGIN, titleY, { width: CONTENT_WIDTH });
  const accentY = doc.y + 1.5;
  doc
    .strokeColor(COLOR_ACCENT)
    .lineWidth(1.1)
    .moveTo(MARGIN, accentY)
    .lineTo(MARGIN + 56, accentY)
    .stroke();
  doc.y = accentY + 5;

  const finalWaitingBlock =
    data.waitingPolicyKind === "hourly"
      ? {
          title: copy.policyHourlyWaitingTitle,
          body: copy.policyHourlyWaitingBody,
        }
      : data.waitingPolicyKind === "tour"
        ? {
            title: copy.policyTourWaitingTitle,
            body: copy.policyTourWaitingBody,
          }
        : { title: copy.policyNoShowTitle, body: copy.policyNoShowBody };
  const blocks: Array<{ title: string; body: string }> = [
    { title: copy.policyCancelTitle, body: copy.policyCancelBody },
    { title: copy.policyWaitingTitle, body: copy.policyWaitingBody },
    finalWaitingBlock,
  ];

  for (const block of blocks) {
    const titleHeight = doc
      .font("Voucher-Bold")
      .fontSize(7.5)
      .heightOfString(block.title, { width: CONTENT_WIDTH, lineGap: 0.5 });
    const bodyHeight = doc
      .font("Voucher")
      .fontSize(7.15)
      .heightOfString(block.body, {
        width: CONTENT_WIDTH,
        lineGap: 1.05,
      });
    ensureSpace(doc, titleHeight + bodyHeight + 8);
    doc
      .font("Voucher-Bold")
      .fontSize(7.5)
      .fillColor(COLOR_TEXT)
      .text(block.title, MARGIN, doc.y, {
        width: CONTENT_WIDTH,
        lineGap: 0.5,
      });
    doc
      .font("Voucher")
      .fontSize(7.15)
      .fillColor(COLOR_TEXT)
      .text(block.body, MARGIN, doc.y + 1, {
        width: CONTENT_WIDTH,
        lineGap: 1.05,
        align: "left",
      });
    doc.y += 4;
  }
}

function drawContactFooter(doc: PDFKit.PDFDocument, copy: Copy) {
  const line = [
    copy.contactSection,
    contactDisplayNumbers.phone,
    `WhatsApp ${contactDisplayNumbers.messaging}`,
    tripeticaEmail,
    "tripetica.com",
  ].join(" · ");

  const footerBlock = 26;
  const pageBottom = PAGE_HEIGHT - MARGIN;
  let footerTop = pageBottom - footerBlock;

  if (doc.y + 6 > footerTop) {
    // Prefer staying on the current page when a few points remain;
    // only add a page when the footer truly cannot fit.
    if (doc.y + footerBlock <= pageBottom) {
      footerTop = doc.y + 8;
    } else {
      doc.addPage();
      footerTop = MARGIN;
    }
  }

  doc
    .strokeColor(COLOR_BORDER)
    .lineWidth(0.7)
    .moveTo(MARGIN, footerTop)
    .lineTo(MARGIN + CONTENT_WIDTH, footerTop)
    .stroke();
  doc
    .font("Voucher")
    .fontSize(7)
    .fillColor(COLOR_MUTED)
    .text(line, MARGIN, footerTop + 5, {
      width: CONTENT_WIDTH,
      align: "center",
      lineGap: 1,
    });
}
