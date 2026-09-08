import "server-only";

import { query } from "@/lib/db/postgres";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  formatCurrencyPill,
  isDisplayCurrency,
  normalizeDisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import { reservationMailCopy } from "@/lib/mail/reservation-copy";
import {
  reservationMailFromAddress,
  sendReservationSmtpMail,
} from "@/lib/mail/smtp";
import { ONLINE_PAYMENT_METHOD } from "@/lib/payments/online-payment";

type PaymentMailRow = {
  id: string;
  reservation_code: string;
  locale: string | null;
  customer_email: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_amount: string | null;
  payment_currency: string | null;
  total_price: string | null;
  currency: string | null;
  payment_confirmation_email_sent_at: Date | null;
};

function reservationMailFrom() {
  return reservationMailFromAddress();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatPaidAmount(
  amountRaw: string | null,
  currencyRaw: string | null,
  locale: Locale,
) {
  const amount = amountRaw == null ? NaN : Number(amountRaw);
  const currency = normalizeDisplayCurrency(currencyRaw ?? "");
  if (!Number.isFinite(amount) || !isDisplayCurrency(currency)) {
    if (Number.isFinite(amount) && currencyRaw?.trim()) {
      return `${amount} ${currencyRaw.trim().toUpperCase()}`;
    }
    return "—";
  }
  return formatCurrencyPill(currency, amount, locale);
}

async function markPaymentConfirmationSent(reservationId: string) {
  await query(
    `UPDATE reservations
     SET payment_confirmation_email_sent_at = NOW()
     WHERE id = $1
       AND payment_confirmation_email_sent_at IS NULL`,
    [reservationId],
  );
}

/**
 * Short payment-received email after trusted server-side payment confirmation.
 * Idempotent per reservation. Does not include IST meet content or PDF.
 */
export async function sendPaymentConfirmationEmail(
  reservationId: string,
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const id = reservationId.trim();
  const deliveryStartedAt = performance.now();
  let smtpStartedAt: number | null = null;
  if (!id) {
    return { ok: false, error: "missing_reservation_id" };
  }

  try {
    const result = await query<PaymentMailRow>(
      `SELECT
          id,
          reservation_code,
          locale,
          customer_email,
          payment_method,
          payment_status,
          payment_amount::text,
          payment_currency,
          total_price::text,
          currency,
          payment_confirmation_email_sent_at
       FROM reservations
       WHERE id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      console.error("[reservation-mail] payment confirmation skipped — not found", {
        reservationId: id,
      });
      return { ok: false, error: "not_found" };
    }
    if (row.payment_confirmation_email_sent_at) {
      return { ok: true, skipped: true };
    }
    if ((row.payment_method ?? "").trim().toLowerCase() !== ONLINE_PAYMENT_METHOD) {
      return { ok: true, skipped: true };
    }
    if ((row.payment_status ?? "").trim().toLowerCase() !== "paid") {
      return { ok: true, skipped: true };
    }

    const email = row.customer_email?.trim().toLowerCase() ?? "";
    if (!email || !email.includes("@")) {
      console.error("[reservation-mail] payment confirmation skipped — missing email", {
        reservationId: id,
        reservationCode: row.reservation_code,
      });
      return { ok: false, error: "missing_email" };
    }

    const localeRaw = row.locale ?? "";
    const locale: Locale = isLocale(localeRaw) ? localeRaw : "tr";
    const copy = reservationMailCopy[locale];
    const amountLabel = formatPaidAmount(
      row.payment_amount ?? row.total_price,
      row.payment_currency ?? row.currency,
      locale,
    );

    const subject = copy.paymentConfirmationSubject(row.reservation_code);
    const text = `${copy.paymentConfirmationTitle}

${copy.paymentConfirmationBody(row.reservation_code)}

${copy.amountPaid}:
${amountLabel}

${copy.paymentConfirmationClosing}
`;
    const html = `<!DOCTYPE html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#f4f6fa;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="background:#ffffff;border-radius:12px;padding:28px 24px;">
      <h1 style="margin:0 0 16px;font-size:22px;color:#142e5c;">${escapeHtml(copy.paymentConfirmationTitle)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escapeHtml(copy.paymentConfirmationBody(row.reservation_code))}</p>
      <p style="margin:0 0 6px;color:#667085;font-size:14px;">${escapeHtml(copy.amountPaid)}:</p>
      <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#172033;">${escapeHtml(amountLabel)}</p>
      <p style="margin:0;font-size:14px;color:#667085;line-height:1.5;">${escapeHtml(copy.paymentConfirmationClosing)}</p>
    </div>
  </div>
</body>
</html>`;

    smtpStartedAt = performance.now();
    const sent = await sendReservationSmtpMail(
      {
        to: email,
        subject,
        text,
        html,
        from: reservationMailFrom(),
        messageId: `<payment-confirmation-${id}@tripetica.com>`,
      },
      {
        logPrefix: "[reservation-mail]",
      },
    );

    if (!sent.ok) {
      console.error("[reservation-mail] payment confirmation delivery failed", {
        reservationId: id,
        reservationCode: row.reservation_code,
        error: sent.error,
        deliveryMs: Math.round(performance.now() - deliveryStartedAt),
        smtpMs: smtpStartedAt
          ? Math.round(performance.now() - smtpStartedAt)
          : null,
      });
      return { ok: false, error: sent.error };
    }

    await markPaymentConfirmationSent(id);
    console.info("[reservation-mail] payment confirmation sent", {
      reservationId: id,
      reservationCode: row.reservation_code,
      locale,
      deliveryMs: Math.round(performance.now() - deliveryStartedAt),
      smtpMs: smtpStartedAt
        ? Math.round(performance.now() - smtpStartedAt)
        : null,
    });
    return { ok: true };
  } catch (error) {
    console.error("[reservation-mail] payment confirmation unexpected failure", {
      reservationId: id,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
    return { ok: false, error: "unexpected" };
  }
}
