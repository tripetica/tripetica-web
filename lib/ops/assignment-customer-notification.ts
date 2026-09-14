import "server-only";

import { query } from "@/lib/db/postgres";
import { sendReservationSmtpMail } from "@/lib/mail/smtp";
import {
  sendAssignmentCustomerNotification as sendAssignmentCustomerNotificationWithDeps,
  type AssignmentNotifyMailer,
  type AssignmentNotifyReservationRow,
  type AssignmentNotifyStore,
} from "@/lib/ops/assignment-customer-notification-core";
import { mapAssignmentCustomerNotificationRow } from "@/lib/ops/assignment-customer-notification-view";
import { isUuid } from "@/lib/ops/process-filters";

export type {
  AssignmentNotifyError,
  AssignmentNotifySendResult,
} from "@/lib/ops/assignment-customer-notification-core";

type LastSentRow = {
  id: string;
  sent_at: Date;
  sent_by_ops_user_id: string | null;
  notification_scope: string;
  reservation_locale: string;
  vehicle_kind: string | null;
  vehicle_id: string | null;
  vehicle_plate: string;
  vehicle_name: string;
  driver_kind: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  fingerprint: string | null;
};

const LAST_SENT_SQL = `
  SELECT
    id, sent_at, sent_by_ops_user_id, notification_scope, reservation_locale,
    vehicle_kind, vehicle_id, vehicle_plate, vehicle_name,
    driver_kind, driver_id, driver_name, driver_phone, fingerprint
  FROM reservation_assignment_customer_notifications
  WHERE reservation_id = $1
    AND status = 'sent'
  ORDER BY sent_at DESC
  LIMIT 1
`;

const LAST_SENT_MANY_SQL = `
  SELECT DISTINCT ON (reservation_id)
    id, reservation_id, sent_at, sent_by_ops_user_id, notification_scope, reservation_locale,
    vehicle_kind, vehicle_id, vehicle_plate, vehicle_name,
    driver_kind, driver_id, driver_name, driver_phone, fingerprint
  FROM reservation_assignment_customer_notifications
  WHERE reservation_id = ANY($1::uuid[])
    AND status = 'sent'
  ORDER BY reservation_id, sent_at DESC
`;

async function defaultLoadReservation(reservationId: string) {
  const result = await query<Omit<AssignmentNotifyReservationRow, "passengers">>(
    `SELECT
        r.id, r.reservation_code, r.locale, r.status, r.customer_email, r.pickup_at,
        r.customer_first_name, r.customer_last_name,
        r.service_type, r.tour_code, r.duration_hours,
        r.pickup_name_customer, r.pickup_name_tr,
        r.dropoff_name_customer, r.dropoff_name_tr,
        r.vehicle_label_customer, r.vehicle_label_tr, r.vehicle_code,
        r.assigned_driver_kind, r.assigned_driver_id, r.assigned_driver_snapshot,
        r.assigned_vehicle_kind, r.assigned_vehicle_id, r.assigned_vehicle_snapshot,
        assigned_driver.first_name AS assigned_driver_first_name,
        assigned_driver.last_name AS assigned_driver_last_name,
        assigned_driver.phone AS assigned_driver_phone,
        assigned_driver.phone_country_code AS assigned_driver_phone_country,
        assigned_driver.languages AS assigned_driver_languages,
        assigned_driver.national_id AS assigned_driver_national_id,
        assigned_vehicle.plate AS assigned_vehicle_plate,
        assigned_vehicle.brand AS assigned_vehicle_brand,
        assigned_vehicle.model AS assigned_vehicle_model,
        assigned_vehicle.model_year AS assigned_vehicle_year,
        assigned_vehicle.vehicle_class_code AS assigned_vehicle_class,
        assigned_vehicle.passenger_capacity AS assigned_vehicle_passengers,
        assigned_vehicle.luggage_capacity AS assigned_vehicle_luggage,
        assigned_vehicle.color AS assigned_vehicle_color,
        assigned_vehicle.features AS assigned_vehicle_features
     FROM reservations r
     LEFT JOIN partner_drivers assigned_driver ON assigned_driver.id = r.assigned_driver_id
     LEFT JOIN partner_vehicles assigned_vehicle ON assigned_vehicle.id = r.assigned_vehicle_id
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

async function defaultLoadLastSuccessful(reservationId: string) {
  const result = await query<LastSentRow>(LAST_SENT_SQL, [reservationId]);
  const row = result.rows[0];
  return row ? mapAssignmentCustomerNotificationRow(row) : null;
}

async function defaultInsertAttempt(
  input: Parameters<AssignmentNotifyStore["insertAttempt"]>[0],
) {
  await query(
    `INSERT INTO reservation_assignment_customer_notifications (
        id, reservation_id, status, sent_at, sent_by_ops_user_id,
        notification_scope, reservation_locale,
        vehicle_kind, vehicle_id, vehicle_plate, vehicle_name, vehicle_snapshot,
        driver_kind, driver_id, driver_name, driver_phone, driver_snapshot,
        fingerprint, recipient_email, smtp_message_id, error
     ) VALUES (
        $1, $2, $3, NOW(), $4,
        $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20
     )`,
    [
      input.id,
      input.reservationId,
      input.status,
      input.sentByUserId,
      input.outgoing.scope,
      input.locale,
      input.outgoing.vehicleKind,
      input.outgoing.vehicleId,
      input.outgoing.vehiclePlate,
      input.outgoing.vehicleName,
      input.outgoing.vehicleSnapshot,
      input.outgoing.driverKind,
      input.outgoing.driverId,
      input.outgoing.driverName,
      input.outgoing.driverPhone,
      input.outgoing.driverSnapshot,
      input.outgoing.fingerprint,
      input.recipientEmail,
      input.smtpMessageId,
      input.error,
    ],
  );
}

const defaultStore: AssignmentNotifyStore = {
  loadReservation: defaultLoadReservation,
  loadLastSuccessful: defaultLoadLastSuccessful,
  insertAttempt: defaultInsertAttempt,
};

const defaultMailer: AssignmentNotifyMailer = async (input) => {
  return sendReservationSmtpMail(
    {
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      messageId: input.messageId,
    },
    { logPrefix: "[assignment-customer-notify]" },
  );
};

export async function loadLastSuccessfulAssignmentCustomerNotifications(
  reservationIds: readonly string[],
) {
  const ids = [...new Set(reservationIds.filter((id) => isUuid(id)))];
  const map = new Map<
    string,
    NonNullable<ReturnType<typeof mapAssignmentCustomerNotificationRow>>
  >();
  if (ids.length === 0) {
    return map;
  }
  try {
    const result = await query<LastSentRow & { reservation_id: string }>(
      LAST_SENT_MANY_SQL,
      [ids],
    );
    for (const row of result.rows) {
      const mapped = mapAssignmentCustomerNotificationRow(row);
      if (mapped) {
        map.set(row.reservation_id, mapped);
      }
    }
  } catch {
    // Table may be missing before DEV migration.
  }
  return map;
}

export async function sendAssignmentCustomerNotification(input: {
  actorId: string;
  reservationId: string;
  scope: string;
}) {
  return sendAssignmentCustomerNotificationWithDeps({
    ...input,
    store: defaultStore,
    mailer: defaultMailer,
  });
}
