import { localeDirection, type Locale } from "@/lib/i18n/config";
import { assignmentCustomerNotificationCopy } from "@/lib/mail/assignment-customer-notification-copy";
import {
  cancellationCustomerNotificationCopy,
  cancellationCustomerNotificationGreeting,
} from "@/lib/mail/cancellation-customer-notification-copy";
import {
  buildReservationMailContactSectionHtml,
  buildReservationMailContactSectionText,
} from "@/lib/mail/reservation-contact";
import {
  buildAssignmentNotifySummaryRows,
  resolveAssignmentNotifyFirstPassengerName,
  type AssignmentNotifySummarySource,
} from "@/lib/mail/assignment-customer-notification-summary";

export type CancellationNotifyMailFields = {
  locale: Locale;
  summary: AssignmentNotifySummarySource;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rowsHtml(rows: readonly { label: string; value: string }[]) {
  return rows
    .map(
      (row) => `
      <tr>
        <td style="padding:7px 12px 7px 0;color:#667085;font-size:13px;vertical-align:top;width:38%;">${escapeHtml(row.label)}</td>
        <td style="padding:7px 0;color:#172033;font-size:13px;font-weight:500;vertical-align:top;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(row.value)}</td>
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

export function buildCancellationCustomerNotificationBodies(
  input: CancellationNotifyMailFields,
) {
  const copy = cancellationCustomerNotificationCopy[input.locale];
  const assignmentCopy = assignmentCustomerNotificationCopy[input.locale];
  const greeting = cancellationCustomerNotificationGreeting(
    input.locale,
    resolveAssignmentNotifyFirstPassengerName(input.summary),
  );
  const summary = buildAssignmentNotifySummaryRows(input.summary, input.locale);
  const contactHtml = buildReservationMailContactSectionHtml(input.locale);
  const contactText = buildReservationMailContactSectionText(input.locale);
  const dir = localeDirection(input.locale);
  const html = `<!DOCTYPE html>
<html lang="${input.locale}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f6fa;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="background:#ffffff;border-radius:12px;padding:28px 24px;">
      <p style="margin:0 0 14px;font-size:16px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escapeHtml(copy.intro)}</p>
      ${sectionHeadingHtml(copy.summaryTitle)}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 8px;">
        ${rowsHtml(summary)}
      </table>
      <p style="margin:20px 0 0;font-size:15px;line-height:1.5;">${escapeHtml(copy.help)}</p>
      ${contactHtml}
      <p style="margin:20px 0 0;font-size:14px;color:#667085;">${escapeHtml(assignmentCopy.signOff)}<br />${escapeHtml(assignmentCopy.brand)}</p>
    </div>
  </div>
</body>
</html>`;

  const text = `${greeting}

${copy.intro}

${copy.summaryTitle}
${rowsText(summary)}

${copy.help}

${contactText}

${assignmentCopy.signOff}
${assignmentCopy.brand}
`;

  return {
    subject: copy.subject(input.summary.reservationCode),
    html,
    text,
  };
}
