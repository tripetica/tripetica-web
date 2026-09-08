import "server-only";

import { bookingCopy } from "@/lib/booking/copy";
import { findReservationVoucherById } from "@/lib/booking/reservation-voucher-access";
import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { localizedTourName } from "@/lib/booking/tour-display";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import { query } from "@/lib/db/postgres";
import {
  reservationMailFromAddress,
  sendReservationSmtpMail,
} from "@/lib/mail/smtp";
import {
  buildOperationBodies,
  type OperationSummaryRow,
} from "@/lib/mail/operation-reservation-body";
import { opsCopy } from "@/lib/ops/copy";
import { buildOpsRecordPdf } from "@/lib/ops/pdf";
import { toReservationRecordDetail } from "@/lib/ops/record-detail";
import { getReservation } from "@/lib/ops/reservations";

const OPERATION_EMAIL_TO = "operation@tripetica.com";

type OperationEmailClaim = {
  id: string;
  attempt_count: number;
};

function serviceTypeLabel(serviceType: string | null) {
  const normalized = serviceType?.trim();
  if (
    normalized === "transfer" ||
    normalized === "hourly" ||
    normalized === "tour"
  ) {
    return bookingCopy.tr.services[normalized];
  }
  return normalized || "Rezervasyon";
}

function placeValue(name: string, address: string) {
  return [name, address]
    .map((part) => part.trim())
    .filter((part, index, parts) => part && part !== "—" && parts.indexOf(part) === index)
    .join(" — ");
}

async function claimOperationEmail(
  reservationId?: string,
): Promise<OperationEmailClaim | null> {
  const result = await query<OperationEmailClaim>(
    `WITH candidate AS (
       SELECT id
       FROM reservations
       WHERE operation_notification_email_queued_at IS NOT NULL
         AND operation_notification_email_sent_at IS NULL
         AND deleted_at IS NULL
         AND status = 'confirmed'
         AND (payment_method = 'cash' OR payment_status = 'paid')
         AND (
           operation_notification_email_next_attempt_at IS NULL
           OR operation_notification_email_next_attempt_at <= NOW()
         )
         AND (
           operation_notification_email_claimed_at IS NULL
           OR operation_notification_email_claimed_at < NOW() - INTERVAL '10 minutes'
         )
         AND ($1::uuid IS NULL OR id = $1::uuid)
       ORDER BY operation_notification_email_queued_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE reservations r
     SET operation_notification_email_claimed_at = NOW(),
         operation_notification_email_attempt_count =
           operation_notification_email_attempt_count + 1
     FROM candidate
     WHERE r.id = candidate.id
     RETURNING r.id, r.operation_notification_email_attempt_count AS attempt_count`,
    [reservationId || null],
  );
  return result.rows[0] ?? null;
}

async function markOperationEmailSent(reservationId: string) {
  await query(
    `UPDATE reservations
     SET operation_notification_email_sent_at = NOW(),
         operation_notification_email_claimed_at = NULL,
         operation_notification_email_next_attempt_at = NULL,
         operation_notification_email_last_error = NULL
     WHERE id = $1
       AND operation_notification_email_sent_at IS NULL`,
    [reservationId],
  );
}

async function releaseOperationEmailClaim(
  reservationId: string,
  attemptCount: number,
  error: string,
) {
  const retrySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attemptCount - 1));
  await query(
    `UPDATE reservations
     SET operation_notification_email_claimed_at = NULL,
         operation_notification_email_next_attempt_at =
           NOW() + ($2::text || ' seconds')::interval,
         operation_notification_email_last_error = $3
     WHERE id = $1
       AND operation_notification_email_sent_at IS NULL`,
    [reservationId, retrySeconds, error.slice(0, 1000)],
  );
}

async function deliverOperationEmail(
  reservationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const [reservation, voucher] = await Promise.all([
      getReservation(reservationId),
      findReservationVoucherById(reservationId, "tr"),
    ]);
    if (!reservation || !voucher) {
      return { ok: false, error: "reservation_not_found" };
    }

    const typeLabel = serviceTypeLabel(reservation.serviceType);
    const bosphorus = isBosphorusDinnerTour(
      reservation.serviceType,
      reservation.tourCode,
    );
    const rows: OperationSummaryRow[] = [
      { label: "Rezervasyon kodu", value: reservation.reservationCode },
      { label: "Hizmet türü", value: typeLabel },
    ];
    if (reservation.serviceType === "tour") {
      rows.push({
        label: "Tur türü",
        value:
          localizedTourName(reservation.tourCode, "tr") ??
          voucher.serviceTypeLabel,
      });
    }
    rows.push(
      { label: "Tarih ve saat", value: voucher.dateTime },
      {
        label: "Alış noktası",
        value: placeValue(voucher.pickupName, voucher.pickupAddress) || "—",
      },
    );
    if (reservation.serviceType === "transfer") {
      rows.push({
        label: "Bırakış noktası",
        value: placeValue(voucher.dropoffName, voucher.dropoffAddress) || "—",
      });
    }
    if (reservation.serviceType === "hourly" && voucher.durationValue) {
      rows.push({ label: "Hizmet süresi", value: voucher.durationValue });
    }
    if (
      reservation.serviceType === "tour" &&
      !bosphorus &&
      voucher.packageCoverageValue
    ) {
      rows.push({
        label: "Paket / seçenek",
        value: voucher.packageCoverageValue,
      });
    }
    if (reservation.vehicleCode && !bosphorus) {
      const vehicle = vehicleCardCopyFor(reservation.vehicleCode, "tr");
      rows.push({
        label: "Araç sınıfı",
        value: vehicle.title,
        detail: vehicle.example,
      });
    }
    if (reservation.flightCode?.trim()) {
      rows.push({ label: "Uçuş kodu", value: reservation.flightCode.trim() });
    }
    if (voucher.pickupIsAirport) {
      rows.push({
        label: "Karşılama hizmeti",
        value: reservation.meetAndGreet === true ? "Evet" : "Hayır",
      });
    }
    if (voucher.participantBreakdown?.length) {
      rows.push({
        label: "Katılımcı dağılımı",
        value: voucher.participantBreakdown.join(" · "),
      });
    }
    rows.push(
      { label: "Toplam tutar", value: voucher.totalLabel },
      { label: "Telefon", value: reservation.customerPhone?.trim() || "—" },
      { label: "E-posta", value: reservation.customerEmail?.trim() || "—" },
    );

    const passengerNames =
      voucher.passengerNames.length > 0
        ? voucher.passengerNames
        : [reservation.customerName].filter(Boolean);
    const bodies = buildOperationBodies({
      reservationCode: reservation.reservationCode,
      serviceTypeLabel: typeLabel,
      rows,
      passengerNames,
    });
    const pdfCopy = opsCopy.tr;
    const detail = toReservationRecordDetail(reservation, "tr", pdfCopy);
    const pdf = await buildOpsRecordPdf(detail, pdfCopy, {
      includeContact: true,
    });
    const sent = await sendReservationSmtpMail(
      {
        from: reservationMailFromAddress(),
        to: OPERATION_EMAIL_TO,
        subject: bodies.subject,
        html: bodies.html,
        text: bodies.text,
        messageId: `<operation-reservation-${reservationId}@tripetica.com>`,
        attachments: [
          {
            filename: detail.pdfFilename,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      },
      { logPrefix: "[operation-mail]" },
    );
    if (!sent.ok) {
      return { ok: false, error: sent.error };
    }
    await markOperationEmailSent(reservationId);
    console.info("[operation-mail] reservation notification sent", {
      reservationId,
      reservationCode: reservation.reservationCode,
    });
    return { ok: true };
  } catch (error) {
    console.error("[operation-mail] reservation notification failed", {
      reservationId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
    return { ok: false, error: "unexpected" };
  }
}

export async function sendOperationReservationNotification(
  reservationId: string,
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const id = reservationId.trim();
  if (!id) {
    return { ok: false, error: "missing_reservation_id" };
  }
  const claim = await claimOperationEmail(id);
  if (!claim) {
    return { ok: true, skipped: true };
  }
  const result = await deliverOperationEmail(claim.id);
  if (!result.ok) {
    await releaseOperationEmailClaim(claim.id, claim.attempt_count, result.error);
  }
  return result;
}

export async function sendPendingOperationReservationNotifications(
  limit = 10,
): Promise<{ processed: number; sent: number; failed: number }> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  let processed = 0;
  let sent = 0;
  let failed = 0;
  while (processed < safeLimit) {
    const claim = await claimOperationEmail();
    if (!claim) break;
    processed += 1;
    const result = await deliverOperationEmail(claim.id);
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      await releaseOperationEmailClaim(
        claim.id,
        claim.attempt_count,
        result.error,
      );
    }
  }
  return { processed, sent, failed };
}
