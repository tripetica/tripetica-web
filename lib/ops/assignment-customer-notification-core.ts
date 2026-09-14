import { randomUUID } from "node:crypto";
import { resolveReservationCustomerLocale } from "@/lib/booking/reservation-voucher-locale";
import { buildAssignmentCustomerNotificationBodies } from "@/lib/mail/assignment-customer-notification-body";
import { type AssignmentNotifySummaryPassenger } from "@/lib/mail/assignment-customer-notification-summary";
import {
  assignmentNotifyChangeKind,
  buildAssignmentNotifyOutgoing,
  isAssignmentNotifyNoChange,
  isAssignmentNotifyScope,
  type AssignmentCustomerNotificationSent,
  type AssignmentNotifyOutgoing,
} from "@/lib/ops/assignment-customer-notification-view";
import { isUuid } from "@/lib/ops/process-filters";
import { type PartnerDriverRecord, type PartnerVehicleRecord } from "@/lib/partner/fleet-view";
import {
  resolveDriverAssignment,
  resolveVehicleAssignment,
} from "@/lib/partner/job-assignment-view";

export type AssignmentNotifyError =
  | "not-found"
  | "invalid-scope"
  | "locked"
  | "missing-email"
  | "no-vehicle"
  | "no-driver"
  | "no-change"
  | "send-failed"
  | "failed";

export type AssignmentNotifySendResult =
  | { ok: true; notificationId: string }
  | { ok: false; error: AssignmentNotifyError };

export type AssignmentNotifyPassengerRow = AssignmentNotifySummaryPassenger;

export type AssignmentNotifyReservationRow = {
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
  passengers: AssignmentNotifyPassengerRow[];
  assigned_driver_kind: string | null;
  assigned_driver_id: string | null;
  assigned_driver_snapshot: unknown;
  assigned_vehicle_kind: string | null;
  assigned_vehicle_id: string | null;
  assigned_vehicle_snapshot: unknown;
  assigned_driver_first_name: string | null;
  assigned_driver_last_name: string | null;
  assigned_driver_phone: string | null;
  assigned_driver_phone_country: string | null;
  assigned_driver_languages: string[] | null;
  assigned_driver_national_id: string | null;
  assigned_vehicle_plate: string | null;
  assigned_vehicle_brand: string | null;
  assigned_vehicle_model: string | null;
  assigned_vehicle_year: number | null;
  assigned_vehicle_class: string | null;
  assigned_vehicle_passengers: number | null;
  assigned_vehicle_luggage: number | null;
  assigned_vehicle_color: string | null;
  assigned_vehicle_features: string | null;
};

export type AssignmentNotifyStore = {
  loadReservation(
    reservationId: string,
  ): Promise<AssignmentNotifyReservationRow | null>;
  loadLastSuccessful(
    reservationId: string,
  ): Promise<AssignmentCustomerNotificationSent | null>;
  insertAttempt(input: {
    id: string;
    reservationId: string;
    status: "sent" | "failed";
    sentByUserId: string;
    outgoing: AssignmentNotifyOutgoing;
    locale: string;
    recipientEmail: string;
    smtpMessageId: string;
    error: string | null;
  }): Promise<void>;
};

export type AssignmentNotifyMailer = (input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId: string;
}) => Promise<{ ok: true } | { ok: false; error: string }>;

function liveDriverFromRow(
  row: AssignmentNotifyReservationRow,
): PartnerDriverRecord | null {
  if (!row.assigned_driver_id) {
    return null;
  }
  return {
    id: row.assigned_driver_id,
    partnerId: "",
    firstName: row.assigned_driver_first_name ?? "",
    lastName: row.assigned_driver_last_name ?? "",
    fullName: [row.assigned_driver_first_name, row.assigned_driver_last_name]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" "),
    nationalId: row.assigned_driver_national_id,
    phone: row.assigned_driver_phone,
    phoneCountryCode: row.assigned_driver_phone_country,
    email: null,
    languageCodes: row.assigned_driver_languages ?? [],
    status: "active",
    deletedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function liveVehicleFromRow(
  row: AssignmentNotifyReservationRow,
): PartnerVehicleRecord | null {
  if (!row.assigned_vehicle_id) {
    return null;
  }
  return {
    id: row.assigned_vehicle_id,
    partnerId: "",
    plate: row.assigned_vehicle_plate ?? "",
    brandCode: null,
    modelCode: null,
    brand: row.assigned_vehicle_brand,
    model: row.assigned_vehicle_model,
    modelYear: row.assigned_vehicle_year,
    colorCode: null,
    colorOther: null,
    color: row.assigned_vehicle_color,
    passengerCapacity: row.assigned_vehicle_passengers,
    luggageCapacity: row.assigned_vehicle_luggage,
    vehicleClassCode: row.assigned_vehicle_class,
    featureCodes: [],
    featureOther: null,
    features: row.assigned_vehicle_features,
    status: "active",
    approvedAt: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function sendAssignmentCustomerNotification(input: {
  actorId: string;
  reservationId: string;
  scope: string;
  store: AssignmentNotifyStore;
  mailer: AssignmentNotifyMailer;
}): Promise<AssignmentNotifySendResult> {
  if (!isUuid(input.reservationId) || !isUuid(input.actorId)) {
    return { ok: false, error: "not-found" };
  }
  if (!isAssignmentNotifyScope(input.scope)) {
    return { ok: false, error: "invalid-scope" };
  }
  const row = await input.store.loadReservation(input.reservationId);
  if (!row) {
    return { ok: false, error: "not-found" };
  }
  if (row.status === "cancelled") {
    return { ok: false, error: "locked" };
  }
  const email = row.customer_email?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    return { ok: false, error: "missing-email" };
  }
  const outgoing = buildAssignmentNotifyOutgoing({
    vehicle: resolveVehicleAssignment({
      kind: row.assigned_vehicle_kind,
      vehicleId: row.assigned_vehicle_id,
      snapshot: row.assigned_vehicle_snapshot,
      live: liveVehicleFromRow(row),
    }),
    driver: resolveDriverAssignment({
      kind: row.assigned_driver_kind,
      driverId: row.assigned_driver_id,
      snapshot: row.assigned_driver_snapshot,
      live: liveDriverFromRow(row),
    }),
    scope: input.scope,
    vehicleSnapshot: row.assigned_vehicle_snapshot,
    driverSnapshot:
      input.scope === "vehicle_and_driver" ? row.assigned_driver_snapshot : null,
  });
  if ("error" in outgoing) {
    return { ok: false, error: outgoing.error };
  }
  const lastSent = await input.store.loadLastSuccessful(input.reservationId);
  if (isAssignmentNotifyNoChange(lastSent, outgoing)) {
    return { ok: false, error: "no-change" };
  }
  const locale = resolveReservationCustomerLocale(row.locale, "tr");
  const bodies = buildAssignmentCustomerNotificationBodies({
    locale,
    reservationCode: row.reservation_code,
    pickupAt: row.pickup_at,
    scope: outgoing.scope,
    isUpdate: Boolean(lastSent),
    changeKind: lastSent ? assignmentNotifyChangeKind(lastSent, outgoing) : null,
    vehicleName: outgoing.vehicleName,
    vehiclePlate: outgoing.vehiclePlate,
    driverName: outgoing.driverName,
    driverPhoneDisplay: outgoing.driverPhoneDisplay,
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
  const notificationId = randomUUID();
  const smtpMessageId = `<assignment-notify-${notificationId}@tripetica.com>`;
  const sent = await input.mailer({
    to: email,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
    messageId: smtpMessageId,
  });
  if (!sent.ok) {
    try {
      await input.store.insertAttempt({
        id: notificationId,
        reservationId: input.reservationId,
        status: "failed",
        sentByUserId: input.actorId,
        outgoing,
        locale,
        recipientEmail: email,
        smtpMessageId,
        error: sent.error,
      });
    } catch (error) {
      console.error("[assignment-customer-notify] failed-attempt insert skipped", {
        reservationId: input.reservationId,
        error,
      });
    }
    console.error("[assignment-customer-notify] delivery failed", {
      reservationId: input.reservationId,
      reservationCode: row.reservation_code,
      error: sent.error,
    });
    return { ok: false, error: "send-failed" };
  }
  try {
    await input.store.insertAttempt({
      id: notificationId,
      reservationId: input.reservationId,
      status: "sent",
      sentByUserId: input.actorId,
      outgoing,
      locale,
      recipientEmail: email,
      smtpMessageId,
      error: null,
    });
  } catch (error) {
    console.error("[assignment-customer-notify] sent-history insert failed after SMTP success", {
      reservationId: input.reservationId,
      notificationId,
      error,
    });
  }
  return { ok: true, notificationId };
}
