import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import {
  BUS_CODE,
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MIDIBUS_CODE,
  MINIBUS_CODE,
  PREMIUM_ECONOMY_SEDAN_CODE,
  STANDARD_MINIVAN_CODE,
} from "@/lib/booking/pricing/vehicle-quote";
import { type Locale } from "@/lib/i18n/config";
import { type PartnerVehicleStatus } from "@/lib/partner/fleet-view";

export const PARTNER_VEHICLE_CLASS_CODES = [
  PREMIUM_ECONOMY_SEDAN_CODE,
  STANDARD_MINIVAN_CODE,
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MINIBUS_CODE,
  MIDIBUS_CODE,
  BUS_CODE,
] as const;

export type PartnerVehicleClassCode = (typeof PARTNER_VEHICLE_CLASS_CODES)[number];

export const VEHICLE_CLASSES_REQUIRING_APPROVAL = [
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
] as const;

export function isPartnerVehicleClassCode(value: string): value is PartnerVehicleClassCode {
  return (PARTNER_VEHICLE_CLASS_CODES as readonly string[]).includes(value);
}

export function vehicleClassRequiresApproval(code: string) {
  return (VEHICLE_CLASSES_REQUIRING_APPROVAL as readonly string[]).includes(code);
}

export function initialVehicleStatusForClass(code: string): PartnerVehicleStatus {
  return vehicleClassRequiresApproval(code) ? "pending_approval" : "active";
}

export function partnerVehicleClassLabel(code: string, locale: Locale) {
  if (!isPartnerVehicleClassCode(code)) {
    return code || "—";
  }
  return vehicleCardCopyFor(code, locale).title;
}

export function partnerVehicleClassOptions(locale: Locale) {
  return PARTNER_VEHICLE_CLASS_CODES.map((code) => ({
    code,
    label: partnerVehicleClassLabel(code, locale),
  }));
}
