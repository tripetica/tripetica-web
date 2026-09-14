import { localeDirection, type Locale } from "@/lib/i18n/config";
import {
  assignmentCustomerNotificationCopy,
  assignmentNotifyMailVariant,
} from "@/lib/mail/assignment-customer-notification-copy";
import {
  buildReservationMailContactSectionHtml,
  buildReservationMailContactSectionText,
} from "@/lib/mail/reservation-contact";
import {
  buildAssignmentNotifySummaryRows,
  type AssignmentNotifySummaryRow,
  type AssignmentNotifySummarySource,
} from "@/lib/mail/assignment-customer-notification-summary";
import {
  type AssignmentNotifyChangeKind,
  type AssignmentNotifyScope,
} from "@/lib/ops/assignment-customer-notification-view";

export type AssignmentNotifyMailFields = {
  locale: Locale;
  reservationCode: string;
  pickupAt: Date | null;
  scope: AssignmentNotifyScope;
  isUpdate: boolean;
  changeKind: AssignmentNotifyChangeKind | null;
  vehicleName: string;
  vehiclePlate: string;
  driverName: string | null;
  driverPhoneDisplay: string | null;
  summary?: AssignmentNotifySummarySource;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function variantCopy(input: AssignmentNotifyMailFields) {
  const copy = assignmentCustomerNotificationCopy[input.locale];
  const variant = assignmentNotifyMailVariant({
    isUpdate: input.isUpdate,
    scope: input.scope,
    changeKind: input.changeKind,
  });
  if (variant === "first-vehicle") {
    return {
      subject: copy.firstVehicleSubject,
      intro: copy.firstVehicleIntro,
      current: null as string | null,
      please: null as string | null,
    };
  }
  if (variant === "first-both") {
    return {
      subject: copy.firstBothSubject,
      intro: copy.firstBothIntro,
      current: null,
      please: null,
    };
  }
  if (variant === "update-driver") {
    return {
      subject: copy.updateDriverSubject,
      intro: copy.updateDriverIntro,
      current: copy.updateDriverCurrent,
      please: copy.updateDriverPlease,
    };
  }
  if (variant === "update-both") {
    return {
      subject: copy.updateBothSubject,
      intro: copy.updateBothIntro,
      current: copy.updateBothCurrent,
      please: copy.updateBothPlease,
    };
  }
  return {
    subject: copy.updateVehicleSubject,
    intro: copy.updateVehicleIntro,
    current: copy.updateVehicleCurrent,
    please: copy.updateVehiclePlease,
  };
}

function detailRows(input: AssignmentNotifyMailFields) {
  const copy = assignmentCustomerNotificationCopy[input.locale];
  const rows = [
    { label: copy.vehicle, value: input.vehicleName || "—" },
    { label: copy.plate, value: input.vehiclePlate || "—" },
  ];
  if (input.scope === "vehicle_and_driver") {
    rows.push(
      { label: copy.driver, value: input.driverName || "—" },
      { label: copy.phone, value: input.driverPhoneDisplay || "—" },
    );
  }
  return rows;
}

function summaryRows(input: AssignmentNotifyMailFields): AssignmentNotifySummaryRow[] {
  if (input.summary) {
    return buildAssignmentNotifySummaryRows(input.summary, input.locale);
  }
  return buildAssignmentNotifySummaryRows(
    {
      reservationCode: input.reservationCode,
      pickupAt: input.pickupAt,
      serviceType: null,
      tourCode: null,
      durationHours: null,
      customerFirstName: null,
      customerLastName: null,
      pickupNameCustomer: null,
      pickupNameTr: null,
      dropoffNameCustomer: null,
      dropoffNameTr: null,
      vehicleLabelCustomer: null,
      vehicleLabelTr: null,
      vehicleCode: null,
      passengers: [],
    },
    input.locale,
  );
}

function rowsHtml(
  rows: readonly { label: string; value: string }[],
  options: { muted?: boolean } = {},
) {
  const muted = options.muted === true;
  const fontSize = muted ? "13px" : "14px";
  const valueWeight = muted ? 500 : 600;
  return rows
    .map(
      (row) => `
      <tr>
        <td style="padding:7px 12px 7px 0;color:#667085;font-size:${fontSize};vertical-align:top;width:38%;">${escapeHtml(row.label)}</td>
        <td style="padding:7px 0;color:#172033;font-size:${fontSize};font-weight:${valueWeight};vertical-align:top;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join("");
}

function rowsText(rows: readonly { label: string; value: string }[]) {
  return rows.map((row) => `${row.label}: ${row.value}`).join("\n");
}

function sectionHeadingHtml(title: string) {
  return `<p style="margin:0 0 10px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#142e5c;font-weight:700;">${escapeHtml(title)}</p>`;
}

export function buildAssignmentCustomerNotificationBodies(
  input: AssignmentNotifyMailFields,
) {
  const copy = assignmentCustomerNotificationCopy[input.locale];
  const variant = variantCopy(input);
  const summary = summaryRows(input);
  const details = detailRows(input);
  const contactHtml = buildReservationMailContactSectionHtml(input.locale);
  const contactText = buildReservationMailContactSectionText(input.locale);
  const dir = localeDirection(input.locale);
  const assignmentTitle =
    input.scope === "vehicle_and_driver"
      ? copy.assignmentBothTitle
      : copy.assignmentVehicleTitle;
  const currentHtml = variant.current
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${escapeHtml(variant.current)}</p>`
    : "";
  const pleaseHtml = variant.please
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.5;">${escapeHtml(variant.please)}</p>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="${input.locale}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f6fa;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="background:#ffffff;border-radius:12px;padding:28px 24px;">
      <p style="margin:0 0 14px;font-size:16px;">${escapeHtml(copy.greeting)}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escapeHtml(variant.intro)}</p>
      ${currentHtml}
      ${sectionHeadingHtml(assignmentTitle)}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 22px;">
        ${rowsHtml(details)}
      </table>
      ${sectionHeadingHtml(copy.summaryTitle)}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 8px;">
        ${rowsHtml(summary, { muted: true })}
      </table>
      ${pleaseHtml}
      <p style="margin:20px 0 0;font-size:15px;line-height:1.5;">${escapeHtml(copy.help)}</p>
      <p style="margin:20px 0 0;font-size:14px;color:#667085;">${escapeHtml(copy.signOff)}<br />${escapeHtml(copy.brand)}</p>
      ${contactHtml}
    </div>
  </div>
</body>
</html>`;

  const currentText = variant.current ? `\n${variant.current}\n` : "\n";
  const pleaseText = variant.please ? `\n${variant.please}\n` : "\n";
  const text = `${copy.greeting}

${variant.intro}
${currentText}${assignmentTitle}
${rowsText(details)}

${copy.summaryTitle}
${rowsText(summary)}
${pleaseText}${copy.help}

${copy.signOff}
${copy.brand}

${contactText}
`;

  return {
    subject: variant.subject,
    html,
    text,
  };
}
