import { resolveReservationCustomerLocale } from "@/lib/booking/reservation-voucher-locale";
import { buildCancellationCustomerNotificationBodies } from "@/lib/mail/cancellation-customer-notification-body";
import { type AssignmentNotifySummaryPassenger } from "@/lib/mail/assignment-customer-notification-summary";

type CancellationTriggerResult =
  | { ok: true; status: string }
  | { ok: false; reason: string };

export type CancellationNotifyError =
  | "not-found"
  | "not-cancelled"
  | "missing-email"
  | "send-failed"
  | "failed";

export type CancellationNotifySendResult =
  | { ok: true; to: string; locale: string; reservationCode: string }
  | { ok: false; reason: CancellationNotifyError };

export type CancellationNotifyPassengerRow = AssignmentNotifySummaryPassenger;

export type CancellationNotifyReservationRow = {
  id: string;
  reservation_code: string;
  locale: string | null;
  status: string;
  customer_email: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  pickup_at: Date | null;
  service_type: string | null;
  tour_code: string | null;
  duration_hours: string | number | null;
  pickup_name_customer: string | null;
  pickup_name_tr: string | null;
  dropoff_name_customer: string | null;
  dropoff_name_tr: string | null;
  vehicle_label_customer: string | null;
  vehicle_label_tr: string | null;
  vehicle_code: string | null;
  passengers: CancellationNotifyPassengerRow[];
};

export type CancellationNotifyStore = {
  loadReservation(
    reservationId: string,
  ): Promise<CancellationNotifyReservationRow | null>;
};

export type CancellationNotifyMailer = (input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) => Promise<{ ok: true } | { ok: false; error: string }>;

export function shouldSendCancellationCustomerNotification(
  result: CancellationTriggerResult,
): boolean {
  return result.ok === true && result.status === "cancelled";
}

export async function sendCancellationCustomerNotification(input: {
  reservationId: string;
  store: CancellationNotifyStore;
  mailer: CancellationNotifyMailer;
}): Promise<CancellationNotifySendResult> {
  const row = await input.store.loadReservation(input.reservationId);
  if (!row) {
    return { ok: false, reason: "not-found" };
  }
  if (row.status !== "cancelled") {
    return { ok: false, reason: "not-cancelled" };
  }
  const email = row.customer_email?.trim() ?? "";
  if (!email) {
    return { ok: false, reason: "missing-email" };
  }
  const locale = resolveReservationCustomerLocale(row.locale);
  const bodies = buildCancellationCustomerNotificationBodies({
    locale,
    summary: {
      reservationCode: row.reservation_code,
      pickupAt: row.pickup_at,
      serviceType: row.service_type,
      tourCode: row.tour_code,
      durationHours: row.duration_hours,
      customerFirstName: row.customer_first_name,
      customerLastName: row.customer_last_name,
      pickupNameCustomer: row.pickup_name_customer,
      pickupNameTr: row.pickup_name_tr,
      dropoffNameCustomer: row.dropoff_name_customer,
      dropoffNameTr: row.dropoff_name_tr,
      vehicleLabelCustomer: row.vehicle_label_customer,
      vehicleLabelTr: row.vehicle_label_tr,
      vehicleCode: row.vehicle_code,
      passengers: row.passengers ?? [],
    },
  });
  const sent = await input.mailer({
    to: email,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
  });
  if (!sent.ok) {
    console.error("[cancellation-customer-notify] delivery failed", {
      reservationId: input.reservationId,
      reservationCode: row.reservation_code,
      error: sent.error,
    });
    return { ok: false, reason: "send-failed" };
  }
  return {
    ok: true,
    to: email,
    locale,
    reservationCode: row.reservation_code,
  };
}

export async function sendCancellationCustomerNotificationSafely(input: {
  reservationId: string;
  store: CancellationNotifyStore;
  mailer: CancellationNotifyMailer;
}): Promise<CancellationNotifySendResult> {
  try {
    return await sendCancellationCustomerNotification(input);
  } catch (error) {
    console.error("[cancellation-customer-notify] unexpected failure", {
      reservationId: input.reservationId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
    return { ok: false, reason: "failed" };
  }
}
