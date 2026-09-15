import "server-only";

import { after } from "next/server";
import { query } from "@/lib/db/postgres";
import { sendReservationSmtpMail } from "@/lib/mail/smtp";
import {
  sendCancellationCustomerNotificationSafely as sendCancellationCustomerNotificationWithDeps,
  shouldSendCancellationCustomerNotification,
  type CancellationNotifyMailer,
  type CancellationNotifyReservationRow,
  type CancellationNotifyStore,
} from "@/lib/ops/cancellation-customer-notification-core";
import { isUuid } from "@/lib/ops/process-filters";
import { type SetReservationStatusResult } from "@/lib/ops/reservation-status";

export {
  shouldSendCancellationCustomerNotification,
} from "@/lib/ops/cancellation-customer-notification-core";

async function defaultLoadReservation(reservationId: string) {
  if (!isUuid(reservationId)) {
    return null;
  }
  const result = await query<Omit<CancellationNotifyReservationRow, "passengers">>(
    `SELECT
        r.id,
        r.reservation_code,
        r.locale,
        r.status,
        r.customer_email,
        r.customer_first_name,
        r.customer_last_name,
        r.pickup_at,
        r.service_type,
        r.tour_code,
        r.duration_hours,
        r.pickup_name_customer,
        r.pickup_name_tr,
        r.dropoff_name_customer,
        r.dropoff_name_tr,
        r.vehicle_label_customer,
        r.vehicle_label_tr,
        r.vehicle_code
     FROM reservations r
     WHERE r.id = $1
       AND r.deleted_at IS NULL
     LIMIT 1`,
    [reservationId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const passengers = await query<{
    sequence_no: number;
    first_name: string | null;
    last_name: string | null;
    is_primary_passenger: boolean;
  }>(
    `SELECT sequence_no, first_name, last_name, is_primary_passenger
     FROM reservations_passengers
     WHERE reservation_id = $1
     ORDER BY is_primary_passenger DESC, sequence_no ASC`,
    [reservationId],
  );
  return { ...row, passengers: passengers.rows };
}

const defaultStore: CancellationNotifyStore = {
  loadReservation: defaultLoadReservation,
};

const defaultMailer: CancellationNotifyMailer = async (input) => {
  return sendReservationSmtpMail(
    {
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    },
    { logPrefix: "[cancellation-customer-notify]" },
  );
};

export async function sendCancellationCustomerNotification(reservationId: string) {
  return sendCancellationCustomerNotificationWithDeps({
    reservationId,
    store: defaultStore,
    mailer: defaultMailer,
  });
}

export function maybeScheduleCancellationCustomerNotification(
  result: SetReservationStatusResult,
  reservationId: string,
) {
  if (!shouldSendCancellationCustomerNotification(result)) {
    return;
  }
  after(() => {
    void sendCancellationCustomerNotification(reservationId).then((result) => {
      if (result.ok) {
        return;
      }
      console.error("[cancellation-customer-notify] skipped or failed after cancel", {
        reservationId,
        reason: result.reason,
      });
    });
  });
}
