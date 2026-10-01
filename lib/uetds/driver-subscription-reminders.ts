/**
 * Partner email reminders for unpaid U-ETDS driver subscription periods.
 *
 * Design only for now: claim/idempotency helpers + mail copy builders.
 * Do NOT wire a production systemd timer until DEV send path is proven.
 *
 * Scheduler sketch (DEV first, assignment-alarm pattern):
 * - Poll enrolled drivers where next/current unpaid period needs a reminder.
 * - Claim via partner_driver_uetds_subscription_reminders UNIQUE
 *   (driver_id, period_year, period_month, reminder_kind) before send.
 * - Mark sent_at after SMTP success; never re-claim a sent row.
 * - Payment IBAN/details come from env (optional) so templates stay data-driven.
 */

import {
  addSubscriptionMonths,
  istanbulSubscriptionPeriodKey,
  periodStatusForKey,
  type UetdsSubscriptionPeriodKey,
  type UetdsSubscriptionPeriodRecord,
  type UetdsSubscriptionReminderKind,
} from "@/lib/uetds/driver-subscription";

export type UetdsSubscriptionPaymentDetails = {
  amountLabel: string | null;
  currency: string | null;
  iban: string | null;
  beneficiary: string | null;
  note: string | null;
};

export function shouldSendUetdsSubscriptionReminder(input: {
  enrolled: boolean;
  periods: readonly UetdsSubscriptionPeriodRecord[];
  targetPeriod: UetdsSubscriptionPeriodKey;
}): boolean {
  if (!input.enrolled) return false;
  const status = periodStatusForKey(input.periods, input.targetPeriod);
  return status === "unpaid";
}

/** Istanbul calendar day helpers for reminder scheduling. */
export function istanbulYmdParts(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Which reminder kinds are due for the upcoming/current unpaid month.
 * - two_days_before: Istanbul day == last day of previous month - 1 (2 days before period start)
 * - last_day: Istanbul day == last day of previous month
 * - expired: Istanbul day == first day of unpaid period (still unpaid)
 */
export function dueUetdsSubscriptionReminderKinds(input: {
  now?: Date;
}): Array<{ kind: UetdsSubscriptionReminderKind; period: UetdsSubscriptionPeriodKey }> {
  const now = input.now ?? new Date();
  const today = istanbulYmdParts(now);
  const current = istanbulSubscriptionPeriodKey(now);
  const next = addSubscriptionMonths(current, 1);
  const due: Array<{ kind: UetdsSubscriptionReminderKind; period: UetdsSubscriptionPeriodKey }> =
    [];

  const lastDayOfCurrent = daysInMonth(current.year, current.month);
  if (today.day === lastDayOfCurrent - 1 && lastDayOfCurrent - 1 >= 1) {
    due.push({ kind: "two_days_before", period: next });
  }
  if (today.day === lastDayOfCurrent) {
    due.push({ kind: "last_day", period: next });
  }
  if (today.day === 1) {
    due.push({ kind: "expired", period: current });
  }
  return due;
}

export function buildUetdsSubscriptionReminderEmail(input: {
  partnerName: string;
  driverFullName: string;
  periodLabel: string;
  kind: UetdsSubscriptionReminderKind;
  payment?: UetdsSubscriptionPaymentDetails | null;
}) {
  const paymentBlock = formatPaymentBlock(input.payment);
  if (input.kind === "expired") {
    const subject = `U-ETDS abonelik sona erdi — ${input.driverFullName}`;
    const text = `Sayın ${input.partnerName},

Şoförünüz ${input.driverFullName} için U-ETDS bildirim aboneliği (${input.periodLabel}) sona ermiştir. Bu şoför adına U-ETDS bildirimi gönderilebilmesi için aboneliğin yeniden aktif edilmesi gerekmektedir.
${paymentBlock}

Tripetica`;
    const html = `<p>Sayın ${escapeHtml(input.partnerName)},</p>
<p>Şoförünüz <strong>${escapeHtml(input.driverFullName)}</strong> için U-ETDS bildirim aboneliği (${escapeHtml(input.periodLabel)}) sona ermiştir. Bu şoför adına U-ETDS bildirimi gönderilebilmesi için aboneliğin yeniden aktif edilmesi gerekmektedir.</p>
${paymentBlockHtml(input.payment)}
<p>Tripetica</p>`;
    return { subject, text, html };
  }

  const subject = `U-ETDS abonelik yenileme — ${input.driverFullName}`;
  const timing =
    input.kind === "two_days_before"
      ? "yenilenme dönemi yaklaşmaktadır"
      : "yenilenme döneminin son günüdür";
  const text = `Sayın ${input.partnerName},

Şoförünüz ${input.driverFullName} için U-ETDS bildirim aboneliğinin ${timing} (${input.periodLabel}). Dönem başladığında abonelik hâlâ aktif değilse bu şoför ile U-ETDS bildirimi gönderilemez.
${paymentBlock}

Tripetica`;
  const html = `<p>Sayın ${escapeHtml(input.partnerName)},</p>
<p>Şoförünüz <strong>${escapeHtml(input.driverFullName)}</strong> için U-ETDS bildirim aboneliğinin ${timing} (${escapeHtml(input.periodLabel)}). Dönem başladığında abonelik hâlâ aktif değilse bu şoför ile U-ETDS bildirimi gönderilemez.</p>
${paymentBlockHtml(input.payment)}
<p>Tripetica</p>`;
  return { subject, text, html };
}

function formatPaymentBlock(payment?: UetdsSubscriptionPaymentDetails | null) {
  if (!payment) return "";
  const lines: string[] = [];
  if (payment.amountLabel && payment.currency) {
    lines.push(`Tutar: ${payment.amountLabel} ${payment.currency}`);
  }
  if (payment.iban) lines.push(`IBAN: ${payment.iban}`);
  if (payment.beneficiary) lines.push(`Alıcı: ${payment.beneficiary}`);
  if (payment.note) lines.push(payment.note);
  return lines.length ? `\nÖdeme bilgileri:\n${lines.join("\n")}\n` : "";
}

function paymentBlockHtml(payment?: UetdsSubscriptionPaymentDetails | null) {
  const text = formatPaymentBlock(payment).trim();
  if (!text) return "";
  return `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(text)}</pre>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Pure claim decision used by tests / future store. */
export function canClaimUetdsSubscriptionReminder(input: {
  existing: { reminderKind: UetdsSubscriptionReminderKind; sentAt: string | null } | null;
  kind: UetdsSubscriptionReminderKind;
}): boolean {
  if (!input.existing) return true;
  if (input.existing.reminderKind !== input.kind) return true;
  // Already claimed/sent for this kind → duplicate blocked.
  return false;
}
