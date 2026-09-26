import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatPartnerFleetPhone } from "@/lib/partner/fleet-view";
import {
  formatAssignmentVehicleName,
  type AssignmentKind,
  type JobDriverAssignmentView,
  type JobVehicleAssignmentView,
} from "@/lib/partner/job-assignment-view";
import { normalizePartnerPlate } from "@/lib/partner/vehicle-policy";

export const ASSIGNMENT_NOTIFY_SCOPES = [
  "vehicle_only",
  "vehicle_and_driver",
] as const;

export type AssignmentNotifyScope = (typeof ASSIGNMENT_NOTIFY_SCOPES)[number];

export type AssignmentNotifyChangeKind = "vehicle" | "driver" | "both";

export type AssignmentNotifyUiKind =
  | "send"
  | "resend"
  | "sent"
  | "need-vehicle"
  | "need-email"
  | "locked"
  | "forbidden";

export type AssignmentCustomerNotificationSent = {
  id: string;
  reservationId: string;
  sentAt: string;
  sentByUserId: string | null;
  scope: AssignmentNotifyScope;
  locale: Locale;
  vehicleKind: AssignmentKind | null;
  vehicleId: string | null;
  vehiclePlate: string;
  vehicleName: string;
  driverKind: AssignmentKind | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  fingerprint: string;
};

export type AssignmentNotifyOutgoing = {
  scope: AssignmentNotifyScope;
  vehicleKind: AssignmentKind;
  vehicleId: string | null;
  vehiclePlate: string;
  vehicleName: string;
  vehicleSnapshot: unknown;
  driverKind: AssignmentKind | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  driverPhoneDisplay: string | null;
  driverSnapshot: unknown;
  fingerprint: string;
};

export type AssignmentNotifyUiState = {
  kind: AssignmentNotifyUiKind;
  canOpen: boolean;
  canSubmit: boolean;
  vehicleReady: boolean;
  driverReady: boolean;
};

function collapseText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeName(value: string) {
  return collapseText(value).toLocaleLowerCase("tr-TR");
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function isAssignmentKind(value: string | null): value is AssignmentKind {
  return value === "registered" || value === "non_trp";
}

export function isAssignmentNotifyScope(
  value: string,
): value is AssignmentNotifyScope {
  return (ASSIGNMENT_NOTIFY_SCOPES as readonly string[]).includes(value);
}

export function scopedAssignmentCustomerNotification(
  lastSent: AssignmentCustomerNotificationSent | null,
  reservationId: string,
): AssignmentCustomerNotificationSent | null {
  if (!lastSent || lastSent.reservationId !== reservationId) {
    return null;
  }
  return lastSent;
}

export function assignmentVehicleDisplayName(vehicle: JobVehicleAssignmentView) {
  return formatAssignmentVehicleName(vehicle.brand, vehicle.model);
}

export function isAssignmentVehicleSendable(vehicle: JobVehicleAssignmentView) {
  return Boolean(vehicle.kind && collapseText(vehicle.plate ?? ""));
}

export function isAssignmentDriverSendable(driver: JobDriverAssignmentView) {
  return Boolean(
    driver.kind &&
      collapseText(driver.fullName ?? "") &&
      collapseText(driver.phone ?? ""),
  );
}

export function assignmentNotifyFingerprint(input: {
  scope: AssignmentNotifyScope;
  vehicleKind: string | null;
  vehicleId: string | null;
  vehiclePlate: string;
  vehicleName: string;
  driverKind?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
}) {
  const parts = [
    input.scope,
    input.vehicleKind ?? "",
    input.vehicleId ?? "",
    normalizePartnerPlate(input.vehiclePlate),
    normalizeName(input.vehicleName),
  ];
  if (input.scope === "vehicle_and_driver") {
    parts.push(
      input.driverKind ?? "",
      input.driverId ?? "",
      normalizeName(input.driverName ?? ""),
      normalizePhone(input.driverPhone ?? ""),
    );
  }
  return parts.join("\u001f");
}

export function buildAssignmentNotifyOutgoing(input: {
  vehicle: JobVehicleAssignmentView;
  driver: JobDriverAssignmentView;
  scope: AssignmentNotifyScope;
  vehicleSnapshot?: unknown;
  driverSnapshot?: unknown;
}): AssignmentNotifyOutgoing | { error: "no-vehicle" | "no-driver" } {
  if (!isAssignmentVehicleSendable(input.vehicle) || !input.vehicle.kind) {
    return { error: "no-vehicle" };
  }
  const vehiclePlate = normalizePartnerPlate(input.vehicle.plate ?? "");
  const vehicleName = assignmentVehicleDisplayName(input.vehicle);
  if (input.scope === "vehicle_only") {
    const fingerprint = assignmentNotifyFingerprint({
      scope: "vehicle_only",
      vehicleKind: input.vehicle.kind,
      vehicleId: input.vehicle.vehicleId,
      vehiclePlate,
      vehicleName,
    });
    return {
      scope: "vehicle_only",
      vehicleKind: input.vehicle.kind,
      vehicleId: input.vehicle.vehicleId,
      vehiclePlate,
      vehicleName,
      vehicleSnapshot: input.vehicleSnapshot ?? null,
      driverKind: null,
      driverId: null,
      driverName: null,
      driverPhone: null,
      driverPhoneDisplay: null,
      driverSnapshot: null,
      fingerprint,
    };
  }
  if (!isAssignmentDriverSendable(input.driver) || !input.driver.kind) {
    return { error: "no-driver" };
  }
  const driverName = collapseText(input.driver.fullName ?? "");
  const driverPhone = collapseText(input.driver.phone ?? "");
  const fingerprint = assignmentNotifyFingerprint({
    scope: "vehicle_and_driver",
    vehicleKind: input.vehicle.kind,
    vehicleId: input.vehicle.vehicleId,
    vehiclePlate,
    vehicleName,
    driverKind: input.driver.kind,
    driverId: input.driver.driverId,
    driverName,
    driverPhone,
  });
  return {
    scope: "vehicle_and_driver",
    vehicleKind: input.vehicle.kind,
    vehicleId: input.vehicle.vehicleId,
    vehiclePlate,
    vehicleName,
    vehicleSnapshot: input.vehicleSnapshot ?? null,
    driverKind: input.driver.kind,
    driverId: input.driver.driverId,
    driverName,
    driverPhone,
    driverPhoneDisplay: formatPartnerFleetPhone(driverPhone),
    driverSnapshot: input.driverSnapshot ?? null,
    fingerprint,
  };
}

function vehicleFingerprint(input: {
  vehicleKind: string | null;
  vehicleId: string | null;
  vehiclePlate: string;
  vehicleName: string;
}) {
  return assignmentNotifyFingerprint({
    scope: "vehicle_only",
    vehicleKind: input.vehicleKind,
    vehicleId: input.vehicleId,
    vehiclePlate: input.vehiclePlate,
    vehicleName: input.vehicleName,
  });
}

function sameVehicle(
  last: AssignmentCustomerNotificationSent,
  outgoing: AssignmentNotifyOutgoing,
) {
  return (
    vehicleFingerprint(last) ===
    vehicleFingerprint({
      vehicleKind: outgoing.vehicleKind,
      vehicleId: outgoing.vehicleId,
      vehiclePlate: outgoing.vehiclePlate,
      vehicleName: outgoing.vehicleName,
    })
  );
}

function sameDriver(
  last: AssignmentCustomerNotificationSent,
  outgoing: AssignmentNotifyOutgoing,
) {
  if (outgoing.scope !== "vehicle_and_driver") {
    return true;
  }
  if (last.scope !== "vehicle_and_driver") {
    return false;
  }
  return (
    (last.driverKind ?? "") === (outgoing.driverKind ?? "") &&
    (last.driverId ?? "") === (outgoing.driverId ?? "") &&
    normalizeName(last.driverName ?? "") ===
      normalizeName(outgoing.driverName ?? "") &&
    normalizePhone(last.driverPhone ?? "") ===
      normalizePhone(outgoing.driverPhone ?? "")
  );
}

function toUtcMillis(value: string | Date | null | undefined) {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  const fallback = Date.parse(value.trim().replace(" ", "T"));
  return Number.isFinite(fallback) ? fallback : null;
}

export function assignmentUnchangedSinceNotifySend(
  assignmentUpdatedAt: string | Date | null | undefined,
  sentAt: string | Date,
) {
  const updatedMs = toUtcMillis(assignmentUpdatedAt);
  const sentMs = toUtcMillis(sentAt);
  if (updatedMs == null || sentMs == null) {
    return false;
  }
  return updatedMs <= sentMs;
}

export function assignmentNotifyDefaultIncludeDriver(
  driver: JobDriverAssignmentView,
) {
  return isAssignmentDriverSendable(driver);
}

export function isAssignmentNotifyNoChange(
  last: AssignmentCustomerNotificationSent | null,
  outgoing: AssignmentNotifyOutgoing,
) {
  if (!last) {
    return false;
  }
  if (outgoing.scope === "vehicle_only") {
    return sameVehicle(last, outgoing);
  }
  return sameVehicle(last, outgoing) && sameDriver(last, outgoing);
}

export function assignmentNotifyChangeKind(
  last: AssignmentCustomerNotificationSent | null,
  outgoing: AssignmentNotifyOutgoing,
): AssignmentNotifyChangeKind | null {
  if (!last) {
    return null;
  }
  if (outgoing.scope === "vehicle_only") {
    return "vehicle";
  }
  const vehicleChanged = !sameVehicle(last, outgoing);
  const driverChanged = !sameDriver(last, outgoing);
  if (vehicleChanged && driverChanged) {
    return "both";
  }
  if (vehicleChanged) {
    return "vehicle";
  }
  if (driverChanged) {
    return "driver";
  }
  return "both";
}

export function assignmentNotifyAllowedScopes(input: {
  vehicle: JobVehicleAssignmentView;
  driver: JobDriverAssignmentView;
}): AssignmentNotifyScope[] {
  if (!isAssignmentVehicleSendable(input.vehicle)) {
    return [];
  }
  if (isAssignmentDriverSendable(input.driver)) {
    return ["vehicle_only", "vehicle_and_driver"];
  }
  return ["vehicle_only"];
}

export function assignmentNotifyUiState(input: {
  vehicle: JobVehicleAssignmentView;
  driver: JobDriverAssignmentView;
  lastSent: AssignmentCustomerNotificationSent | null;
  assignmentUpdatedAt?: string | Date | null;
  customerEmail: string | null;
  locked: boolean;
  canAssign: boolean;
}): AssignmentNotifyUiState {
  const vehicleReady = isAssignmentVehicleSendable(input.vehicle);
  const driverReady = isAssignmentDriverSendable(input.driver);
  const hasEmail = Boolean(input.customerEmail?.trim().includes("@"));
  if (!input.canAssign) {
    return {
      kind: "forbidden",
      canOpen: false,
      canSubmit: false,
      vehicleReady,
      driverReady,
    };
  }
  if (input.locked) {
    return {
      kind: "locked",
      canOpen: false,
      canSubmit: false,
      vehicleReady,
      driverReady,
    };
  }
  if (!hasEmail) {
    return {
      kind: "need-email",
      canOpen: false,
      canSubmit: false,
      vehicleReady,
      driverReady,
    };
  }
  if (!vehicleReady) {
    return {
      kind: "need-vehicle",
      canOpen: false,
      canSubmit: false,
      vehicleReady,
      driverReady,
    };
  }
  const lastSent = input.lastSent;
  const vehicleOnlyOutgoing = buildAssignmentNotifyOutgoing({
    vehicle: input.vehicle,
    driver: input.driver,
    scope: "vehicle_only",
  });
  const sameSentVehicle =
    lastSent != null &&
    !("error" in vehicleOnlyOutgoing) &&
    isAssignmentNotifyNoChange(lastSent, vehicleOnlyOutgoing);
  if (
    lastSent?.scope === "vehicle_only" &&
    sameSentVehicle &&
    assignmentUnchangedSinceNotifySend(input.assignmentUpdatedAt, lastSent.sentAt)
  ) {
    return {
      kind: "sent",
      canOpen: false,
      canSubmit: false,
      vehicleReady,
      driverReady,
    };
  }
  const hasChange = assignmentNotifyAllowedScopes(input).some((scope) => {
    const outgoing = buildAssignmentNotifyOutgoing({
      vehicle: input.vehicle,
      driver: input.driver,
      scope,
    });
    if ("error" in outgoing) {
      return false;
    }
    return !isAssignmentNotifyNoChange(lastSent, outgoing);
  });
  if (!hasChange) {
    return {
      kind: "sent",
      canOpen: false,
      canSubmit: false,
      vehicleReady,
      driverReady,
    };
  }
  return {
    kind: input.lastSent ? "resend" : "send",
    canOpen: true,
    canSubmit: true,
    vehicleReady,
    driverReady,
  };
}

export function mapAssignmentCustomerNotificationRow(row: {
  id: string;
  reservation_id: string;
  sent_at: Date | string;
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
  fingerprint?: string | null;
}): AssignmentCustomerNotificationSent | null {
  if (!isAssignmentNotifyScope(row.notification_scope) || !isLocale(row.reservation_locale)) {
    return null;
  }
  const reservationId = row.reservation_id.trim();
  if (!reservationId) {
    return null;
  }
  const sentAt =
    row.sent_at instanceof Date ? row.sent_at.toISOString() : String(row.sent_at);
  const fingerprint =
    row.fingerprint?.trim() ||
    assignmentNotifyFingerprint({
      scope: row.notification_scope,
      vehicleKind: row.vehicle_kind,
      vehicleId: row.vehicle_id,
      vehiclePlate: row.vehicle_plate,
      vehicleName: row.vehicle_name,
      driverKind: row.driver_kind,
      driverId: row.driver_id,
      driverName: row.driver_name,
      driverPhone: row.driver_phone,
    });
  return {
    id: row.id,
    reservationId,
    sentAt,
    sentByUserId: row.sent_by_ops_user_id,
    scope: row.notification_scope,
    locale: row.reservation_locale,
    vehicleKind: isAssignmentKind(row.vehicle_kind) ? row.vehicle_kind : null,
    vehicleId: row.vehicle_id,
    vehiclePlate: row.vehicle_plate,
    vehicleName: row.vehicle_name,
    driverKind: isAssignmentKind(row.driver_kind) ? row.driver_kind : null,
    driverId: row.driver_id,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    fingerprint,
  };
}
