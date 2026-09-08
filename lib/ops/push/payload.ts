import {
  formatOpsPassengerCount,
  formatOpsPrice,
  formatOpsPushDateTime,
  opsHourlyServiceLabel,
  opsPlaceLabel,
  opsServiceLabel,
  opsVehicleLabel,
} from "@/lib/ops/push/labels";

export const PROCESS_PUSH_TITLE = "🟡 Yeni Geçici Kayıt";
export const RESERVATION_PUSH_TITLE = "🟢 YENİ REZERVASYON";
export const PARTNER_APPLICATION_PUSH_TITLE = "⚪ Yeni Partner Talebi";
export const VEHICLE_APPROVAL_PUSH_TITLE = "⚪ Araç Onayı";

export const PROCESS_PUSH_ICON = "/ops-push-process.png";
export const RESERVATION_PUSH_ICON = "/ops-push-reservation.png";
export const PARTNER_APPLICATION_PUSH_ICON = "/ops-push-partner.png";
export const PROCESS_PUSH_BADGE = "/ops-push-process-badge.png";
export const RESERVATION_PUSH_BADGE = "/ops-push-reservation-badge.png";
export const PARTNER_APPLICATION_PUSH_BADGE = "/ops-push-partner-badge.png";

export type OpsPushKind = "process" | "reservation" | "partner";

export type ProcessPushSource = {
  id: string;
  serviceType: string | null;
  tourCode: string | null;
  pickupAt: Date | string | null;
  durationHours: number | null;
  pickupNameTr: string | null;
  pickupNameCustomer: string | null;
  dropoffNameTr: string | null;
  dropoffNameCustomer: string | null;
  passengerCount: number | null;
};

export type PartnerApplicationPushSource = {
  id: string;
  name: string;
  contactFirstName: string | null;
  contactLastName: string | null;
};

export type VehicleApprovalPushSource = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  partnerId: string;
  partnerName: string;
};

export type ReservationPushSource = {
  id: string;
  reservationCode: string | null;
  serviceType: string | null;
  tourCode: string | null;
  pickupAt: Date | string | null;
  durationHours: number | null;
  vehicleCode: string | null;
  vehicleLabelTr: string | null;
  pickupNameTr: string | null;
  pickupNameCustomer: string | null;
  dropoffNameTr: string | null;
  dropoffNameCustomer: string | null;
  passengerCount: number | null;
  totalPrice: string | number | null;
  currency: string | null;
};

export type OpsPushPayload = {
  kind: OpsPushKind;
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  url: string;
  requireInteraction: boolean;
};

function compactLines(lines: Array<string | null | undefined>): string {
  return lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function serviceLine(
  serviceType: string | null,
  tourCode: string | null,
  durationHours: number | null,
): string {
  if (serviceType?.trim() === "hourly") {
    return opsHourlyServiceLabel(durationHours);
  }
  return opsServiceLabel(serviceType, tourCode);
}

function routeLine(source: {
  pickupNameTr: string | null;
  pickupNameCustomer: string | null;
  dropoffNameTr: string | null;
  dropoffNameCustomer: string | null;
  serviceType: string | null;
}): string | null {
  const pickup = opsPlaceLabel(source.pickupNameTr, source.pickupNameCustomer);
  const dropoff = opsPlaceLabel(source.dropoffNameTr, source.dropoffNameCustomer);
  const type = source.serviceType?.trim();
  if (type === "transfer" && pickup && dropoff) {
    return `${pickup} → ${dropoff}`;
  }
  if (type === "hourly" || type === "tour") {
    return pickup ?? dropoff;
  }
  if (pickup && dropoff) {
    return `${pickup} → ${dropoff}`;
  }
  return pickup ?? dropoff;
}

export function buildProcessPushPayload(
  source: ProcessPushSource,
  localePath: string = "tr",
): OpsPushPayload {
  return {
    kind: "process",
    title: PROCESS_PUSH_TITLE,
    body: compactLines([
      formatOpsPushDateTime(source.pickupAt),
      serviceLine(source.serviceType, source.tourCode, source.durationHours),
      routeLine(source),
      formatOpsPassengerCount(source.passengerCount),
    ]),
    icon: PROCESS_PUSH_ICON,
    badge: PROCESS_PUSH_BADGE,
    tag: `process:${source.id}`,
    url: `/${localePath}/ops/processes/${source.id}`,
    requireInteraction: false,
  };
}

export function buildReservationPushPayload(
  source: ReservationPushSource,
  localePath: string = "tr",
): OpsPushPayload {
  const service = serviceLine(source.serviceType, source.tourCode, source.durationHours);
  const vehicle = opsVehicleLabel(source.vehicleCode, source.vehicleLabelTr);
  const type = source.serviceType?.trim();
  const serviceWithVehicle =
    type === "hourly"
      ? service
      : vehicle
        ? `${service} • ${vehicle}`
        : service;
  const meta = [
    formatOpsPassengerCount(source.passengerCount),
    source.reservationCode?.trim() || null,
    formatOpsPrice(source.totalPrice, source.currency),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" • ");

  return {
    kind: "reservation",
    title: RESERVATION_PUSH_TITLE,
    body: compactLines([
      formatOpsPushDateTime(source.pickupAt),
      serviceWithVehicle,
      type === "hourly" ? vehicle : null,
      routeLine(source),
      meta,
    ]),
    icon: RESERVATION_PUSH_ICON,
    badge: RESERVATION_PUSH_BADGE,
    tag: `reservation:${source.id}`,
    url: `/${localePath}/ops/reservations/${source.id}`,
    requireInteraction: true,
  };
}

export function buildPartnerApplicationPushPayload(
  source: PartnerApplicationPushSource,
  localePath: string = "tr",
): OpsPushPayload {
  const contact = [source.contactFirstName, source.contactLastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return {
    kind: "partner",
    title: PARTNER_APPLICATION_PUSH_TITLE,
    body: compactLines([
      source.name.trim() || null,
      contact ? `Yetkili: ${contact}` : null,
    ]),
    icon: PARTNER_APPLICATION_PUSH_ICON,
    badge: PARTNER_APPLICATION_PUSH_BADGE,
    tag: `partner:${source.id}`,
    url: `/${localePath}/ops/partners/${source.id}`,
    requireInteraction: false,
  };
}

export function buildVehicleApprovalPushPayload(
  source: VehicleApprovalPushSource,
  localePath: string = "tr",
): OpsPushPayload {
  const vehicle = [source.brand, source.model].filter(Boolean).join(" ");
  return {
    kind: "partner",
    title: VEHICLE_APPROVAL_PUSH_TITLE,
    body: compactLines([
      source.plate.trim() || null,
      vehicle || null,
      source.partnerName.trim() || null,
    ]),
    icon: PARTNER_APPLICATION_PUSH_ICON,
    badge: PARTNER_APPLICATION_PUSH_BADGE,
    tag: `vehicle-approval:${source.id}`,
    url: `/${localePath}/ops/vehicles/${source.id}`,
    requireInteraction: false,
  };
}
